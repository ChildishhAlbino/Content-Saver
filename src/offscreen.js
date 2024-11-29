import { SOURCES } from "./sources";
import { v5 as uuidv5, v4 as uuidv4 } from 'uuid';
import { createDownloadItem, DOWNLOAD_STATUS } from './downloadUtils';
import { zipResponses as zipResponsesAndTriggerDownload, NAMESPACE_URL } from './backgroundUtils'
import {
    writeDownloadItem,
    deleteDownload,
    clearAllDownloads,
    getDownloadItem,
    getHydratedDownloads,
    getAllDownloads
} from './persistence/downloads'
import { listenForMessages } from "./messaging/message-handler";
import { ACTION_DOWNLOAD, ADHOC_DOWNLOAD, CANCEL_DOWNLOAD, DELETE_DOWNLOAD_ITEM, DOWNLOAD_ALL, HANDLE_STORAGE_UPDATE } from "./commands";
import { createMessage, sleep } from "./util";

const zipAndDownloadTime = 2
const historyClearTime = 5 * 60
const maxBlobSize = 2
const DOWNLOADS = {}

let clearHistoryTimer = null
let zipAndDownloadTimer = null
let isZipping = false
let numZipFailures = 0

const referenceHandlers = {
    [DELETE_DOWNLOAD_ITEM]: deleteDownloadItem,
    [ACTION_DOWNLOAD]: actionDownload,
    [ADHOC_DOWNLOAD]: adHocDownload,
    [DOWNLOAD_ALL]: downloadAllItems,
    [CANCEL_DOWNLOAD]: cancelDownload
}

window.addEventListener("DOMContentLoaded", () => {
    console.log("LOADED")
    chrome.runtime.sendMessage(createMessage(
        SOURCES.OFFSCREEN,
        SOURCES.BACKGROUND,
        { numFiles: getAllDownloads().length },
        HANDLE_STORAGE_UPDATE
    ))
})

listenForMessages(SOURCES.OFFSCREEN, referenceHandlers, false)

async function actionDownload(req) {
    const downloadId = uuidv4()
    const { data, internal } = req.PAYLOAD
    let parentMetaData = {}
    console.log("RECEIVED DATA:", data, downloadId);
    data.forEach(item => {
        const status = createDownloadItem(
            null,
            null,
            DOWNLOAD_STATUS.PENDING,
            null
        )
        if (!internal) {
            writeDownloadItem(item, status);
        }
    })
    const downloads = await Promise.all(data.map((element) => downloadItem(element, parentMetaData)))
    const validResponses = downloads.filter(item => !!item);
    // console.log('BLOBS', validResponses, validResponses.map(item => item.blob.size));
    if (validResponses.length > 0) {
        resetClearHistoryTimer()
        DOWNLOADS[downloadId] = validResponses
        if (zipAndDownloadTimer) {
            clearTimeout(zipAndDownloadTimer);
        }
        zipAndDownloadTimer = setTimeout(zipBatchesAndDownload, zipAndDownloadTime * 1000);
    } else {
        console.log("List of response was empty.");
    }
}

async function zipBatchesAndDownload() {
    while (isZipping) {
        console.log("Waiting for current zip to finish...")
        await sleep(3000)
    }
    isZipping = true
    console.log("Zipping responses!");
    // take a snapshot of DOWNLOADS at the start of this function
    const downloadEntries = Object.entries(DOWNLOADS)
    if (downloadEntries.length < 1) {
        console.log("Tried to download but DOWNLOADS was empty", { DOWNLOADS, downloadEntries })
        return
    }
    // separate entries into ids and responses
    const downloadIds = downloadEntries.map(([downloadId]) => downloadId)
    const downloadResponses = downloadEntries.map(([_, data]) => data).flat()
    console.log({ downloadIds, downloadResponses });
    // Cleanup downloads IDs included in this zip to prevent inclusion in next trigger
    clearDownloadIds(downloadIds)
    // zip responses and trigger download
    try {
        await zipResponsesAndTriggerDownload(downloadResponses)
    } catch (error) {
        console.error(error)
        // increment numZipFailures
        numZipFailures += 1
        if (numZipFailures < 3) {
            // replace entries in DOWNLOADS for retry
            for (const [downloadId, downloadResponse] of downloadEntries) {
                DOWNLOADS[downloadId] = downloadResponse
            }
        } else {
            console.log("Zipping DOWNLOADS failed with error too many times...", { downloadEntries });
            clearDownloadIds(downloadIds)
        }
    }
    console.log({ DOWNLOADS });

    resetClearHistoryTimer()
    isZipping = false
}


function clearDownloadIds(downloadIds) {
    for (const downloadId of downloadIds) {
        delete DOWNLOADS[downloadId]
    }
}

function resetClearHistoryTimer() {
    if (clearHistoryTimer) {
        clearTimeout(clearHistoryTimer);
    }
    clearHistoryTimer = setTimeout(clearHistory, historyClearTime * 1000);
}

async function adHocDownload(req) {
    console.log({ req });
    const { element } = req.PAYLOAD
    const msg = createMessage(
        SOURCES.OFFSCREEN,
        SOURCES.OFFSCREEN,
        {
            data: [element],
            parentMetaData: {},
            internal: true
        },
        ACTION_DOWNLOAD
    )
    actionDownload(msg)
}

async function downloadAllItems(req) {
    console.log({ req });
    const hydratedDownloads = getHydratedDownloads()
    const internalUrls = Object.values(hydratedDownloads).map(value => {
        return value.metadata.url
    })
    const msg = createMessage(
        SOURCES.OFFSCREEN,
        SOURCES.OFFSCREEN,
        {
            data: internalUrls,
            parentMetaData: {},
            internal: true
        },
        ACTION_DOWNLOAD
    )
    actionDownload(msg)
}

function deleteDownloadItem(req) {
    const key = req.PAYLOAD.key
    deleteDownload(key)
}

function cancelDownload(req) {
    const key = req.PAYLOAD.key
    const currentItem = getDownloadItem(key)
    currentItem.status = DOWNLOAD_STATUS.CANCELLED
    currentItem.metadata = {}
    writeDownloadItem(key, currentItem)
}

function clearHistory() {
    clearAllDownloads()
    console.log("HISTORY CLEARED")
}

const downloadItem = async (element, parentMetaData) => {
    if (!element) {
        return null;
    } else if (!element.includes("blob:")) {
        return await getItemBlob(element, parentMetaData);
    } else if (element.includes("chrome-extension:")) {
        return await getItemBlob(element, parentMetaData, true);
    } else {
        const status = createDownloadItem(
            null,
            null,
            DOWNLOAD_STATUS.ERROR,
            { error: "Cannot download blob urls from other domains." }
        )
        writeDownloadItem(element, status);
        return null
    }
};

const getItemBlob = async (element, parentMetaData, isReattempt) => {
    const downloadItem = getDownloadItem(element)
    if (downloadItem && downloadItem.status === DOWNLOAD_STATUS.PENDING && downloadItem.downloaded != null) {
        console.log("Element already downloading", element)
        return null;
    }
    console.log(`Getting blob for element: ${element}`)
    const dataArrays = []
    let smallerBlob = null
    let smallerBlobUrl = null
    try {
        const response = await fetch(element, {
            method: "GET",
            credentials: "same-origin",
            redirect: 'follow'
        })
        const contentType = response.headers.get('content-type');
        const contentDisposition = response.headers.get('content-disposition');
        const fileName = contentDisposition ? contentDisposition : uuidv5(element, NAMESPACE_URL)
        const contentLength = +response.headers.get('content-length');
        const contentLengthAsMb = contentLength / 1024 / 1024
        let contentDownloaded = 0
        const baseMetadata = {
            ...parentMetaData,
            contentType,
            contentDisposition,
            fileName
        }
        console.log(response.status)
        if (response.status > 400) {
            console.log({ response });
            try {
                const json = await response.json()
                console.log(json)
                throw Error(response.status)
            } catch {
                throw Error("Response was not in JSON format...")
            }
        }
        const reader = response.body.getReader()
        // infinite loop while the body is downloading
        while (true) {
            // done is true for the last chunk
            // value is Uint8Array of the chunk bytes
            const { done, value } = await reader.read();
            if (value) {
                dataArrays.push(value)
            }

            if (done) {
                console.log("Finished", element, contentType)
                if (!isReattempt) {
                    const statusItem = createDownloadItem(
                        contentLengthAsMb,
                        "100",
                        DOWNLOAD_STATUS.SUCCESS,
                        {
                            ...baseMetadata,
                            url: URL.createObjectURL(new Blob(dataArrays, { type: contentType })),
                            previewUrl: smallerBlobUrl
                        }
                    )
                    const currentItem = getDownloadItem(element)
                    if (currentItem && currentItem.status === DOWNLOAD_STATUS.CANCELLED) {
                        deleteDownload(element)
                        return null
                    }
                    writeDownloadItem(element, statusItem)
                }
                break;
            }
            contentDownloaded += value.length
            const currentAsMB = contentDownloaded / 1024 / 1024
            if (currentAsMB >= maxBlobSize && !smallerBlob) {
                smallerBlob = new Blob(dataArrays, { type: contentType })
                // smallerBlobUrl = await convertBlobToDataUrl(smallerBlob)
                smallerBlobUrl = URL.createObjectURL(smallerBlob)
                console.log({ smallerBlob, smallerBlobUrl })
            }
            const percent = ((currentAsMB / contentLengthAsMb) * 100).toFixed(2)

            const finalUrl = smallerBlobUrl ? smallerBlobUrl : URL.createObjectURL(new Blob(dataArrays, { type: contentType }))

            if (!isReattempt) {
                const statusItem = createDownloadItem(
                    contentLengthAsMb,
                    percent,
                    DOWNLOAD_STATUS.PENDING,
                    {
                        ...baseMetadata,
                        url: finalUrl
                    }
                )
                const currentItem = getDownloadItem(element)
                if (currentItem && currentItem.status === DOWNLOAD_STATUS.CANCELLED) {
                    deleteDownload(element)
                    return null
                }
                writeDownloadItem(element, statusItem)
            }

        }

        return { element, blob: new Blob(dataArrays, { type: contentType }), smallerBlob }
    } catch (e) {
        console.log(e);
        if (!isReattempt) {
            const statusItem = createDownloadItem(
                null,
                null,
                DOWNLOAD_STATUS.ERROR,
                { error: e }
            )
            writeDownloadItem(element, statusItem)
        }
        return null;
    }
};
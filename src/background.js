import { v5 as uuidv5 } from 'uuid';

import { createMessage, validateMessage } from './util';
import { SOURCES } from './sources';
import { createDownloadItem, DOWNLOAD_STATUS } from './downloadUtils';
import { DELETE_DOWNLOAD_ITEM, ADHOC_DOWNLOAD, DOWNLOAD_ALL } from "./commands"
import { zipResponses, NAMESPACE_URL } from './backgroundUtils'
import {
  writeDownloadItem,
  deleteDownload,
  clearAllDownloads,
  getDownloadItem,
  getHydratedDownloads
} from './persistence/downloads'

let activated = false;
const backgroundSource = SOURCES.BACKGROUND

const toggleHighlight = () => {
  // gets the current tab and passes it directly into the toggle function
  chrome.tabs.query({}, (tabs) => {
    if (tabs.length > 0) {
      toggle(tabs);
    }
  });
};

const historyClearTime = 5 * 60
const maxBlobSize = 2

let clearHistoryTimer = null
chrome.contextMenus.create({
  title: "Toggle Content Saver",
  onclick: toggleHighlight,
});


function deleteDownloadItem(req) {
  const key = req.PAYLOAD.key
  deleteDownload(key)
}

function adHocDownload(req) {
  const { PAYLOAD: { element: url } } = req;
  const element = getDownloadItem(url)
  const { metadata: { source, url: thumbnailUrl, cookie } } = element
  if (thumbnailUrl) {
    downloadBatch(null, [thumbnailUrl], null)
    return
  }
  downloadBatch(source, [url], cookie)
}

function downloadAll(req) {
  const batches = {
    ["internal"]: [],
  }
  Object.entries(getHydratedDownloads()).forEach(([url, data]) => {
    const { source, cookie, url: thumbnailUrl } = data.metadata
    if (thumbnailUrl) {
      batches["internal"].push(thumbnailUrl)
      return;
    }

    const key = [source, cookie]
    const existingBatch = batches[key]
    if (existingBatch) {
      existingBatch.push(url)
      batches[key] = existingBatch
    } else {
      batches[key] = [url]
    }
  })
  Object.entries(batches).forEach(([key, items]) => {
    if (key === "internal") {
      downloadBatch(null, items, null)
    } else {
      const [source, cookie] = key
      downloadBatch(source, items, cookie)
    }
  })

}

const referenceHandlers = {
  [DELETE_DOWNLOAD_ITEM]: deleteDownloadItem,
  [ADHOC_DOWNLOAD]: adHocDownload,
  [DOWNLOAD_ALL]: downloadAll,
}

const addOnBeforeSendHeaders = (urls, headers) => {
  console.log(urls);
  console.log("ADDING HEADERS");
  chrome.webRequest.onBeforeSendHeaders.addListener(
    headers,
    { urls: urls.filter(it => it != null && !it.includes("blob:")) },
    ["requestHeaders", "extraHeaders", "blocking"]
  );
};


chrome.runtime.onMessage.addListener(async (request) => {

  if (validateMessage(request, backgroundSource)) {
    console.log(request);
    const handler = referenceHandlers[request.REFERENCE];
    if (handler) {
      handler(request);
    } else {
      console.log("No Handler Registered", request.REFERENCE);
    }
  }

  if (request == "DEACTIVATE") {
    activated = false;
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, "DEACTIVATE_CONTENT_HIGHLIGHT");
      });
    });
  }
  if (request.message && request.message === "DATA") {
    console.log(request)
    const { source, data: rawData, cookie } = request
    downloadBatch(source, rawData, cookie);
  }
});

function downloadBatch(source, rawData, cookie) {
  let parentMetaData = {}
  let referrerHeader = null
  let data = new Set(rawData);
  data = Array.from(data);
  if (source != null) {
    referrerHeader = generateHeadersForSource(source, cookie);
    addOnBeforeSendHeaders(data, referrerHeader);
    parentMetaData = {
      source,
      cookie
    };
  }
  console.log("RECEIVED DATA:", data);
  data.forEach(item => {
    const status = createDownloadItem(
      null,
      null,
      DOWNLOAD_STATUS.PENDING,
      null
    )
    writeDownloadItem(item, status);
  })
  Promise.all(data.map((element) => downloadItem(element, parentMetaData))).then(async (res) => {
    const responses = res.filter(item => !!item);
    console.log('BLOBS', responses, responses.map(item => item.blob.size));
    if (responses.length > 0) {
      zipResponses(responses).then(() => {
        if (clearHistoryTimer) {
          clearTimeout(clearHistoryTimer);
        }
        clearHistoryTimer = setTimeout(clearHistory, historyClearTime * 1000);
      });
    } else {
      console.log("List of response was empty.");
    }
    if (referrerHeader) {
      removeOnBeforeSendHeaders(referrerHeader);
    }
  });
}

function clearHistory() {
  clearAllDownloads()
  console.log("HISTORY CLEARED")
}

chrome.commands.onCommand.addListener(function (command) {
  if (command == "toggle-highlight-content") {
    toggleHighlight();
  }
});

const downloadItem = async (element, parentMetaData) => {
  if (!element) {
    return null;
  } else if (!element.includes("blob:")) {
    return await getItemBlob(element, parentMetaData);
  } else {
    if (element.includes("chrome-extension:")) {
      return await getItemBlob(element, parentMetaData, true);
    }

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

const removeOnBeforeSendHeaders = (headers) => {
  console.log("REMOVING LISTENER");
  chrome.webRequest.onBeforeSendHeaders.removeListener(headers);
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
      const json = await response.json()
      console.log(json)
      throw Error(response.status)
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
          writeDownloadItem(element, statusItem)
        }
        break;
      }
      contentDownloaded += value.length
      const currentAsMB = contentDownloaded / 1024 / 1024
      if (currentAsMB >= maxBlobSize && !smallerBlob) {
        smallerBlob = new Blob(dataArrays, { type: contentType })
        smallerBlobUrl = URL.createObjectURL(smallerBlob)
        console.log("SMALLER BLOB", smallerBlob)
      }
      const percent = ((currentAsMB / contentLengthAsMb) * 100).toFixed(2)

      const urlBlob = smallerBlob ? smallerBlob : new Blob(dataArrays, { type: contentType })

      if (!isReattempt) {
        const statusItem = createDownloadItem(
          contentLengthAsMb,
          percent,
          DOWNLOAD_STATUS.PENDING,
          {
            ...baseMetadata,
            url: smallerBlobUrl || URL.createObjectURL(urlBlob)
          }
        )
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


const generateHeadersForSource = (source, cookie) => {
  return (details) => {
    details.requestHeaders.push(
      {
        name: "Referer",
        value: source,
      }
    );
    if (cookie) {
      details.requestHeaders.push(
        {
          name: "cookie",
          value: cookie,
        }
      );
    }
    console.log(details.requestHeaders)
    return { requestHeaders: details.requestHeaders };
  };
}

const toggle = (tabs) => {
  tabs.forEach((tab) => {
    if (activated) {
      chrome.tabs.sendMessage(tab.id, "DEACTIVATE_CONTENT_HIGHLIGHT");
    } else {
      chrome.tabs.sendMessage(tab.id, "ACTIVATE_CONTENT_HIGHLIGHT");
    }
  });
  activated = !activated;
};
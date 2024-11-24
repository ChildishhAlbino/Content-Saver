import superBase64 from 'super-base-64';
import { v5 as uuidv5 } from 'uuid';
import { createMessage } from './util';
import { SOURCES } from './sources';
import { DOWNLOAD_ZIP_FILE } from './commands';
const JSZip = require("jszip");
const mime = require('mime-types')

const stripBase64 = (rawB64) => {
    const commaIndex = rawB64.indexOf(',')
    if (commaIndex !== -1) {
        return rawB64.substring(commaIndex + 1, 16000000);
    }
    return rawB64
}

async function getBase64(blob) {
    const b64 = await superBase64(blob)
    // console.log("rawB64", b64)
    if (!b64) {
        console.log("b64 was wonky")
    }
    const finalB64 = stripBase64(b64)
    // console.log('B64', finalB64.substring(0, 100), finalB64.substring(finalB64.length - 100))
    return finalB64
}

export const NAMESPACE_URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
async function zipFile(response, zip) {
    try {
        if (response != null) {
            const { blob, smallerBlob } = response
            const b64blob = smallerBlob ? smallerBlob : blob
            const finalB64 = await getBase64(b64blob)
            console.log('b64 size', finalB64.length)
            const filenameUUID = uuidv5(finalB64, NAMESPACE_URL)
            const extension = mime.extension(blob.type)
            console.log({ filenameUUID, extension })
            zip.file(`./${filenameUUID}.${extension}`, blob)
        }
    } catch (error) {
        console.error(`zipFile(${respo}) failed with error:`, error)
        throw error
    }

}

export async function zipResponses(responses) {
    try {
        const zip = new JSZip();
        let promises = responses.map(async (response) => {
            await zipFile(response, zip)
        })
        await Promise.all(promises)
        const content = await zip.generateAsync({ type: "blob" })
        const url = URL.createObjectURL(content)
        console.log("ZIP URL", { url })
        const downloadZipMsg = createMessage(
            SOURCES.OFFSCREEN,
            SOURCES.BACKGROUND,
            { zipUrl: url },
            DOWNLOAD_ZIP_FILE
        )
        chrome.runtime.sendMessage(downloadZipMsg)
    } catch (error) {
        console.error("zipResponses failed with error:", error)
        throw error
    }
}
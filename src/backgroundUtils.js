import superBase64 from 'super-base-64';
import { v5 as uuidv5 } from 'uuid';
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
    console.log("rawB64", b64)
    if (!b64) {
        console.log("b64 was wonky")
    }
    const finalB64 = stripBase64(b64)
    console.log('B64', finalB64.substring(0, 100), finalB64.substring(finalB64.length - 100))
    return finalB64
}

export const NAMESPACE_URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
async function zipFile(response, zip) {
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
}

export async function zipResponses(responses) {
    const zip = new JSZip();
    let promises = responses.map(async (response) => {
        await zipFile(response, zip)
    })
    await Promise.all(promises)
    const zipDataB64 = await zip.generateAsync({ type: "base64" })

    console.log({ content: zipDataB64 });
    const url = `data:application/octet-stream;base64,${zipDataB64}`
    console.log({ url })
    chrome.downloads.download({
        url,
        filename: `${uuidv5(zipDataB64, NAMESPACE_URL)}.zip`
    });
}
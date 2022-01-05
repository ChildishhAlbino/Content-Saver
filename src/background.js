import superBase64 from 'super-base-64';
import { v5 as uuidv5 } from 'uuid';

const JSZip = require("jszip");
const mime = require('mime-types')
let activated = false;

window.blobs = [];

const toggleHighlight = () => {
  // gets the current tab and passes it directly into the toggle function
  chrome.tabs.query({}, (tabs) => {
    if (tabs.length > 0) {
      toggle(tabs);
    }
  });
};

let parent = chrome.contextMenus.create({
  title: "Toggle Content Saver",
  onclick: toggleHighlight,
});

chrome.runtime.onMessage.addListener(async (request) => {
  if (request == "DEACTIVATE") {
    activated = false;
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, "DEACTIVATE_CONTENT_HIGHLIGHT");
      });
    });
  }
  if (request.message && request.message === "DATA") {
    let data = new Set(request.data);
    data = Array.from(data);
    console.log("RECEIVED DATA:", data);
    const responses = (await Promise.all(data.map((element) => downloadItem(element)))).filter(item => !!item)
    console.log('BLOBS', responses, responses.map(item => item.blob.size))
    if (responses.length > 0) {
      await zipResponses(responses)
    } else {
      console.log("List of response was empty.")
    }
    removeOnBeforeSendHeaders();
  }
});

const stripBase64 = (rawB64) => {
  const commaIndex = rawB64.indexOf(',')
  if (commaIndex !== -1) {
    return rawB64.substring(commaIndex + 1, 16000000);
  }
  return rawB64
}

const getBase64 = async (blob) => {
  const b64 = await superBase64(blob)
  console.log("rawB64", b64)
  if (!b64) {
    console.log("b64 was wonky")
  }
  const finalB64 = stripBase64(b64)
  console.log('B64', finalB64.substring(0, 100), finalB64.substring(finalB64.length - 100))
  return finalB64
}

const NAMESPACE_URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
const zipFile = async (response, zip) => {
  if (response != null) {
    const { blob, smallerBlob } = response
    const b64blob = smallerBlob ? smallerBlob : blob
    const finalB64 = await getBase64(b64blob)
    console.log('b64 size', finalB64.length)
    const filenameUUID = uuidv5(finalB64, NAMESPACE_URL)
    console.log('filename', filenameUUID)
    const extension = mime.extension(blob.type)
    console.log(filenameUUID, extension)
    zip.file(`./${filenameUUID}.${extension}`, blob)
  }
}

const zipResponses = async (responses) => {
  const zip = new JSZip();
  let promises = responses.map(async (response) => {
    await zipFile(response, zip)
  })
  let resolved = await Promise.all(promises)
  const content = await zip.generateAsync({ type: "blob" })

  console.log(content);
  const url = URL.createObjectURL(content)
  chrome.downloads.download({
    url,
  });
}

const downloadItem = async (element) => {
  if (!element) {
    return null;
  }
  else if (!element.includes("blob:")) {
    return await getItemBlob(element);
  } else {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tab = tabs[0];
      chrome.tabs.sendMessage(tab.id, "ERROR_DOWNLOAD_BLOB");
    });
    return null
  }
};

const removeOnBeforeSendHeaders = () => {
  console.log("REMOVING LISTENER");
  chrome.webRequest.onBeforeSendHeaders.removeListener(beforeSendHeaders);
};

const addOnBeforeSendHeaders = () => {
  console.log("ADDING HEADERS");
  chrome.webRequest.onBeforeSendHeaders.addListener(
    beforeSendHeaders,
    { urls: ["*://v16-web.tiktok.com/*"] },
    ["requestHeaders", "extraHeaders", "blocking"]
  );
};

const getItemBlob = async (element) => {
  addOnBeforeSendHeaders();
  console.log(`Getting blob for element: ${element}`)
  const dataArrays = []
  let needsSmallerBlob = false
  let smallerBlob = null
  try {
    const response = await fetch(element, {
      method: "GET",
      credentials: "same-origin",
    })
    const contentType = response.headers.get('content-type');
    const contentLength = +response.headers.get('content-length');
    const contentLengthAsMb = contentLength / 1024 / 1024
    if (contentLengthAsMb > 150) {
      needsSmallerBlob = true
    }
    let contentDownloaded = 0
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
        break;
      }
      contentDownloaded += value.length
      const currentAsMB = contentDownloaded / 1024 / 1024
      if (needsSmallerBlob && currentAsMB >= 150) {
        smallerBlob = new Blob(dataArrays, { type: contentType })
      }
      const percent = ((currentAsMB / contentLengthAsMb) * 100).toFixed(2)
      console.log(`${element} : ${percent} : (${currentAsMB.toFixed(2)} of ${contentLengthAsMb.toFixed(2)})`)
    }

    return { element, blob: new Blob(dataArrays, { type: contentType }), smallerBlob }
  } catch (e) {
    console.log(e);
    return null;
  }

};

chrome.commands.onCommand.addListener(function (command) {
  if (command == "toggle-highlight-content") {
    toggleHighlight();
  }
});

const beforeSendHeaders = (details) => {
  console.log("DETAILS");
  details.requestHeaders.push({
    name: "Referer",
    value: "https://www.tiktok.com/",
  });
  return { requestHeaders: details.requestHeaders };
};

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

const appendUInt8Array = (arrays) => {
  const flatNumberArray = arrays.reduce((acc, curr) => {
    // console.log(acc, curr)
    acc.push(...curr);
    return acc;
  }, []);

  return new Uint8Array(flatNumberArray);
};

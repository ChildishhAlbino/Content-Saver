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
    const responses = await Promise.all(data.map((element) => downloadItem(element)))
    console.log('BLOBS', responses)
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
  return rawB64.substring(commaIndex + 1);
}

const getBase64 = async (blob) => {
  const b64 = await superBase64(blob)
  const finalB64 = stripBase64(b64)
  return finalB64
}

const NAMESPACE_URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
const zipFile = async (response, zip) => {
  if (response != null) {
    const { blob } = response
    const finalB64 = await getBase64(blob)
    const filenameUUID = uuidv5(finalB64, NAMESPACE_URL)
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
  return await fetch(element, {
    method: "GET",
    credentials: "same-origin",
  })
    .then((data) => { return data.blob() })
    .then((blob) => {
      return { element, blob };
    })
    .catch((error) => {
      console.log(error);
      return null;
    });
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

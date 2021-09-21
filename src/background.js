const JSZip = require("jszip");
const getUuid = require('uuid-by-string')
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

chrome.runtime.onMessage.addListener((request) => {
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
    Promise.all(data.map((element) => downloadItem(element))).then((responses) => {
      console.log('BLOBS', responses)
      if (responses.length > 0) {
        zipResponses(responses)
      } else {
        console.log("List of response was empty.")
      }
      removeOnBeforeSendHeaders();
    })
  }
});

const zipResponses = (responses => {
  const zip = new JSZip();
  responses.forEach((response) => {
    if (response != null) {
      const { element, blob, text } = response
      const filenameUUID = getUuid(text)
      const extension = mime.extension(blob.type)
      console.log(filenameUUID, extension)
      zip.file(`./${filenameUUID}.${extension}`, blob)
    }
  })
  zip.generateAsync({ type: "blob" }).then(function (content) {
    console.log(content);
    const url = URL.createObjectURL(content)
    chrome.downloads.download({
      url,
    });
  });
})

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
    .then(async (blob) => {
      console.log(blob);
      const text = await blob.text();
      return { element, blob, text };
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

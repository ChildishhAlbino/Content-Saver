import superBase64 from 'super-base-64';
import { v5 as uuidv5 } from 'uuid';

import { createMessage, validateMessage } from './util';
import { SOURCES } from './sources';
import { createDownloadItem, DOWNLOAD_STATUS } from './downloadUtils';
import { DELETE_DOWNLOAD_ITEM, ADHOC_DOWNLOAD } from "./commands"
import { zipResponses } from './backgroundUtils'


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

window.files = {}


let clearHistoryTimer = null

let parent = chrome.contextMenus.create({
  title: "Toggle Content Saver",
  onclick: toggleHighlight,
});


function deleteDownloadItem(req) {
  const key = req.PAYLOAD.key
  delete files[key]
}

function adHocDownload(req) {
  const { PAYLOAD: { data, source } } = req;
  downloadBatch(source, data)
}

const referenceHandlers = {
  [DELETE_DOWNLOAD_ITEM]: deleteDownloadItem,
  [ADHOC_DOWNLOAD]: adHocDownload
}

const addOnBeforeSendHeaders = (urls, headers) => {
  console.log("ADDING HEADERS");
  chrome.webRequest.onBeforeSendHeaders.addListener(
    headers,
    { urls: urls },
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
    const source = request.source;
    const rawData = request.data
    downloadBatch(source, rawData);
  }
});

function downloadBatch(source, rawData) {
  const referrerHeader = generateHeadersForSource(source);
  let data = new Set(rawData);
  data = Array.from(data);

  addOnBeforeSendHeaders(data, referrerHeader);

  console.log("RECEIVED DATA:", data);
  Promise.all(data.map((element) => downloadItem(element))).then(async (res) => {
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
    removeOnBeforeSendHeaders(referrerHeader);
  });
}

function clearHistory() {
  window.files = {}
  console.log("HISTORY CLEARED")
}

chrome.commands.onCommand.addListener(function (command) {
  if (command == "toggle-highlight-content") {
    toggleHighlight();
  }
});

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

const removeOnBeforeSendHeaders = (headers) => {
  console.log("REMOVING LISTENER");
  chrome.webRequest.onBeforeSendHeaders.removeListener(headers);
};


const getItemBlob = async (element) => {

  const downloadItem = files[element]
  if (downloadItem && downloadItem.status === DOWNLOAD_STATUS.PENDING) {
    console.log("Element already downloading", element)
    return null;
  }
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
    const contentDisposition = response.headers.get('content-disposition');
    const contentLength = +response.headers.get('content-length');
    const contentLengthAsMb = contentLength / 1024 / 1024
    if (contentLengthAsMb > 150) {
      console.log("NEEDS SMALLER BLOB")
      needsSmallerBlob = true
    }
    let contentDownloaded = 0
    const baseMetadata = {
      contentType,
      contentDisposition
    }
    console.log(response.status)
    if (response.status > 400) {

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
        files[element] = createDownloadItem(
          contentLengthAsMb,
          "100",
          DOWNLOAD_STATUS.SUCCESS,
          {
            ...baseMetadata,
            url: URL.createObjectURL(new Blob(dataArrays, { type: contentType }))
          }
        )
        break;
      }
      contentDownloaded += value.length
      const currentAsMB = contentDownloaded / 1024 / 1024
      if (needsSmallerBlob && currentAsMB >= 150 && !smallerBlob) {
        smallerBlob = new Blob(dataArrays, { type: contentType })
        console.log("SMALLER BLOB", smallerBlob)
      }
      const percent = ((currentAsMB / contentLengthAsMb) * 100).toFixed(2)

      const urlBlob = smallerBlob ? smallerBlob : new Blob(dataArrays, { type: contentType })

      files[element] = createDownloadItem(
        contentLengthAsMb,
        percent,
        DOWNLOAD_STATUS.PENDING,
        {
          ...baseMetadata,
          url: URL.createObjectURL(urlBlob)
        }
      )

    }

    return { element, blob: new Blob(dataArrays, { type: contentType }), smallerBlob }
  } catch (e) {
    console.log(e);
    files[element] = createDownloadItem(
      null,
      null,
      DOWNLOAD_STATUS.ERROR,
      { error: e }
    )
    return null;
  }

};


const generateHeadersForSource = (source) => {
  return (details) => {
    details.requestHeaders.push({
      name: "Referer",
      value: source,
    });
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
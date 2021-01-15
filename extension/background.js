let activated = false;
window.blobs = [];

const toggleHighlight = () => {
  chrome.webRequest.onBeforeSendHeaders.removeListener(beforeSendHeaders);
  // gets the current tab and passes it directly into the toggle function
  chrome.tabs.query({}, (tabs) => {
    if (tabs.length > 0) {
      toggle(tabs);
    }
  });
};

var parent = chrome.contextMenus.create({
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
  if (request.message && request.message == "DATA") {
    let data = new Set(request.data);
    console.log("RECEIVED DATA:", data);
    data.forEach((element) => {
      if (!element) {
        return;
      }
      if (!element.includes("blob:")) {
        // special edge case for tiktok
        if (element.includes("tiktok")) {
          downloadTikTok(element);
        } else {
          chrome.downloads.download({
            url: element,
          });
        }
      } else {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
          const tab = tabs[0];
          chrome.tabs.sendMessage(tab.id, "ERROR_DOWNLOAD_BLOB");
        });
      }
    });
  }
});

const downloadTikTok = (element) => {
  fetch(element, {
    method: "GET",
    credentials: "same-origin",
  })
    .then((data) => data.blob())
    .then((blob) => {
      window.blobs.push(blob);
      chrome.downloads.download({ url: URL.createObjectURL(blob) });
    })
    .then((blob) => {
      chrome.webRequest.onBeforeSendHeaders.removeListener(beforeSendHeaders);
      return blob;
    })
    .catch((error) => {
      console.log(error);
      chrome.webRequest.onBeforeSendHeaders.removeListener(beforeSendHeaders);
      return null;
    });
};

chrome.commands.onCommand.addListener(function (command) {
  if (command == "toggle-highlight-content") {
    toggleHighlight();
  }
});

const beforeSendHeaders = (details) => {
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
      chrome.webRequest.onBeforeSendHeaders.addListener(
        beforeSendHeaders,
        { urls: ["*://v16-web.tiktok.com/*"] },
        ["requestHeaders", "extraHeaders", "blocking"]
      );
      chrome.tabs.sendMessage(tab.id, "ACTIVATE_CONTENT_HIGHLIGHT");
    }
  });
  activated = !activated;
};

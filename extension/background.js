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
    console.log(request);
    console.log("RECEIVED DATA:", data);
    data.forEach((element) => {
      if (!element) {
        return;
      }
      let cookieString = "";
      chrome.cookies.getAll({ url: request.source }, (cookies) => {
        cookies.forEach((cookie) => {
          cookieString = `${cookieString}${cookie.name}=${cookie.value}; `;
        });
        // console.log(cookieString);
        if (!element.includes("blob:")) {
          fetch(element, {
            method: "GET",
            credentials: "same-origin",
          })
            .then((data) => data.blob())
            .then((blob) => {
              console.log(blob);
              window.blobs.push(blob);
              chrome.downloads.download({ url: URL.createObjectURL(blob) });
              return blob;
            })
            .catch((error) => {
              console.log(error);
              return null;
            });

          // chrome.downloads.download({ url: element });
        } else {
          chrome.tabs.query(
            { active: true, lastFocusedWindow: true },
            (tabs) => {
              const tab = tabs[0];
              chrome.tabs.sendMessage(tab.id, "ERROR_DOWNLOAD_BLOB");
            }
          );
        }
      });
    });
    // chrome.tabs.create({ url: "./test.html" });
  }
});

chrome.commands.onCommand.addListener(function (command) {
  if (command == "toggle-highlight-content") {
    toggleHighlight();
  }
});

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

chrome.webRequest.onBeforeSendHeaders.addListener(
  function (details) {
    console.log(details.url);
    console.log("BEFORE:", details.requestHeaders);
    details.requestHeaders.push({
      name: "Referer",
      value: "https://www.tiktok.com/",
    });
    console.log("AFTER:", details.requestHeaders);
    return { requestHeaders: details.requestHeaders };
  },
  { urls: ["*://*.tiktok.com/*", "*://*.tiktokcdn.com/*"] },
  ["requestHeaders", "extraHeaders", "blocking"]
);

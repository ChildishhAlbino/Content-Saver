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
    const [firstElement, ...remainder] = data;
    console.log("SPLIT:", firstElement, remainder);
    Promise.all([downloadItem(firstElement)]).then((item) => {
      console.log(item);
      let promises = remainder.map((element) => downloadItem(element));
      Promise.all(promises).then((items) => {
        console.log(items);
        removeOnBeforeSendHeaders();
      });
    });
  }
});

const downloadItem = async (element) => {
  if (!element) {
    return false;
  }
  if (!element.includes("blob:")) {
    // special edge case for tiktok
    if (element.includes("tiktok")) {
      await downloadTikTok(element);
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
  return true;
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

const downloadTikTok = async (element) => {
  addOnBeforeSendHeaders();
  await fetch(element, {
    method: "GET",
    credentials: "same-origin",
  })
    .then((data) => data.blob())
    .then((blob) => {
      console.log(blob);
      chrome.downloads.download({ url: URL.createObjectURL(blob) });
    })
    .then((blob) => {
      return blob;
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

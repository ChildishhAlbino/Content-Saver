import { createMessage, validateMessage } from './util';
import { SOURCES } from './sources';
import { ACTION_DOWNLOAD, DOWNLOAD_ZIP_FILE } from "./commands"
import { setupOffscreenDocument } from "./offscreen-controller"
import { listenForMessages } from './messaging/message-handler';

let activated = false;

const referenceHandlers = {
  [DOWNLOAD_ZIP_FILE]: downloadZipFile
}

async function downloadZipFile(req) {
  const url = req.PAYLOAD.zipUrl
  console.log("Downloading zip url...");
  chrome.downloads.download({
    url,
  });
}

const toggleHighlight = () => {
  // gets the current tab and passes it directly into the toggle function
  chrome.tabs.query({}, (tabs) => {
    if (tabs.length > 0) {
      toggle(tabs);
    }
  });
};

const CONTEXT_MENU_ITEM_ID = "content_saver_context_root"

chrome.contextMenus.create({
  id: CONTEXT_MENU_ITEM_ID,
  title: "Toggle Content Saver",
});
setupOffscreenDocument("offscreen.html")

chrome.commands.getAll().then(data => console.log(data))
chrome.commands.onCommand.addListener(function (command) {
  console.log({ command });
  if (command == "toggle-highlight-content") {
    toggleHighlight();
  }
});

chrome.contextMenus.onClicked.addListener((event => {
  console.log(event)
  if (event.menuItemId == CONTEXT_MENU_ITEM_ID) {
    toggleHighlight()
  }
}))


const addOnBeforeSendHeaders = (urls, headers) => {
  console.log(urls);
  console.log("ADDING HEADERS", { urls, headers });
  chrome.webRequest.onBeforeSendHeaders.addListener(
    headers,
    { urls: urls.filter(it => it != null && !it.includes("blob:")) },
    ["requestHeaders", "extraHeaders"]
  );
};

listenForMessages(SOURCES.BACKGROUND, referenceHandlers, async (request, sender) => {
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
    const { source, data, cookie } = request
    await handleDownloadRequest(source, data, cookie);
  }
})

async function handleDownloadRequest(source, rawData, cookie, internal = false) {
  let parentMetaData = {}
  let referrerHeader = null
  let data = new Set(rawData);
  data = Array.from(data);
  console.log(data);
  if (source != null) {
    const generatedCookie = await generateCookieFromUrl(source)
    console.log({ generatedCookie });
    referrerHeader = generateHeadersForSource(source, generatedCookie);
    addOnBeforeSendHeaders(data, referrerHeader);
    parentMetaData = {
      source,
      cookie
    };
  }
  const offscreenmsg = createMessage(
    SOURCES.BACKGROUND,
    SOURCES.OFFSCREEN,
    { data, source, cookie, internal, parentMetaData, referrerHeader },
    ACTION_DOWNLOAD
  )
  console.log("Sending message to offscreen page for request...", offscreenmsg);
  chrome.runtime.sendMessage(offscreenmsg)
  console.log("Sent message to offscreen page for request...", offscreenmsg);
}

function generateCookieFromUrl(source) {
  return new Promise((resolve, reject) => {
    try {
      chrome.cookies.getAll({ url: source }, (cookies) => {
        const mapped = cookies.map(cookie => {
          return `${cookie.name}=${cookie.value}`
        })
        const joined = mapped.join("; ")
        console.log({ cookies, mapped, joined });
        return resolve(joined)
      })
    } catch (err) {
      reject(err)
    }
  })
}

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
    console.log(source, details.requestHeaders)
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
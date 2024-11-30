import { createMessage } from './util';
import { SOURCES } from './sources';
import { ACTION_DOWNLOAD, DOWNLOAD_ZIP_FILE, HANDLE_STORAGE_UPDATE, REQUEST_DOWNLOAD } from "./commands"
import { setupOffscreenDocument } from "./offscreen-controller"
import { listenForMessages } from './messaging/message-handler';

let activated = false;
let SETUP_COMPLETE = false;
const CONTEXT_MENU_ITEM_ID = "content_saver_context_root"

const referenceHandlers = {
  [DOWNLOAD_ZIP_FILE]: downloadZipFile,
  [HANDLE_STORAGE_UPDATE]: handleStorageUpdate,
  [REQUEST_DOWNLOAD]: handleDownloadRequest
}
// INITIALIZE THE STARTUP STUFF
setup()

async function downloadZipFile(req) {
  const url = req.PAYLOAD.zipUrl
  console.log("Downloading zip url...");
  chrome.downloads.download({
    url,
  });
}

function handleStorageUpdate(req) {
  const { numFiles } = req.PAYLOAD
  console.log("UPDATING BADGE", { numFiles });
  if (numFiles > 0) {
    chrome.action.setBadgeText({ text: `${numFiles}` });
  } else {
    chrome.action.setBadgeText({
      text: ""
    })
  }
}

async function handleDownloadRequest(req) {
  const { source, data, cookie } = req.PAYLOAD
  const unique = [...new Set(data)];
  console.log(unique);
  const actionDownloadMessage = createMessage(
    SOURCES.BACKGROUND,
    SOURCES.OFFSCREEN,
    { data: unique, source, cookie, internal: false },
    ACTION_DOWNLOAD
  )
  console.log("Sending message to offscreen page for request...", actionDownloadMessage);
  chrome.runtime.sendMessage(actionDownloadMessage)
  console.log("Sent message to offscreen page for request...", actionDownloadMessage);
}

listenForMessages(SOURCES.BACKGROUND, referenceHandlers, false, async (request, sender) => {
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

const toggleHighlight = () => {
  // gets the current tab and passes it directly into the toggle function
  chrome.tabs.query({}, (tabs) => {
    if (tabs.length > 0) {
      toggleHighlightForTab(tabs);
    }
  });
};

const toggleHighlightForTab = (tabs) => {
  tabs.forEach((tab) => {
    setHighlightForTab(tab, activated ? "DEACTIVATE_CONTENT_HIGHLIGHT" : "ACTIVATE_CONTENT_HIGHLIGHT")
  });
  activated = !activated;
};

function setHighlightForTab(tab, value) {
  chrome.tabs.sendMessage(tab.id, value);
}

function setup() {
  if (!SETUP_COMPLETE) {
    setupOffscreenDocument("offscreen.html")
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ITEM_ID,
      title: "Toggle Content Saver",
    });
    chrome.contextMenus.onClicked.addListener((event => {
      if (event.menuItemId == CONTEXT_MENU_ITEM_ID) {
        toggleHighlight()
      }
    }))
    chrome.commands.onCommand.addListener(function (command) {
      if (command == "toggle-highlight-content") {
        toggleHighlight();
      }
    });
    SETUP_COMPLETE = true;
  }
}
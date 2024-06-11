import { createMessage } from './util';
import { SOURCES } from './sources';
import { ACTION_DOWNLOAD, DOWNLOAD_ZIP_FILE } from "./commands"
import { setupOffscreenDocument } from "./offscreen-controller"
import { listenForMessages } from './messaging/message-handler';

let activated = false;
let SETUP_COMPLETE = false;
const CONTEXT_MENU_ITEM_ID = "content_saver_context_root"

const referenceHandlers = {
  [DOWNLOAD_ZIP_FILE]: downloadZipFile
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



async function handleDownloadRequest(source, rawData, cookie) {
  let data = new Set(rawData);
  data = Array.from(data);
  console.log(data);
  const actionDownloadMessage = createMessage(
    SOURCES.BACKGROUND,
    SOURCES.OFFSCREEN,
    { data, source, cookie, internal: false },
    ACTION_DOWNLOAD
  )
  console.log("Sending message to offscreen page for request...", actionDownloadMessage);
  chrome.runtime.sendMessage(actionDownloadMessage)
  console.log("Sent message to offscreen page for request...", actionDownloadMessage);
}

// ZOMBIE CODE - only revive if needed for obscure use case
function generateCookieFromUrl(source) {
  return new Promise((resolve, reject) => {
    try {
      console.log("Getting cookies for", { source });
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

const toggleHighlightForTab = (tabs) => {
  tabs.forEach((tab) => {
    if (activated) {
      chrome.tabs.sendMessage(tab.id, "DEACTIVATE_CONTENT_HIGHLIGHT");
    } else {
      chrome.tabs.sendMessage(tab.id, "ACTIVATE_CONTENT_HIGHLIGHT");
    }
  });
  activated = !activated;
};

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
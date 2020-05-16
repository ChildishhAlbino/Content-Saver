let activated = false

chrome.runtime.onMessage.addListener(request => {
    if (request == "DEACTIVATE") {
        activated = false
    }
    if (request.message && request.message == "DATA") {
        request.data.forEach(element => {
            chrome.tabs.create({ url: element, active: true })
            chrome.downloads.download({ url: element })
        })
    }
})


chrome.browserAction.onClicked.addListener((tab) => {
    if (activated) {
        chrome.tabs.sendMessage(tab.id, 'DEACTIVATE_CONTENT_HIGHLIGHT')
    } else {
        chrome.tabs.sendMessage(tab.id, 'ACTIVATE_CONTENT_HIGHLIGHT')
    }
    activated = !activated
})
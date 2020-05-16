let activated = false

chrome.runtime.onMessage.addListener(request => {
    if (request == "DEACTIVATE") {
        activated = false
    }
    if (request.message && request.message == "DATA") {
        request.data.forEach(element => {
            // chrome.tabs.create({ url: element, active: true })
            chrome.downloads.download({ url: element })
        })
    }
})

chrome.commands.onCommand.addListener(function (command) {
    if (command == "toggle-highlight-content") {
        // gets the current tab and passes it directly into the toggle function
        chrome.tabs.query({ active: true }, tabs => {
            if (tabs.length > 0) {
                toggle(tabs[0])
            }
        })
    }
});


chrome.browserAction.onClicked.addListener((tab) => {
    toggle(tab)
})

const toggle = (tab) => {
    if (activated) {
        chrome.tabs.sendMessage(tab.id, 'DEACTIVATE_CONTENT_HIGHLIGHT')
    } else {
        chrome.tabs.sendMessage(tab.id, 'ACTIVATE_CONTENT_HIGHLIGHT')
    }
    activated = !activated
}
let activated = false
window.blobs = []

chrome.runtime.onMessage.addListener(request => {
    if (request == "DEACTIVATE") {
        activated = false
        chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, "DEACTIVATE_CONTENT_HIGHLIGHT")
            })
        })
    }
    if (request.message && request.message == "DATA") {
        let data = new Set(request.data)
        console.log("RECEIVED DATA:", data)
        data.forEach(element => {
            // chrome.tabs.create({ url: element, active: true })
            if (!element.includes("blob:")) {
                chrome.downloads.download({ url: element })
            } else {
                chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
                    const tab = tabs[0]
                    chrome.tabs.sendMessage(tab.id, "ERROR_DOWNLOAD_BLOB")
                })
            }
        })
    }
})

chrome.commands.onCommand.addListener(function (command) {
    if (command == "toggle-highlight-content") {
        // gets the current tab and passes it directly into the toggle function
        chrome.tabs.query({}, tabs => {
            if (tabs.length > 0) {
                toggle(tabs)
            }
        })
    }
});

const toggle = (tabs) => {
    tabs.forEach(tab => {
        if (activated) {
            chrome.tabs.sendMessage(tab.id, 'DEACTIVATE_CONTENT_HIGHLIGHT')
        } else {
            chrome.tabs.sendMessage(tab.id, 'ACTIVATE_CONTENT_HIGHLIGHT')
        }
    })
    activated = !activated
}

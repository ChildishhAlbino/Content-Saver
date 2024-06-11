let creating; // A global promise to avoid concurrency issues
export async function setupOffscreenDocument(path) {
    // Check all windows controlled by the service worker to see if one
    // of them is the offscreen document with the given path
    const offscreenUrl = chrome.runtime.getURL(path);
    console.log({ offscreenUrl });
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });
    console.log({ existingContexts });

    if (existingContexts.length > 0) {
        return;
    }

    // create offscreen document
    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: path,
            reasons: ['LOCAL_STORAGE'],
            justification: 'Access local storage',
        });
        await creating;
        console.log({ creating });
        creating = null;
    }
}
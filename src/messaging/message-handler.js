import { validateMessage } from "../util";

export function listenForMessages(handlerName, referenceHandlers, logAllReceipts, fallbackHandler) {
    console.log(`${handlerName} is now listening for messages...`);
    chrome.runtime.onMessage.addListener(async (request, sender) => {
        if (logAllReceipts) {
            console.log({ handlerName, sender, request });
        }
        if (validateMessage(request, handlerName)) {
            console.log(`Handler: ${handlerName} has received a message...`, { sender, request });
            const handler = referenceHandlers[request.REFERENCE];
            if (handler) {
                handler(request);
            } else {
                console.log("No Handler Registered", request.REFERENCE);
            }
        }

        if (fallbackHandler) {
            await fallbackHandler(request, sender)
        }
    })
}
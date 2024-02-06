import { preventClicks, setupPreventClicks } from "./control";

// Options for the observer (which mutations to observe)
const config = { attributes: false, childList: true, subtree: true };

export function observe(observer) {
    // Start observing the target node for configured mutations
    observer.observe(document.documentElement, config);
}

// Callback function to execute when mutations are observed
function callback(mutationList, observer) {
    for (const mutation of mutationList) {
        if (mutation.type === "childList") {
            const { addedNodes } = mutation
            if (addedNodes.length > 0) {
                for (const addedNode of addedNodes) {

                    const tagIsATag = addedNode.tagName === "a"
                    const aTagChildren = addedNode.childNodes.length > 0 ? addedNode.querySelectorAll("a") : []
                    const hasChildATag = aTagChildren.length > 0
                    // console.log({ addedNode, tagIsATag, aTagChildren, hasChildATag })
                    if (tagIsATag) {
                        setupPreventClicks(addedNode)
                        addedNode.addEventListener("click", preventClicks);
                        addedNode.parentElement.addEventListener("click", preventClicks);
                    }

                    if (hasChildATag) {
                        aTagChildren.forEach(setupPreventClicks);
                    }
                }
            }
        }
    }
};



export function createMutationObserver() {
    // Create an observer instance linked to the callback function
    const observer = new MutationObserver(callback);
    return observer
}



export function isSpecialClick(event) {
    const specialClick = (event.type === 'click' || event.type === EVENT_TYPE) && SOFT_TOGGLE
    return specialClick
}
export const EVENT_TYPE = "mousedown";
export let SOFT_TOGGLE = false

export const preventClicks = (event) => {
    var x = event.clientX,
        y = event.clientY;
    // on mouse down print out the element with the mouse is currently over
    var elementsFromP = document.elementsFromPoint(x, y);
    let button = elementsFromP.find((element) => {
        return element.tagName === "BUTTON";
    });
    if (!button && !isSpecialClick(event)) {
        console.log("prevented clicks");
        event.preventDefault();
        event.stopPropagation();
    }
};

export function setupPreventClicks(element) {
    console.log("Preventing clicks on element...", { element });
    element.addEventListener("click", preventClicks);
    element.parentElement.addEventListener("click", preventClicks);
}

export function disableATags() {
    document.querySelectorAll("a").forEach(setupPreventClicks)
}

export function flipSoftToggle() {
    SOFT_TOGGLE = !SOFT_TOGGLE
}

export function isSoftToggle() {
    return SOFT_TOGGLE
}
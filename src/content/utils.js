const MEDIA_URL_REGEX = /(http[s]*:\/\/)([a-z\-_0-9\/.]+)\.([a-z.]{2,3})\/([a-z0-9\-_\/._~:?#\[\]@!$&'()*+,;=%]*)([a-z0-9]+\.)(jpg|jpeg|png|webp|mp4|avi|webm)/gi

export function elementHasValidContent(element) {
    switch (element.tagName) {
        case "VIDEO":
            return true;
        case "IMG":
            return true;
        case "DIV":
            return !!element.style.backgroundImage;
        default:
            return false;
    }
}

export function doesATagHasValidContent(element) {
    const elementHasValidHref = !!element.href
    const elementHrefIsValidMediaUrl = MEDIA_URL_REGEX.test(element.href)
    // console.log({ element, elementHasValidHref, elementHrefIsValidMediaUrl });
    return elementHasValidHref && elementHrefIsValidMediaUrl
}

export function preventContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
};

export function createOverlayElement(parent, className, targetElement, filteredSources) {
    parent.addEventListener("contextmenu", preventContextMenu);
    let overlayElement = document.createElement("span");
    overlayElement.className += className;
    overlayElement.style.height = `${targetElement.offsetHeight}px`;
    overlayElement.style.width = `${targetElement.offsetWidth}px`;
    overlayElement.contentSaverTargets = filteredSources;
    overlayElement.clearListeners = () => {
        parent.removeEventListener("contextmenu", preventContextMenu);
    };
    // console.log({ div: overlayDiv, t: overlayDiv.contentSaverTargets });
    parent.insertBefore(overlayElement, targetElement);
    return overlayElement
}
import { REQUEST_DOWNLOAD } from "../commands";
import { SOURCES } from "../sources";
import { createMessage } from "../util";
import {
  SOFT_TOGGLE_KEYCODE,
  TOGGLED_OFF_HIGHLIGHT_CLASS_NAME,
  TOGGLED_ON_HIGHLIGHT_CLASS_NAME,
  TOGGLE_KEY_PRESSES,
  SELECTED_CLASS_NAME,
} from "./constants";
import {
  EVENT_TYPE,
  preventClicks,
  disableATags,
  flipSoftToggle,
  isSoftToggle,
  isAllowedButton,
} from "./control";
import { createMutationObserver, observe } from "./observer";

const OBSERVER = createMutationObserver();

let currentHighlightClassName = TOGGLED_ON_HIGHLIGHT_CLASS_NAME;

let cursorX = null;
let cursorY = null;
let active = false;
let overlays = [];

document.addEventListener("keydown", (event) => {
  const { key } = event;
  if (active) {
    if (key === SOFT_TOGGLE_KEYCODE) {
      flipSoftToggle()
      clearHoverCSS();
      currentHighlightClassName = isSoftToggle()
        ? TOGGLED_OFF_HIGHLIGHT_CLASS_NAME
        : TOGGLED_ON_HIGHLIGHT_CLASS_NAME;
    }

    if (TOGGLE_KEY_PRESSES.includes(key)) {
      event.preventDefault();
      event.stopPropagation();
      console.log({ key, event });
      const filtered = getContentFromPoint(cursorX, cursorY);
      if (filtered != null) {
        selectContent(filtered);
      }
    }
  }
});

function clickOnContent(event) {
  const { target, clientX, clientY } = event;
  console.log({
    targetTagName: target.tagName,
    csTargets: target.contentSaverTargets,
  });
  const buttonIsAllowed = isAllowedButton(event)
  if (target.contentSaverTargets && buttonIsAllowed) {
    event.preventDefault();
    event.stopPropagation();
    const filtered = getContentFromPoint(clientX, clientY);
    if (filtered != null) {
      selectContent(filtered);
    }
  }
}

chrome.runtime.onMessage.addListener((request) => {
  if (request === "ACTIVATE_CONTENT_HIGHLIGHT") {
    active = true;
    document.addEventListener(EVENT_TYPE, clickOnContent);
    document.addEventListener("mousemove", hoverContent);
    disableATags();
    if (!document.body.className.includes(" capture-cursor")) {
      document.body.className += " capture-cursor";
    }
    observe(OBSERVER);
  }

  if (request === "DEACTIVATE_CONTENT_HIGHLIGHT") {
    deactivate();
  }

  if (request === "ERROR_DOWNLOAD_BLOB") {
    alert("Could not download blob url, sorry.");
  }
});

const toSelector = (className) => {
  return `.${className}`;
};

const getContentFromPoint = (x, y) => {
  // on mouse down print out the element with the mouse is currently over
  var elementsFromP = document.elementsFromPoint(x, y);
  let button = elementsFromP.find((element) => {
    return element.tagName === "BUTTON";
  });
  if (!button) {
    let filtered = elementsFromP.filter((element) => {
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
    });
    var firsts = [
      filtered.find((element) => {
        return element.tagName == "VIDEO";
      }),
      filtered.find((element) => {
        return element.tagName == "IMG";
      }),
      filtered.find((element) => {
        return ["DIV", "SPAN"].includes(element.tagName);
      }),
    ];
    filtered = firsts.filter((element) => {
      return element != null;
    });
    return filtered;
  }
  return null;
};

const hoverContent = (event) => {
  cursorX = event.clientX;
  cursorY = event.clientY;
  const filtered = getContentFromPoint(cursorX, cursorY);
  if (filtered != null && filtered.length > 0) {
    const filteredSources = getMediaSourcesFromHoveredElements(
      filtered.filter((item) => !!item)
    );
    console.log({ filteredSources });
    clearHoverCSS();
    filtered.forEach((element) => {
      const parent = element.parentElement;
      const childOfClass = parent.querySelector(
        toSelector(currentHighlightClassName)
      );
      if (!childOfClass) {
        parent.addEventListener("contextmenu", preventContextMenu);
        let div = document.createElement("span");
        div.className += currentHighlightClassName;
        div.style.height = `${element.offsetHeight}px`;
        div.style.width = `${element.offsetWidth}px`;
        div.contentSaverTargets = filteredSources;
        div.clearListeners = () => {
          parent.removeEventListener("contextmenu", preventContextMenu);
        };
        console.log({ div, t: div.contentSaverTargets });
        parent.appendChild(div);
      }
    });
  }
};

const isSelectedElement = (element) => {
  const parent = element.parentElement;
  console.log({ element, parent });
  const grandparent = parent.parentElement;
  const childOfParentClass = parent.querySelector(
    toSelector(SELECTED_CLASS_NAME)
  );
  const childOfGrandparentClass = grandparent.querySelector(
    toSelector(SELECTED_CLASS_NAME)
  );
  return childOfParentClass || childOfGrandparentClass;
};

const selectContent = (filtered) => {
  const notHighlighted = filtered.filter((element) => {
    return !isSelectedElement(element);
  });

  console.log("notHighlighted", notHighlighted);

  const highlighted = filtered.filter((element) => {
    return isSelectedElement(element);
  });

  console.log("highlighted", highlighted);

  // if item is selected already, toggle it off
  // if item is not selected, toggle it on
  addSelectedOverlay(notHighlighted);
  console.log("Removing items from list", highlighted);
  removeSelectedOverlay(highlighted);
};

const addSelectedOverlay = (selected) => {
  let filtered = selected;

  const firsts = [
    filtered.find((element) => {
      return element.tagName === "IMG";
    }),
    filtered.find((element) => {
      return element.tagName === "VIDEO";
    }),
    filtered.find((element) => {
      return element.tagName !== "IMG" && element.tagName !== "VIDEO";
    }),
  ];
  filtered = firsts.filter((element) => {
    return element != null;
  });

  const element = filtered[0];
  if (element) {
    const filteredSources = getMediaSourcesFromHoveredElements(
      filtered.filter((item) => !!item)
    );
    const parent = element.parentElement;
    let div = document.createElement("span");
    div.className += SELECTED_CLASS_NAME;
    div.contentSaverTargets = filteredSources;
    div.style.height = `${element.offsetHeight}px`;
    div.style.width = `${element.offsetWidth}px`;
    parent.appendChild(div);
    overlays.push(div);
    console.log("overlays", overlays.length);
  }
};

const removeSelectedOverlay = (highlighted) => {
  highlighted.forEach((element) => {
    const parent = element.parentElement;
    const selector = parent.querySelector(toSelector(SELECTED_CLASS_NAME));
    if (selector) {
      selector.parentElement.removeChild(selector);
      overlays = overlays.filter((element) => element !== selector);
      console.log("overlays", overlays.length);
    }
  });
};

const isMultiplier = (item) => item.includes("x") || item.includes("X");

const replaceValues = (item, toBeRemoved) => {
  let perpetual = item;
  toBeRemoved.forEach((value) => {
    perpetual = item.replace(value, "");
  });
  return perpetual;
};

function getSrcSetURL(element) {
  const { srcset } = element;
  console.log(element.srcset);
  const urls = srcset.split(",");
  const groups = urls.map((item) => item.split(" "));
  console.log(groups);
  const items = groups.map(([url, size]) => {
    console.log(url, size);
    const replacedString = replaceValues(size, ["x", "X", "w", "W"]);
    console.log(replacedString);
    const numericSize = parseInt(replacedString);
    return { url, size: numericSize, isMultiplier: isMultiplier(size) };
  });
  const itemsHasMultiplier = items.find((item) => item.isMultiplier) != null;
  // if multiplier
  if (itemsHasMultiplier) {
    const item = items
      .filter((item) => item.isMultiplier)
      .sort()
      .reverse()[0];
    console.log(item);
    return item.url;
  }
  // else width
  else {
    const sorted = items
      .sort((a, b) => {
        const { size: sizeA } = a;
        const { size: sizeB } = b;
        return sizeA - sizeB;
      })
      .reverse();
    const item = sorted[0];
    console.log(item);
    return item.url;
  }
}

function getMediaSourcesFromOverlays() {
  const selectedOverlays = [...overlays];
  const selectedElements = selectedOverlays
    .map((element) => element.contentSaverTargets)
    .flat();
  const mediaSources = [...new Set(selectedElements)];
  console.log({ selectedOverlays, mediaSources });
  return mediaSources;
}

const getMediaSourcesFromHoveredElements = (selectedElements) => {
  console.log("GETTING SRCS", { selectedElements });
  if (selectedElements.length > 0) {
    let srcs = selectedElements.map((element) => {
      if (element.href) {
        console.log(element.href);
        return element.href;
      }

      if (element.style.backgroundImage) {
        const pattern =
          /https?:\/\/(www.)?[-a-zA-Z0-9@:%._+~#=]{1,256}.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;
        let re = new RegExp(pattern);
        let match = element.style.backgroundImage.match(re);
        if (match && match[0]) {
          return [match[0], element.currentSrc, element.src];
        }
      }
      if (element.srcset) {
        return getSrcSetURL(element);
      }
      if (element.currentSrc) {
        console.log({ element, source: element.currentSrc });
        return element.currentSrc;
      }
      if (element.src) {
        return element.src;
      } else {
        if (element.children && element.children[0]) {
          return element.children[0].src;
        }
      }
    });
    let flat = srcs.flat().filter((item) => item !== "");
    return flat;
  }
};

const preventContextMenu = (e) => {
  e.preventDefault();
  e.stopPropagation();
};

const clearHoverCSS = () => {
  let overlays = document.querySelectorAll(
    toSelector(currentHighlightClassName)
  );
  overlays.forEach((element) => {
    if (element.clearListeners) {
      element.clearListeners();
    }
    element.parentElement.removeChild(element);
  });
};

const clearSelectedCSS = () => {
  let overlays = document.querySelectorAll(toSelector(SELECTED_CLASS_NAME));
  overlays.forEach((element) => {
    element.parentElement.removeChild(element);
  });
};

const deactivate = () => {
  active = false;
  document.removeEventListener("mousemove", hoverContent);
  document.removeEventListener(EVENT_TYPE, clickOnContent);
  OBSERVER.disconnect();
  document.querySelectorAll("a").forEach((element) => {
    element.removeEventListener("click", preventClicks);
    element.parentElement.removeEventListener("click", preventClicks);
  });
  document.body.className = document.body.className.replace(
    " capture-cursor",
    ""
  );
  const data = getMediaSourcesFromOverlays();
  console.log({ cookie: document.cookie });
  const source = `${window.location.protocol}//${window.location.hostname}/`
  var message = createMessage(
    SOURCES.CONTENT,
    SOURCES.BACKGROUND,
    { data, source, internal: false, cookie: document.cookie, },
    REQUEST_DOWNLOAD
  )
  chrome.runtime.sendMessage(message);
  overlays = [];
  clearSelectedCSS();
  clearHoverCSS();
};

import { REQUEST_DOWNLOAD } from "../commands";
import { SOURCES } from "../sources";
import { createMessage } from "../util";
import {
  SOFT_TOGGLE_KEYCODE,
  TOGGLED_OFF_HIGHLIGHT_CLASS_NAME,
  TOGGLED_ON_HIGHLIGHT_CLASS_NAME,
  TOGGLE_KEY_PRESSES,
  SELECTED_CLASS_NAME,
  INVALID_SELECTED_CLASS_NAME,
  PARTIAL_INVALID_SELECTED_CLASS_NAME,
  DETAIL_CLASS_NAME,
  OVERLAY_CLASS_NAME as OVERLAY_ROOT_CLASS_NAME,
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
import { createDetailElement, createOverlayElement, doesATagHasValidContent, elementHasValidContent } from "./utils";

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
      handleSelectContent(event, cursorX, cursorY)
    }
  }
});

function clickOnContent(event) {
  const { target, clientX, clientY } = event;
  const buttonIsAllowed = isAllowedButton(event)
  if (target.contentSaverTargets && buttonIsAllowed) {
    handleSelectContent(event, clientX, clientY)
  }
}

function handleSelectContent(event, x, y) {
  event.preventDefault();
  event.stopPropagation();
  var elementsAtMousePosition = document.elementsFromPoint(x, y);
  const filtered = getContentFromElements(elementsAtMousePosition);
  if (filtered != null) {
    selectContent(filtered);
  }
  hoverContent(event)
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

const getContentFromElements = (elementsAtMousePosition) => {
  let button = elementsAtMousePosition.find((element) => {
    return element.tagName === "BUTTON";
  });
  if (!button) {
    let filtered = elementsAtMousePosition.filter((element) => {
      return elementHasValidContent(element)
    });
    // console.log("parent search", { filtered });
    if (filtered.length == 0) {
      // console.log("Searching through child elements");
      elementloop: for (const element of elementsAtMousePosition) {
        const children = element.children
        for (const child of children) {
          const childHasValidContent = elementHasValidContent(child)
          if (childHasValidContent) {
            filtered = [child]
            break elementloop;
          }
        }
      }
      // const children = [...new Set(elementsFromP.map(element => [...element.children]).flat(Infinity))]

      // filtered = children.filter(element => elementHasValidContent(element))
    }
    // console.log("full search", { filtered, x, y });

    var firsts = [
      filtered.find((element) => {
        return element.tagName === "A";
      }),
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
  console.log("User clicked on a button", { button });
  return null;
};

let hoverOverlayExists = false

const hoverContent = (event) => {
  // this is real jank
  cursorX = event.clientX || cursorX;
  // this is real jank
  cursorY = event.clientY || cursorY;
  const elementsAtMousePosition = document.elementsFromPoint(cursorX, cursorY)
  const contentAtMousePosition = getContentFromElements(elementsAtMousePosition);

  const highlightedOverlayInChain = elementsAtMousePosition.find(element => {
    // this is jank
    return element.className.includes("_HIGHLIGHT")
  })

  if (!!highlightedOverlayInChain) {
    // console.log("Cursor is on highlight, skipping logic...")
    return
  } else if (hoverOverlayExists = true) {
    hoverOverlayExists = false
    clearHoverCSS()
  }

  if (contentAtMousePosition != null && contentAtMousePosition.length > 0) {
    const filteredSources = getMediaSourcesFromHoveredElements(
      contentAtMousePosition.filter((item) => !!item)
    );

    hoverOverlayExists = true
    contentAtMousePosition.forEach((targetElement) => {
      const parent = targetElement.parentElement;
      const childOfClass = parent.querySelector(
        toSelector(currentHighlightClassName)
      );

      const selectedOverlayInChain = elementsAtMousePosition.find(element => {
        // this is jank
        return element.className.includes("_SELECTED")
      })
      if (!childOfClass && !selectedOverlayInChain) {
        var overlayElement = createOverlayElement(parent, `${OVERLAY_ROOT_CLASS_NAME} ${currentHighlightClassName}`, targetElement, filteredSources)
        const detailElement = createDetailElement(filteredSources.length)
        overlayElement.appendChild(detailElement)
      }
    });
  }
};

const isSelectedElement = (element) => {
  const parent = element.parentElement;
  // console.log({ element, parent });
  const grandparent = parent.parentElement;
  const childOfParentClass = parent.querySelector(
    getSelectedOverlayQuerySelector()
  );
  const childOfGrandparentClass = grandparent.querySelector(
    getSelectedOverlayQuerySelector()
  );
  // console.log({ element, grandparent, childOfGrandparentClass, childOfParentClass });
  const selectedUrls = getMediaSourcesFromHoveredElements([element])
  const matchingSaverTags = childOfGrandparentClass ? childOfGrandparentClass.contentSaverTargets : []
  const joined = [...selectedUrls, ...matchingSaverTags]
  const totalItems = joined.length

  const uniqueItems = [...(new Set(joined))]
  const numUnique = uniqueItems.length

  // console.log({ selectedUrls, matchingSaverTags, totalItems, numUnique });
  // this fixes the issue where some sliders only allowed 1 element to be selected
  return childOfParentClass || (childOfGrandparentClass && (numUnique == selectedUrls))
};

const selectContent = (filtered) => {
  const notHighlighted = filtered.filter((element) => {
    return !isSelectedElement(element);
  });

  const highlighted = filtered.filter((element) => {
    return isSelectedElement(element);
  });

  // if item is selected already, toggle it off
  // if item is not selected, toggle it on
  clearHoverCSS()
  addSelectedOverlay(notHighlighted);
  // console.log("Removing items from list", highlighted);
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

  const targetElement = filtered[0];
  if (targetElement) {
    const filteredSources = getMediaSourcesFromHoveredElements(
      filtered.filter((item) => !!item)
    ).filter(item => !!item)
    const numTotal = filteredSources.length
    const detailElement = createDetailElement(numTotal)
    const blobUrls = filteredSources.filter(source => source.includes("blob:"))
    const numInvalid = blobUrls.length
    const numValid = numTotal - numInvalid
    let className = SELECTED_CLASS_NAME

    if (numInvalid == numTotal) {
      className = INVALID_SELECTED_CLASS_NAME
      detailElement.innerText = `0`
    } else if (numInvalid != 0) {
      className = PARTIAL_INVALID_SELECTED_CLASS_NAME
      detailElement.innerText = `${numValid}V + ${numInvalid}I`
    }

    // console.log({ blobUrls, filteredSources, className });
    const parent = targetElement.parentElement
    console.log("Adding selected overlay to element", { targetElement, filteredSources, parent })
    const overlayElement = createOverlayElement(
      parent,
      `${OVERLAY_ROOT_CLASS_NAME} ${className}`,
      targetElement,
      filteredSources
    )
    overlayElement.appendChild(detailElement)
    overlays.push(overlayElement)
  }
};

function getSelectedOverlayQuerySelector() {
  const classNames = [SELECTED_CLASS_NAME, INVALID_SELECTED_CLASS_NAME, PARTIAL_INVALID_SELECTED_CLASS_NAME]
  const selectors = classNames.map(toSelector)
  const querySelector = selectors.join(", ")
  return querySelector
}

const removeSelectedOverlay = (highlighted) => {
  highlighted.forEach((element) => {
    const parent = element.parentElement;

    const selector = parent.querySelector(getSelectedOverlayQuerySelector());
    if (selector) {
      selector.parentElement.removeChild(selector);
      overlays = overlays.filter((element) => element !== selector);
      // console.log("overlays", overlays.length);
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
  // console.log({ selectedOverlays, mediaSources });
  return mediaSources;
}

const getMediaSourcesFromHoveredElements = (selectedElements) => {
  // console.log("GETTING SRCS", { selectedElements });
  if (selectedElements.length > 0) {
    let sources = selectedElements.map(getSourcesFromElement);
    const flat = sources.flat(Infinity).filter((item) => item !== "");
    // replace .md.* urls with source file
    const replaced = flat.map(src => {
      if (!src) {
        return src
      }
      return src.replace(/.md(.*)/g, "$1")
    })
    // console.log({ srcs: replaced })
    return replaced;
  }
};

function getSourcesFromElement(element) {
  const sources = []
  if (element.href) {
    sources.push(element.href)
  }

  if (element.style.backgroundImage) {
    const pattern =
      /https?:\/\/(www.)?[-a-zA-Z0-9@:%._+~#=]{1,256}.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;
    let re = new RegExp(pattern);
    let match = element.style.backgroundImage.match(re);
    if (match && match[0]) {
      sources.push([match[0], element.currentSrc, element.src])
    }
  }
  if (element.srcset) {
    sources.push(getSrcSetURL(element))
  }
  if (element.currentSrc) {
    sources.push(element.currentSrc)
  }
  if (element.src) {
    sources.push(element.src);
  } else {
    if (element.children && element.children[0]) {
      sources.push(element.children[0].src)
    }
  }

  const parentElement = element.parentElement

  const parentElementIsNotNull = !!parentElement
  const parentElementIsATag = parentElement.tagName == "A"
  const aTagHasValidContent = doesATagHasValidContent(parentElement)
  console.log({
    parentElementIsNotNull, parentElementIsATag, aTagHasValidContent, ref: parentElement.href
  });

  // Some sites have the full-size image url in the parent A tag
  if (parentElementIsNotNull && parentElementIsATag && aTagHasValidContent) {
    sources.push(parentElement.href)
  }

  return [...new Set(sources)]
};

const clearHoverCSS = () => {
  // console.log("Clearing hover css")
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
  let overlays = document.querySelectorAll(getSelectedOverlayQuerySelector());
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

const eventType = "mousedown";
let softToggle = false;

const selectedClassName = "CONTENT_SAVER_SELECTED"
const activeHighlightClassName = "CONTENT_SAVER_HIGHLIGHT"
const inactiveHighlightClassName = "CONTENT_SAVER_INACTIVE_HIGHLIGHT"
let highlightClassName = activeHighlightClassName

let cursorX = null
let cursorY = null

let active = false

let overlays = []

document.addEventListener('keydown', (event) => {
  const key = event.key
  console.log("TOAD KEY", key)
  if (active) {
    if (key === "`") {
      softToggle = !softToggle;
      clearHoverCSS()
      highlightClassName = softToggle ? inactiveHighlightClassName : activeHighlightClassName
    }

    if (key === " ") {
      event.preventDefault();
      event.stopPropagation();
      console.log("KEY", "SPACE")
      const filtered = getContentFromPoint(cursorX, cursorY)
      if (filtered != null) {
        selectContent(filtered)
      }
    }
  }
});

chrome.runtime.onMessage.addListener((request) => {
  if (request === "ACTIVATE_CONTENT_HIGHLIGHT") {
    active = true
    document.addEventListener(eventType, clickOnContent);
    document.addEventListener("mousemove", hoverContent);
    nodeAddedToDom(null);
    if (!document.body.className.includes(" capture-cursor")) {
      document.body.className += " capture-cursor";
    }
    document.addEventListener("DOMNodeInserted", nodeAddedToDom);
    // document.addEventListener("DOMNodeRemoved", nodeRemovedFromDom);
  }

  if (request === "DEACTIVATE_CONTENT_HIGHLIGHT") {
    deactivate();
  }

  if (request === "ERROR_DOWNLOAD_BLOB") {
    alert("Could not download blob url, sorry.");
  }
});

const toSelector = (className) => {
  return `.${className}`
}

const nodeAddedToDom = (event) => {
  document.querySelectorAll("a").forEach((element) => {
    element.addEventListener("click", preventClicks);
    element.parentElement.addEventListener("click", preventClicks);
  });
};

const nodeRemovedFromDom = (event) => {
  const elementToBeRemoved = event.srcElement
  if (elementToBeRemoved && elementToBeRemoved.querySelector) {
    const potentialSelectedOverlay = elementToBeRemoved.querySelector(toSelector(selectedClassName))
    if (potentialSelectedOverlay && elementToBeRemoved.parentElement) {
      console.log("TOAD REMOVED", event);
      try {
        elementToBeRemoved.contentSaverHasSavedFromRemoval = true
        elementToBeRemoved.parentElement.appendChild(elementToBeRemoved)
      } catch {
        console.error("Could not highlight parent element.")
      }
    }
  }
}

const isSpecialClick = (event) => {
  const specialClick = (event.type === 'click' || event.type === eventType) && softToggle
  return specialClick
}

const clickOnContent = (event) => {
  const target = event.target;
  console.log(target.tagName, target.contentSaverTargets);
  const specialClick = isSpecialClick(event)
  console.log("TOAD CLICK ON CONTENT", event, specialClick)
  if (target.contentSaverTargets && !isSpecialClick(event)) {
    event.preventDefault();
    event.stopPropagation();
    selectContent(target.contentSaverTargets);
  }
};

const getContentFromPoint = (x, y) => {
  // on mouse down print out the element with the mouse is currently over
  var elementsFromP = document.elementsFromPoint(cursorX, cursorY);
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
        return element.tagName != "IMG" && element.tagName != "VIDEO";
      }),
    ];
    filtered = firsts.filter((element) => {
      return element != null;
    });
    return filtered;
  }
  return null
}

const hoverContent = (event) => {
  cursorX = event.clientX,
    cursorY = event.clientY;
  const filtered = getContentFromPoint(cursorX, cursorY)
  if (filtered != null) {
    clearHoverCSS();
    filtered.forEach((element) => {
      const parent = element.parentElement;
      const childOfClass = parent.querySelector(toSelector(highlightClassName));
      if (!childOfClass) {
        parent.addEventListener("contextmenu", preventContextMenu);
        let div = document.createElement("span");
        div.className += highlightClassName;
        div.style.height = `${element.offsetHeight}px`;
        div.style.width = `${element.offsetWidth}px`;
        div.contentSaverTargets = filtered;
        div.clearListeners = () => {
          parent.removeEventListener("contextmenu", preventContextMenu);
        }
        parent.appendChild(div);
      }
    });
  }
};

const isSelectedElement = (element) => {
  const parent = element.parentElement;
  const grandparent = parent.parentElement
  const childOfParentClass = parent.querySelector(toSelector(selectedClassName));
  const childOfGrandparentClass = grandparent.querySelector(toSelector(selectedClassName));
  return childOfParentClass || childOfGrandparentClass;
}

const selectContent = (filtered) => {
  const notHighlighted = filtered.filter((element) => {
    return !isSelectedElement(element)
  });

  console.log("notHighlighted", notHighlighted);

  const highlighted = filtered.filter((element) => {
    return isSelectedElement(element)
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
      return element.tagName === "VIDEO";
    }),
    filtered.find((element) => {
      return element.tagName === "IMG";
    }),
    filtered.find((element) => {
      return element.tagName !== "IMG" && element.tagName !== "VIDEO";
    }),
  ];
  filtered = firsts.filter((element) => {
    return element != null;
  });
  filtered.forEach((element) => {
    const parent = element.parentElement;
    const childOfClass = parent.querySelector(toSelector(selectedClassName));
    if (!childOfClass) {
      let div = document.createElement("span");
      div.className += selectedClassName;
      div.contentSaverTargets = filtered;
      div.style.height = `${element.offsetHeight}px`;
      div.style.width = `${element.offsetWidth}px`;
      parent.appendChild(div);
      overlays.push(div);
      console.log("overlays", overlays.length);
    }
  });
};

const removeSelectedOverlay = (highlighted) => {
  highlighted.forEach((element) => {
    const parent = element.parentElement;
    const selector = parent.querySelector(toSelector(selectedClassName));
    if (selector) {
      selector.parentElement.removeChild(selector);
      overlays = overlays.filter(element => element !== selector)
      console.log("overlays", overlays.length);
    }
  });
};


const isMultiplier = item => item.includes('x') || item.includes("X")

const replaceValues = (item, toBeRemoved) => {
  let perpetual = item
  toBeRemoved.forEach(value => {
    perpetual = item.replace(value, "")
  })
  return perpetual
}

const getSrcs = () => {
  // const selectedOverlays = Array.from(document.querySelectorAll(toSelector(selectedClassName)))
  const selectedOverlays = overlays
  console.log("ALL SELECTED OVERLAYS", selectedOverlays)
  console.log("GETTING SRCS");
  const selectedElements = selectedOverlays.map(element => element.contentSaverTargets).flat()
  console.log(selectedElements)
  if (selectedElements.length > 0) {
    let srcs = selectedElements.map((element) => {
      if (element.style.backgroundImage) {
        const pattern =
          /https?:\/\/(www.)?[-a-zA-Z0-9@:%._+~#=]{1,256}.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;
        let re = new RegExp(pattern);
        let match = element.style.backgroundImage.match(re);
        if (match && match[0]) {
          return match[0];
        }
      }
      if (element.srcset) {
        const { srcset } = element
        console.log(element.srcset);
        const urls = srcset.split(',')
        const groups = urls.map(item => item.split(" "))
        console.log(groups);
        const items = groups.map(([url, size]) => {
          console.log(url, size);
          const replacedString = replaceValues(size, ['x', "X", "w", "W"])
          console.log(replacedString)
          const numericSize = parseInt(replacedString)
          return { url, size: numericSize, isMultiplier: isMultiplier(size) }
        })
        const itemsHasMultiplier = items.find(item => item.isMultiplier) != null
        // if multiplier
        if (itemsHasMultiplier) {
          const item = items.filter(item => item.isMultiplier).sort().reverse()[0]
          console.log(item)
          return item.url
        }
        // else width
        else {
          const sorted = items.sort((a, b) => {
            const { size: sizeA } = a
            const { size: sizeB } = b
            return sizeA - sizeB
          }).reverse()
          const item = sorted[0]
          console.log(item)
          return item.url
        }
      }
      if (element.currentSrc) {
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

    console.log("SOURCES", srcs);
    if (srcs.length > 0) {
      chrome.runtime.sendMessage({
        message: "DATA",
        source: `${window.location.protocol}//${window.location.hostname}${window.location.pathname}`,
        data: srcs,
      });
    }
  }
};

const preventContextMenu = e => {
  e.preventDefault()
  e.stopPropagation()
}


const clearHoverCSS = () => {
  let overlays = document.querySelectorAll(toSelector(highlightClassName));
  overlays.forEach((element) => {
    if (element.clearListeners) {
      element.clearListeners();
    }
    element.parentElement.removeChild(element);
  });
};

const clearSelectedCSS = () => {
  let overlays = document.querySelectorAll(toSelector(selectedClassName));
  overlays.forEach((element) => {
    element.parentElement.removeChild(element);
  });
};

const preventClicks = (event) => {
  var x = event.clientX,
    y = event.clientY;
  // on mouse down print out the element with the mouse is currently over
  var elementsFromP = document.elementsFromPoint(x, y);
  let button = elementsFromP.find((element) => {
    return element.tagName === "BUTTON";
  });
  if (!button && !isSpecialClick(event)) {
    event.preventDefault();
    event.stopPropagation();
  }
};

const deactivate = () => {
  active = false
  document.removeEventListener("mousemove", hoverContent);
  document.removeEventListener(eventType, clickOnContent);
  document.querySelectorAll("a").forEach((element) => {
    element.removeEventListener("click", preventClicks);
    element.parentElement.removeEventListener("click", preventClicks);
  });
  document.body.className = document.body.className.replace(
    " capture-cursor",
    ""
  );
  document.removeEventListener("DOMNodeInserted", nodeAddedToDom);
  // document.removeEventListener("DOMNodeRemoved", nodeRemovedFromDom);

  getSrcs();
  clearSelectedCSS();
  clearHoverCSS();
};

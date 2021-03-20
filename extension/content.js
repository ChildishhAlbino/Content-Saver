// const activated = true
let selectedElements = [];

chrome.runtime.onMessage.addListener((request) => {
    if (request === "ACTIVATE_CONTENT_HIGHLIGHT") {
        document.addEventListener("mousedown", selectContent);
        nodeAddedToDom(null)
        if(!document.body.className.includes(" capture-cursor")){
            document.body.className += " capture-cursor"
        }
        document.addEventListener('DOMNodeInserted', nodeAddedToDom)
    }

    if (request === "DEACTIVATE_CONTENT_HIGHLIGHT") {
        deactivate();
    }

    if (request === "ERROR_DOWNLOAD_BLOB") {
        alert("Could not download blob url, sorry.");
    }
});

const nodeAddedToDom = (event) => {
    console.log("NODE ADDED TO DOM")
    document.querySelectorAll("a").forEach(element => {
        element.addEventListener("click", preventClicks)
        element.parentElement.addEventListener("click", preventClicks)
    })
}

const preventClicks = (event) => {
    event.preventDefault()
    event.stopPropagation()
}

const deactivate = () => {
    document.removeEventListener("mousedown", selectContent);
    document.querySelectorAll("a").forEach(element => {
        element.removeEventListener("click", preventClicks)
        element.parentElement.removeEventListener("click", preventClicks)
    })
    document.body.className = document.body.className.replace(" capture-cursor", "")
    document.removeEventListener('DOMNodeInserted', nodeAddedToDom)
    getSrcs()
    clearSelectedCSS();
};


const selectContent = (event) => {
    console.log(event)
    event.stopPropagation()
    event.preventDefault()
    let x = event.clientX,
        y = event.clientY;
    // on mouse down print out the element with the mouse is currently over
    let elementsFromP = document.elementsFromPoint(x, y);
    console.log(elementsFromP)
    let button = elementsFromP.find(element => {
        return element.tagName === "BUTTON"
    })
    if(!button) {
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

        const notHighlighted = filtered.filter(element => {
            const parent = element.parentElement;
            const childOfClass = parent.querySelector(".CONTENT_SAVER_OVERLAY");
            return !childOfClass
        })

        console.log("notHighlighted", notHighlighted)

        const highlighted = filtered.filter(element => {
            const parent = element.parentElement;
            return parent.querySelector(".CONTENT_SAVER_OVERLAY")
        })

        console.log("highlighted", highlighted)

        // if item is selected already, toggle it off
        // if item is not selected, toggle it on
        highlightContent(notHighlighted)
        highlighted.forEach(element => {
            const parent = element.parentElement;
            const selector = parent.querySelector(".CONTENT_SAVER_OVERLAY")
            if(selector){
                selector.parentElement.removeChild(selector);
            }
            selectedElements = selectedElements.filter(e => {
                return !element.contains(e)
            })
        })
        console.log("SELECTED", selectedElements)
    }
}

const highlightContent = (selected) => {

    let filtered = selected

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
    console.log("FIRSTS", firsts);
    filtered = firsts.filter((element) => {
        return element != null;
    });
    filtered.map(item => {
        if (!selectedElements.includes(item)) {
            return item
        }
    })
    // clearSelectedCSS();
    selectedElements = [...selectedElements, ...filtered];
    filtered.forEach((element) => {
        const parent = element.parentElement;
        const childOfClass = parent.querySelector(".CONTENT_SAVER_OVERLAY");
        if (!childOfClass) {
            let div = document.createElement("span");
            div.className += "CONTENT_SAVER_OVERLAY";
            div.style.height = `${element.offsetHeight}px`;
            div.style.width = `${element.offsetWidth}px`;
            parent.appendChild(div);
        }
    });
    console.log("SELECTED", selectedElements)
};

const clearSelectedCSS = () => {
    let overlays = document.querySelectorAll(".CONTENT_SAVER_OVERLAY");
    overlays.forEach((element) => {
        element.parentElement.removeChild(element);
    });
};

const getSrcs = () => {
    console.log("GETTING SRCS")
    console.log("SELECTED ELEMENTS", selectedElements)
    if (selectedElements.length > 0) {
        let srcs = selectedElements.map((element) => {
            if (element.style.backgroundImage) {
                const pattern = /https?:\/\/(www.)?[-a-zA-Z0-9@:%._+~#=]{1,256}.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;
                let re = new RegExp(pattern);
                let match = element.style.backgroundImage.match(re);
                if (match && match[0]) {
                    return match[0];
                }
            }
            if (element.currentSrc) {
                return element.currentSrc;
            }
            if (element.src) {
                if (element.tagName === "VIDEO") {
                    console.log(element);
                }
                return element.src;
            } else {
                if (element.children && element.children[0]) {
                    return element.children[0].src;
                }
            }
        });

        console.log("SOURCES", srcs);
        selectedElements = []
        if (srcs.length > 0) {
            chrome.runtime.sendMessage({
                message: "DATA",
                source: `${window.location.protocol}//${window.location.hostname}${window.location.pathname}`,
                data: srcs,
            });
        }
    }
};

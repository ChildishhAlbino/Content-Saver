// const activated = true
let selectedElements = []

chrome.runtime.onMessage.addListener(request => {
    selectedElements = []
    if (request == "ACTIVATE_CONTENT_HIGHLIGHT") {
        document.addEventListener("mousemove", highlightContent)
        document.addEventListener("mousedown", getSrcs)
    }
    if (request == "DEACTIVATE_CONTENT_HIGHLIGHT") {
        deactivate("EXTERNAL")
    }
    if (request == "ERROR_DOWNLOAD_BLOB") {
        alert("Could not download blob url, sorry.")
    }
})


const deactivate = (source) => {
    document.removeEventListener("mousemove", highlightContent)
    document.removeEventListener("mousedown", getSrcs)
    if (source == "INTERNAL") {
        chrome.runtime.sendMessage("DEACTIVATE")
    }
    clearSelectedCSS()
}

const highlightContent = (event) => {
    var x = event.clientX, y = event.clientY
    // on mouse down print out the element with the mouse is currently over
    var elementsFromP = document.elementsFromPoint(x, y)
    var filtered = elementsFromP.filter((element) => {
        return element.tagName == "IMG" || element.tagName == "VIDEO"
    })
    // console.log(filtered)
    var firsts = [filtered.find((element) => {
        return element.tagName == "IMG"
    }), filtered.find((element) => {
        return element.tagName == "VIDEO"
    })]
    console.log("FIRSTS", firsts)
    filtered = firsts.filter((element) => {
        return element != null
    })
    clearSelectedCSS()
    selectedElements = filtered
    filtered.forEach(element => {
        const parent = element.parentElement
        const childOfClass = parent.querySelector(".CONTENT_SAVER_OVERLAY")
        if (!childOfClass) {
            let div = document.createElement("span")
            div.className += "CONTENT_SAVER_OVERLAY"
            div.style.height = `${element.offsetHeight}px`
            div.style.width = `${element.offsetWidth}px`
            parent.appendChild(div)
        }
    })
}

const clearSelectedCSS = () => {
    let overlays = document.querySelectorAll(".CONTENT_SAVER_OVERLAY")
    overlays.forEach(element => {
        element.parentElement.removeChild(element)
    })
}

const getSrcs = (event) => {
    if (selectedElements.length > 0) {
        var srcs = selectedElements.map((element) => {
            if (element.src) {
                return element.src
            } else {
                return element.children[0].src
            }
        })
        console.log("SOURCES", srcs)
        if (srcs.length > 0) {
            chrome.runtime.sendMessage({ message: "DATA", data: srcs })
        }
    }
    deactivate("INTERNAL")
}
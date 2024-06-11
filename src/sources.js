const POPUP_VAL = "POPUP";
const CONTENT_VAL = "CONTENT";
const BACKGROUND_VAL = "BACKGROUND";
const OFFSCREEN_VAL = "OFFSCREEN"
const SOURCES = Object.freeze({
    "POPUP": POPUP_VAL,
    "CONTENT": CONTENT_VAL,
    "BACKGROUND": BACKGROUND_VAL,
    [OFFSCREEN_VAL]: OFFSCREEN_VAL
})

const validSources = Object.values(SOURCES)

function validateSource(value) {
    return validSources.includes(value)
}

module.exports = {
    SOURCES,
    validateSource
}
import { write, get, clear } from "./store"
const { DateTime } = require("luxon");

export const writeTimeStamp = (key, value) => {
    write(key, value.toISO())
}

export const getTimeStamp = (key) => {
    const value = get(key)
    if (value) {
        return DateTime.fromISO(value)
    }
    return value
}

export const deleteTimeStamp = (key) => {
    clear(key)
}
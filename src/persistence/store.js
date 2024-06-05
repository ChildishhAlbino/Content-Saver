export const write = async (key, data) => {
    try {
        await chrome.storage.local.set({ [key]: data });
        return data
    } catch (error) {
        console.error(error);
        throw error;
    }
}

export const get = async (key) => {
    if (key) {
        const value = await chrome.storage.local.get(key)
        if (JSON.stringify(value) === "{}") return null
        return value[key]
    } else {
        const allValues = await chrome.storage.local.get(null)
        return Object.freeze({ ...allValues });
    }
}

const clearAll = async () => {
    await chrome.storage.local.clear(null)
}

const clearKey = async (key) => {
    try {
        await chrome.storage.local.set({ [key]: {} });
    } catch (error) {
        console.error(error);
        throw error;
    }
}

export const clear = async (key) => {
    if (key) {
        await clearKey(key);
    } else {
        clearAll()
    }

}
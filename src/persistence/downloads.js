import { write, get, clear } from "./store"

export const writeDownloadItem = (key, status) => {
    const existing = get(key)
    if (!existing) {
        newItem(key)
    }
    write(key, JSON.stringify(status))
}

export const getDownloadItem = (key) => {
    return JSON.parse(get(key) || null)
}

export const getAllDownloads = () => {
    const items = JSON.parse(get("downloads") || '[]')
    return items
}

export const getHydratedDownloads = () => {
    const entries = getAllDownloads().map((download) => {
        const details = getDownloadItem(download)
        return details ? [download, details] : null
    }).filter(item => item != null)
    return Object.fromEntries(entries) || {}
}

const newItem = (itemId) => {
    const downloads = getAllDownloads()
    downloads.push(itemId)
    writeDownloads(downloads)
}

const writeDownloads = (downloads) => {
    write("downloads", JSON.stringify(downloads));
}

export const deleteDownload = (key) => {
    clear(key)
    const remaining = getAllDownloads().filter(item => item !== key)
    writeDownloads(remaining)
}

export const clearAllDownloads = () => {
    const downloads = getAllDownloads()
    writeDownloads([])
    downloads.forEach(deleteDownload)
}
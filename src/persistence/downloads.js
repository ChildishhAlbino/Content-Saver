import { write, get, clear } from "./store"

export const writeDownloadItem = async (key, status) => {
    const existing = await get(key)
    if (!existing) {
        newItem(key)
    }
    write(key, JSON.stringify(status))
}

export const getDownloadItem = async (key) => {
    return await get(key)
}

export const getAllDownloads = async () => {
    const items = await get("downloads")
    return items
}

export const getHydratedDownloads = async () => {
    const rawPromises = getAllDownloads().map(async (download) => {
        const details = await getDownloadItem(download)
        return details ? [download, details] : null
    }).filter(item => item != null)
    const entries = await Promise.all(rawPromises)
    return Object.fromEntries(entries) || {}
}

const newItem = async (itemId) => {
    const downloads = await getAllDownloads()
    downloads.push(itemId)
    await writeDownloads(downloads)
}

const writeDownloads = async (downloads) => {
    await write("downloads", JSON.stringify(downloads));
}

export const deleteDownload = async (key) => {
    await clear(key)
    const remaining = await getAllDownloads().filter(item => item !== key)
    await writeDownloads(remaining)
}

export const clearAllDownloads = async () => {
    const downloads = await getAllDownloads()
    await writeDownloads([])
    await Promise.all(downloads.map(deleteDownload))
}
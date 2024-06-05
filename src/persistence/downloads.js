import { write, get, clear } from "./store"

export const writeDownloadItem = async (key, status) => {
    console.log({ key, status });
    const existing = await get(key)
    if (!existing) {
        await newItem(key)
    }
    await write(key, JSON.stringify(status))
}

export const getDownloadItem = async (key) => {
    return await get(key)
}

export const getAllDownloads = async () => {
    return (await get("downloads")) || []
}

export const getHydratedDownloads = async () => {
    const downloads = await getAllDownloads()
    const rawPromises = downloads.map(async (download) => {
        const details = await getDownloadItem(download)
        return details ? [download, details] : null
    }).filter(item => item != null)
    const entries = await Promise.all(rawPromises)
    const value = Object.fromEntries(entries) || {}
    return value
}

const newItem = async (itemId) => {
    const downloads = await getAllDownloads()
    downloads.push(itemId)
    await writeDownloads(downloads)
}

const writeDownloads = async (downloads) => {
    await write("downloads", downloads);
}

export const deleteDownload = async (key) => {
    await clear(key)
    const remaining = (await getAllDownloads()).filter(item => item !== key)
    await writeDownloads(remaining)
}

export const clearAllDownloads = async () => {
    const downloads = await getAllDownloads()
    await writeDownloads([])
    await Promise.all(downloads.map(deleteDownload))
}
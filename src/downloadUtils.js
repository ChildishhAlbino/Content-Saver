export const DOWNLOAD_STATUS = Object.freeze({
    PENDING: 'PENDING',
    SUCCESS: 'SUCCESS',
    ERROR: 'ERROR',
})

export function createDownloadItem(
    totalSize,
    downloaded,
    status,
    meta
) {
    return {
        totalSize,
        downloaded,
        status,
        metadata: meta
    }
}
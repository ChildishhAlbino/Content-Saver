import React from 'react';
import { DOWNLOAD_STATUS } from '../../downloadUtils';
import { DeleteItemButton, DownloadAllButton } from '../buttons.jsx'
import './downloadItem.scss'
const { DateTime } = require("luxon");

function isImage(contentType) {
    return contentType.includes("image/")
}

function isVideo(contentType) {
    return contentType.includes("video/")
}

function getJSXForElement(elementDetails, hideThumbnails) {
    const { metadata } = elementDetails
    if (metadata?.contentType) {
        const { url: fullUrl, contentType, previewUrl } = metadata
        const elementIsImg = isImage(contentType)
        const elementIsVideo = isVideo(contentType)
        const className = hideThumbnails ? "hide-thumbnail" : ""
        const url = previewUrl || fullUrl
        if (elementIsVideo) {
            return (<video autoPlay loop className={className} muted>
                <source src={url} />
            </video>)
        }
        if (elementIsImg) {
            return (
                <img className={className} src={url} />
            )
        }
        return null
    }
    return null
}

export const DownloadItem = ({ element, details, hideThumbnails, downloadItem, trashButtonAction }) => {
    const { status, metadata, downloaded, totalSize } = details
    const isPending = status === DOWNLOAD_STATUS.PENDING
    console.log({ status, isPending, element, details });
    const { reqDateTime } = metadata
    const itemReqDateTime = reqDateTime ? DateTime.fromISO(reqDateTime).toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS) : null
    console.log({ reqDateTime, itemReqDateTime });

    const fileSize = totalSize?.toFixed(2)

    return (
        <div key={element} className="file-container">
            <div className="file-container-content">
                <div>
                    <h3>{metadata?.fileName}</h3>
                    <h4>{totalSize ? `${fileSize}mb` : "File size not available..."}</h4>
                    {downloaded && <>
                        <input type="range" disabled={true} value={downloaded} id="downloadPercent" />
                        <label htmlFor="downloadPercent">{downloaded}%</label>
                    </>}
                    <h4>{status}</h4>
                    {itemReqDateTime && <h4><i>{itemReqDateTime}</i></h4>}
                    {metadata?.error && typeof metadata?.error == "string" && <p>{metadata.error}</p>}
                </div>
            </div>
            <div className="file-container-thumbnail">
                {status !== DOWNLOAD_STATUS.ERROR && getJSXForElement(details, hideThumbnails)}
            </div>

            <div className="file-container-controls">
                {!isPending && <DownloadAllButton title="Download item." onClick={() => {
                    downloadItem(element)
                }} />}
                <DeleteItemButton onClick={() => {
                    trashButtonAction(element);
                }} />
            </div>
        </div>
    )
}
import React from 'react';
import { DOWNLOAD_STATUS } from '../../downloadUtils';
import { DeleteItemButton, DownloadAllButton } from '../buttons.jsx'
import './downloadItem.scss'


function isImage(contentType) {
    return contentType.includes("image/")
}

function isVideo(contentType) {
    return contentType.includes("video/")
}

function getJSXForElement(elementDetails, hideThumbnails) {
    const { metadata } = elementDetails
    if (metadata) {
        const { url: fullUrl, contentType, previewUrl } = metadata
        const elementIsImg = isImage(contentType)
        const elementIsVideo = isVideo(contentType)
        const className = hideThumbnails ? "hide-thumbnail" : ""
        const url = previewUrl || fullUrl
        if (elementIsImg) {
            return (
                <img className={className} src={url} />
            )
        }
        if (elementIsVideo) {
            return (<video className={className} controls muted>
                <source src={url} />
            </video>)
        }

        return null
    }
    return null
}

export const DownloadItem = ({ element, details, hideThumbnails, downloadItem, deleteItem }) => {
    const { status, metadata, downloaded } = details

    return (
        <div key={element} className="file-container">
            <div className="file-container-content">
                <div>
                    <h3>{metadata?.fileName}</h3>
                    {downloaded && <>
                        <input type="range" disabled={true} value={downloaded} id="downloadPercent" />
                        <label htmlFor="downloadPercent">{downloaded}%</label>
                    </>}
                    <h4>{status}</h4>
                    {metadata?.error && typeof metadata?.error == "string" && <p>{metadata.error}</p>}
                </div>
            </div>
            <div className="file-container-thumbnail">
                {status !== DOWNLOAD_STATUS.ERROR && getJSXForElement(details, hideThumbnails)}
            </div>

            <div className="file-container-controls">
                <DownloadAllButton title="Download item." onClick={() => {
                    downloadItem(element)
                }} />
                <DeleteItemButton onClick={() => {
                    deleteItem(element);
                }} />
            </div>
        </div>
    )
}
import React from 'react';
import { DOWNLOAD_STATUS } from '../../downloadUtils';
import { DeleteItemButton } from '../buttons.jsx'
import './downloadItem.scss'


function isImage(contentType) {
    return contentType.includes("image/")
}

function isVideo(contentType) {
    return contentType.includes("video/")
}

function getJSXForElement(elementDetails, hideThumbnails) {
    const { metadata } = elementDetails
    if (!hideThumbnails && metadata) {
        const { url, contentType } = metadata
        const elementIsImg = isImage(contentType)
        const elementIsVideo = isVideo(contentType)
        if (elementIsImg) {
            return (
                <img src={url} />
            )
        }
        if (elementIsVideo) {
            return (<video controls muted>
                <source src={url} />
            </video>)
        }

        return null
    }
    return null
}

export const DownloadItem = ({ element, details, hideThumbnails, deleteItem }) => {
    const { status, metadata } = details
    return (
        <div className="file-container">
            <div key={element} className="file-container-content">
                <div>
                    <h3>{metadata.fileName}</h3>
                    <input type="range" disabled={true} value={details.downloaded} id="downloadPercent" />
                    <label for="downloadPercent">{details.downloaded}%</label>
                </div>
            </div>
            <div className="file-container-thumbnail">
                {status !== DOWNLOAD_STATUS.ERROR && getJSXForElement(details, hideThumbnails)}
            </div>
            <div className="file-container-controls">
                <DeleteItemButton onClick={() => {
                    deleteItem(element);
                }} />
            </div>
        </div>
    )
}
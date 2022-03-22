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
        <div key={element} className="file-container">
            <div>
                <h3>{metadata.fileName}</h3>
                <i>{details.status} {details.downloaded}%</i>
                <DeleteItemButton onClick={() => {
                    deleteItem(element);
                }} />
                <div>

                </div>
            </div>
            {status !== DOWNLOAD_STATUS.ERROR && getJSXForElement(details, hideThumbnails)}
        </div>
    )
}
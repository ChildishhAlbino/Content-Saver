import React from 'react';
import { FaEye, FaEyeSlash, FaDownload, FaTrash, FaTimesCircle } from 'react-icons/fa'

const hideThumbnailsButton = (onClick) => {
    return <FaEyeSlash className="icon" title="Disable item thumbnails" onClick={onClick} />
}

const showThumbnailsButton = (onClick) => {
    return <FaEye className="icon" title="Enable item thumbnails" onClick={onClick} />
}

export const ToggleThumbnailsButton = ({ onClick, state }) => {
    return state ? hideThumbnailsButton(onClick) : showThumbnailsButton(onClick)
}

export const DeleteItemButton = ({ onClick }) => {
    return <FaTrash className="icon" title="Delete item." onClick={onClick} />
}

export const ClearPageButton = ({ onClick }) => {
    return <FaTimesCircle className="icon" title="Delete all items on page." onClick={onClick} />
}

export const DownloadAllButton = ({ onClick, title = "Download All Items" }) => {
    return <FaDownload className="icon" title={title} onClick={onClick} />
}

// export const ClearAllButton
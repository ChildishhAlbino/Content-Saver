import React from 'react';
import { FaEye, FaEyeSlash, FaDownload, FaHistory, FaTrash } from 'react-icons/fa'

const hideThumbnailsButton = (onClick) => {
    return <FaEyeSlash title="Disable item thumbnails" style={{ 'fontSize': "25px" }} onClick={onClick} />
}

const showThumbnailsButton = (onClick) => {
    return <FaEye title="Enable item thumbnails" style={{ 'fontSize': "25px" }} onClick={onClick} />
}

export const ToggleThumbnailsButton = ({ onClick, state }) => {
    return state ? hideThumbnailsButton(onClick) : showThumbnailsButton(onClick)
}

export const DeleteItemButton = ({ onClick }) => {
    return <FaTrash title="Delete item" style={{ 'fontSize': "25px" }} onClick={onClick} />
}


// export const ClearAllButton
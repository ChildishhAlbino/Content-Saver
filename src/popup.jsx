import React from 'react';
import { render } from 'react-dom'

import { createMessage, validateMessage } from './util';
import { SOURCES } from './sources';
import { DOWNLOAD_STATUS } from './downloadUtils';
import { ToggleThumbnailsButton, ClearPageButton, DownloadAllButton } from './components/buttons.jsx'
import { DownloadItem } from './components/downloadItem/downloadItem.jsx';
import { DELETE_DOWNLOAD_ITEM, ADHOC_DOWNLOAD, DOWNLOAD_ALL, CANCEL_DOWNLOAD } from "./commands"
import {
    getHydratedDownloads
} from './persistence/downloads'
import './popup.css'

const popupSource = SOURCES.POPUP
class Popup extends React.Component {

    constructor(props) {
        super(props)
        this.cancelDownload = this.cancelDownload.bind(this)
        this.downloadItem = this.downloadItem.bind(this)
        this.dataUpdate = this.dataUpdate.bind(this)
        this.toggleThumbnails = this.toggleThumbnails.bind(this)
        this.getFiles = this.getFiles.bind(this)
        this.getHideThumbnailButton = this.getHideThumbnailButton.bind(this)
        this.deleteItem = this.deleteItem.bind(this)
        this.downloadAllFiles = this.downloadAllFiles.bind(this)
        this.pageSelector = this.pageSelector.bind(this)
        this.shouldShowFile = this.shouldShowFile.bind(this)
        this.clearPage = this.clearPage.bind(this)
        this.state = {
            selectedPage: "Downloading",
            pages: ["Downloading", "Error", "All"],
            files: [],
            hideThumbnails: true
        }

    }

    getHideThumbnailButton() {
        return this.state.hideThumbnails ?
            this.state.hideThumbnailsIcons.disabled : this.state.hideThumbnailsIcons.enabled
    }

    sendMessage(message) {
        chrome.runtime.sendMessage(message)
    }

    postReceiveMessage() {
        const files = this.getFiles()
        console.log(files)
        this.setState({ files })
    }

    downloadAllFiles() {
        this.sendMessage(createMessage(
            popupSource,
            SOURCES.OFFSCREEN,
            {},
            DOWNLOAD_ALL
        ))
    }

    downloadItem(element) {
        this.sendMessage(createMessage(
            popupSource,
            SOURCES.OFFSCREEN,
            {
                element
            },
            ADHOC_DOWNLOAD,
        ))
    }

    toggleThumbnails() {
        this.setState({ hideThumbnails: !this.state.hideThumbnails })
    }

    dataUpdate() {
        let files = this.getFiles()
        this.setState({ files })
    }

    componentDidMount() {
        chrome.runtime.onMessage.addListener(request => {
            const validMessage = validateMessage(request, popupSource)
            if (validMessage) {
                console.log(request)
                this.postReceiveMessage()
            }
        }
        )
        window.addEventListener('storage', this.dataUpdate)
        this.dataUpdate()
        console.log("MOUNTED")
    }

    componentWillUnmount() {
        console.log("UNMOUNTED")
        window.removeEventListener('storage', this.dataUpdate)
    }

    getFiles() {
        const files = getHydratedDownloads()
        return Object.entries(files).reverse()
    }

    deleteItem(key) {
        this.sendMessage(createMessage(
            popupSource,
            SOURCES.OFFSCREEN,
            { key },
            DELETE_DOWNLOAD_ITEM
        ))
    }

    cancelDownload(key) {
        this.sendMessage(createMessage(
            popupSource,
            SOURCES.OFFSCREEN,
            { key },
            CANCEL_DOWNLOAD
        ))
    }

    pageSelector(text) {
        let className = 'page-selector'
        if (this.state.selectedPage === text) {
            className += ' selected'
        }
        const onClick = () => {
            this.setState({ selectedPage: text })
        }
        const files = this.getFiles()
        const numFiles = files.filter(([_, details]) => {
            const { status } = details
            return this.shouldShowFile(status, text)
        }).length
        return (
            <div onClick={onClick} key={text} className={className}>
                <h2>{text} {numFiles > 0 ? `(${numFiles})` : ""}</h2>
            </div>
        )
    }

    shouldShowFile(status, overridePage = null) {
        const page = overridePage || this.state.selectedPage
        let shouldShow = false
        switch (page) {
            case "Downloading":
                shouldShow = status === DOWNLOAD_STATUS.PENDING
                break;
            case "Error":
                shouldShow = status === DOWNLOAD_STATUS.ERROR
                break;
            case "All":
                shouldShow = true
                break;
            default:
                throw Error("Oops... How did I get here?")
        }
        return shouldShow
    }

    clearPage() {
        const { files } = this.state
        const filesToBeDeleted = files.filter(([_, details]) => {
            const { status } = details
            return this.shouldShowFile(status)
        })
        filesToBeDeleted.forEach(([element]) => {
            this.deleteItem(element)
        })
    }

    render() {
        console.log(this.state)
        const { pages, files } = this.state
        return (
            <div className="content">
                <div className="header-wrapper">
                    <div className="button-container">
                        <h1>Content Saver</h1>
                        <DownloadAllButton onClick={this.downloadAllFiles} />
                        <ToggleThumbnailsButton onClick={this.toggleThumbnails} state={this.state.hideThumbnails} />
                        <ClearPageButton onClick={this.clearPage} />
                    </div>
                    <div className="page-selector-wrapper">
                        {pages.map(item => {
                            return this.pageSelector(item)
                        })}
                    </div>
                </div>
                <div className="file-wrapper">
                    {
                        files.map(([element, details], index) => {
                            const { status } = details
                            console.log({ ...this.state });
                            const downloadingPageIsSelected = this.state.selectedPage == "Downloading"
                            const shouldShowFile = this.shouldShowFile(status)
                            if (shouldShowFile) {
                                return (
                                    <DownloadItem
                                        key={element}
                                        trashButtonAction={downloadingPageIsSelected ? this.cancelDownload : this.deleteItem}
                                        details={details}
                                        element={element}
                                        hideThumbnails={this.state.hideThumbnails}
                                        downloadItem={this.downloadItem}
                                    />
                                )
                            }
                        })
                    }
                </div>
            </div >
        )
    }

}


render(<Popup />, document.getElementById("react-target"))
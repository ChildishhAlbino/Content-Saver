import React from 'react';
import { render } from 'react-dom'

import { createMessage, validateMessage } from './util';
import { SOURCES } from './sources';
import { FaDownload, FaHistory } from 'react-icons/fa'
import { DOWNLOAD_STATUS } from './downloadUtils';
import { ToggleThumbnailsButton, DeleteItemButton, ClearPageButton, DownloadAllButton } from './components/buttons.jsx'
import { DownloadItem } from './components/downloadItem/downloadItem.jsx';
import { DELETE_DOWNLOAD_ITEM, ADHOC_DOWNLOAD } from "./commands"

import './popup.css'

const popupSource = SOURCES.POPUP
class Popup extends React.Component {

    constructor(props) {
        super(props)

        this.downloadAllBatches = this.downloadAllFiles.bind(this)
        this.setUpTimer = this.setUpTimer.bind(this)
        this.intervalUpdate = this.intervalUpdate.bind(this)
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
            backgroundPage: chrome.extension.getBackgroundPage(),
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
            SOURCES.BACKGROUND,
            { test: "test" },
            "DOWNLOAD_ALL_BATCHES"
        ))
    }

    toggleThumbnails() {
        this.setState({ hideThumbnails: !this.state.hideThumbnails })
    }

    intervalUpdate() {
        console.log("Interval")
        let files = this.getFiles()
        this.setState({ files })
    }

    setUpTimer() {
        const intervalId = setInterval(this.intervalUpdate, 250)
        this.setState({ intervalId })
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
        this.setUpTimer()
        console.log("MOUNTED")
    }

    componentWillUnmount() {
        console.log("UNMOUNTED")
        clearInterval(this.state.intervalId)
    }

    getFiles() {
        const bg = this.state.backgroundPage
        const { files } = bg
        return Object.entries(files).reverse()
    }

    deleteItem(key) {
        this.sendMessage(createMessage(
            popupSource,
            SOURCES.BACKGROUND,
            { key },
            DELETE_DOWNLOAD_ITEM
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
        return (
            <div onClick={onClick} key={text} className={className}>
                <h2>{text}</h2>
            </div>
        )
    }

    shouldShowFile(status) {
        const { selectedPage } = this.state
        let shouldShow = false
        switch (selectedPage) {
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
                        <DownloadAllButton />
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
                            const shouldShowFile = this.shouldShowFile(status)
                            if (shouldShowFile) {
                                return (
                                    <DownloadItem
                                        key={element}
                                        deleteItem={this.deleteItem}
                                        details={details}
                                        element={element}
                                        hideThumbnails={this.state.hideThumbnails}
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

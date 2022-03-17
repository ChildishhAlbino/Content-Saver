import React from 'react';
import { render } from 'react-dom'

import { createMessage, validateMessage } from './util';
import { SOURCES } from './sources';
import { FaDownload, FaHistory } from 'react-icons/fa'
import { DOWNLOAD_STATUS } from './downloadUtils';
import { ToggleThumbnailsButton, DeleteItemButton } from './components/buttons.jsx'
import { DELETE_DOWNLOAD_ITEM, ADHOC_DOWNLOAD } from "./commands"

const popupSource = SOURCES.POPUP
class Popup extends React.Component {

    constructor(props) {
        super(props)

        this.downloadAllBatches = this.downloadAllFiles.bind(this)
        this.setUpTimer = this.setUpTimer.bind(this)
        this.intervalUpdate = this.intervalUpdate.bind(this)
        this.toggleThumbnails = this.toggleThumbnails.bind(this)
        this.toggleHideCompleted = this.toggleHideCompleted.bind(this)
        this.getFiles = this.getFiles.bind(this)
        this.getHideThumbnailButton = this.getHideThumbnailButton.bind(this)
        this.deleteItem = this.deleteItem.bind(this)
        this.downloadAllFiles = this.downloadAllFiles.bind(this)
        this.state = {
            backgroundPage: chrome.extension.getBackgroundPage(),
            files: [],
            hideCompleted: true,
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


    isImage(contentType) {
        return contentType.includes("image/")
    }

    isVideo(contentType) {
        return contentType.includes("video/")
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

    toggleHideCompleted() {
        this.setState({ hideCompleted: !this.state.hideCompleted })
    }

    intervalUpdate() {
        console.log("Interval")
        let files = this.getFiles()
        if (this.state.hideCompleted) {
            files = files.filter(([item, details]) => {
                return details.status !== DOWNLOAD_STATUS.SUCCESS
            })
        }
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

    getJSXForElement(elementDetails) {
        const { meta } = elementDetails
        if (!this.state.hideThumbnails && meta) {
            const { url, contentType } = meta
            const elementIsImg = this.isImage(contentType)
            const elementIsVideo = this.isVideo(contentType)
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

    render() {
        console.log(this.state)
        const files = this.state.files
        return (
            <div className="content">
                <div className="button-container">
                    <h1>Content Saver</h1>
                    <FaDownload title="" onClick={this.downloadAllFiles} />
                    <ToggleThumbnailsButton onClick={this.toggleThumbnails} state={this.state.hideThumbnails} />
                    <FaHistory title="Show/Hide completed items" onClick={this.toggleHideCompleted} />
                </div>
                <div className="file-wrapper">
                    {
                        files.map(([element, details], index) => {
                            const { status } = details
                            return (
                                <div key={element} className="file-container">
                                    <div>
                                        <h1>Item #{index + 1}</h1>
                                        <i>{details.status} {details.downloaded}%</i>
                                        <DeleteItemButton onClick={() => {
                                            this.deleteItem(element);
                                        }} />
                                    </div>
                                    {status !== DOWNLOAD_STATUS.ERROR && this.getJSXForElement(details)}
                                </div>
                            )
                        })
                    }
                </div>
            </div >
        )
    }

}


render(<Popup />, document.getElementById("react-target"))

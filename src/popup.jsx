import React from 'react';
import { render } from 'react-dom'

import { createMessage, validateMessage } from './util';
import { SOURCES } from './sources';


const popupSource = SOURCES.POPUP
class Popup extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            batches: this.getBatches()
        }

        this.downloadAllBatches = this.downloadAllBatches.bind(this)
    }

    sendMessage(message) {
        chrome.runtime.sendMessage(message)
    }

    postReceiveMessage() {
        const batches = this.getBatches()
        console.log(batches)
        this.setState({ batches })
    }

    downloadAllBatches() {
        this.sendMessage(createMessage(
            popupSource,
            SOURCES.BACKGROUND,
            {},
            "DOWNLOAD_ALL_BATCHES"
        ))
    }

    componentDidMount() {
        chrome.runtime.onMessage.addListener(request => {
            const validMessage = validateMessage(request, popupSource)
            if (validMessage) {
                console.log(request)
                this.getBatches()
                this.postReceiveMessage()
            }
        }
        )
        console.log("MOUNTED")
    }

    getBatches() {
        const bg = chrome.extension.getBackgroundPage();
        const { batches } = bg
        console.log(bg)
        return batches
    }

    render() {
        console.log(this.state)
        const batches = this.state.batches
        return (
            <div className="content">
                <div className="button-container">
                    <h1>Content Saver</h1>
                    <button onClick={this.downloadAllBatches}>Download All</button>
                </div>
                <div className="batch-wrapper">
                    {
                        batches.map((batch, index) => {
                            return (<div key={index} className="batch-container">
                                {batch.length} Items!
                            </div>)
                        })
                    }
                </div>
            </div >
        )
    }

}


render(<Popup />, document.getElementById("react-target"))

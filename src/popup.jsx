import React from 'react';
import { render } from 'react-dom'



class Popup extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            data: "rrewrwer",
            batches: this.getBatches()
        }
    }

    postReceiveMessage() {
        const batches = this.getBatches()
        console.log(batches)
        this.setState({ batches })
    }

    componentDidMount() {
        chrome.runtime.onMessage.addListener(request => {
            console.log(request)
            this.getBatches()
            this.setState({ data: request.data })
            this.postReceiveMessage()
        }
        )
        console.log("MOUNTED")
    }

    getBatches() {
        const bg = chrome.extension.getBackgroundPage();
        const { batches } = bg
        return batches
    }

    render() {
        console.log(this.state)
        const batches = this.state.batches
        return (
            <div className="content">
                <Header />
                <div className="batch-wrapper">
                    {
                        batches.map((batch, index) => {
                            console.log(batch)
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



function Header() {
    return (
        <div className="button-container">
            <h1>Content Saver</h1>
            <button>Download All</button>
        </div>
    )
}


render(<Popup />, document.getElementById("react-target"))

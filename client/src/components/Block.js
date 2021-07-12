import React, { Component } from 'react'

class Block extends Component {
    render() {
        const { timestamp, hash, data } = this.props.block
        const hashDisplay = `${hash.substring(0, 16)}...`
        const stringifiedData = JSON.stringify(data)

        const dataDisplay = stringifiedData.length > 32 ?
            `${stringifiedData.substring(0, 32)}...` : stringifiedData

        return (
            <div className='Block'>
                <div>Hash: {hashDisplay}</div>
                <div>Timestamp: {new Date(timestamp).toLocaleString()}</div>
                <div>Data: {dataDisplay}</div>
            </div>
        )
    }
}

export default Block

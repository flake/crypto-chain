const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')

const Blockchain = require('./blockchain')
const TransactionPool = require('./wallet/transaction-pool')
const PubSub = require('./app/pubsub')
const Wallet = require('./wallet')

const app = express()
const blockchain = new Blockchain()
const transactionPool = new TransactionPool()
const wallet = new Wallet()
const pubsub = new PubSub({ blockchain, transactionPool })

const DEFAULT_PORT = 3000
const ROOT_NODE_ADDR = `http://localhost:${DEFAULT_PORT}`

app.use(bodyParser.json())

app.get('/api/blocks', (req, res) => {
    res.json(blockchain.chain)
})

app.get('/api/transaction-pool', (req, res) => {
    res.json(transactionPool.transactionMap)
})

app.post('/api/mine', (req, res) => {
    const { data } = req.body
    blockchain.addBlock({ data })
    pubsub.broadcastChain()

    res.redirect('/api/blocks')
})

app.post('/api/transact', (req, res) => {
    const { amount, recipient } = req.body
    let transaction = transactionPool.existingTransaction({ inputAddress: wallet.publicKey })

    try {
        if (transaction) {
            transaction.update({ senderWallet: wallet, recipient, amount })
        } else {
            transaction = wallet.createTransaction({ recipient, amount })
        }
    } catch (error) {
        return res.status(400).json({ type: 'error', message: error.message })
    }

    transactionPool.setTransaction(transaction)

    pubsub.broadcastTransaction(transaction)

    res.json({ type: 'success', transaction })
})

const syncWithRootState = () => {
    request({
        url: `${ROOT_NODE_ADDR}/api/blocks`
    }, (error, response, body) => {
        if (!error && response.statusCode === 200) {
            const rootChain = JSON.parse(body)

            console.log('replace chain on a sync with ', rootChain)
            blockchain.replaceChain(rootChain)
        }
    })

    request({
        url: `${ROOT_NODE_ADDR}/api/transaction-pool`
    }, (error, response, body) => {
        if (!error && response.statusCode === 200) {
            const rootTransactionMap = JSON.parse(body)

            console.log('replace transaction pool map on a sync with', rootTransactionMap)
            transactionPool.setMap(rootTransactionMap)
        }
    })
}

let PEER_PORT

if (process.env.GENERATE_PEER_PORT === 'true') {
    PEER_PORT = DEFAULT_PORT + Math.ceil(Math.random() * 1000)
}

const PORT = PEER_PORT || DEFAULT_PORT
app.listen(PORT, () => {
    console.log(`listening at localhost:${PORT}`)

    if (PORT !== DEFAULT_PORT) {
        syncWithRootState()
    }
})

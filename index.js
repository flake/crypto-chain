const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const path = require('path')

const Blockchain = require('./blockchain')
const TransactionPool = require('./wallet/transaction-pool')
const PubSub = require('./app/pubsub')
const Wallet = require('./wallet')
const TransactionMiner = require('./app/transaction-miner')

const app = express()
const blockchain = new Blockchain()
const transactionPool = new TransactionPool()
const wallet = new Wallet()
const pubsub = new PubSub({ blockchain, transactionPool })
const transactionMiner = new TransactionMiner({ blockchain, transactionPool, wallet, pubsub })

const DEFAULT_PORT = 3000
const ROOT_NODE_ADDR = `http://localhost:${DEFAULT_PORT}`

app.use(bodyParser.json())
app.use(express.static(path.join(__dirname, 'client/dist')))

app.get('/api/blocks', (req, res) => {
    res.json(blockchain.chain)
})

app.get('/api/transaction-pool', (req, res) => {
    res.json(transactionPool.transactionMap)
})

app.get('/api/mine-transactions', (req, res) => {
    transactionMiner.mineTransactions()

    res.redirect('/api/blocks')
})

app.get('/api/wallet-info', (req, res) => {
    const address = wallet.publicKey

    res.json({
        address,
        balance: Wallet.calculateBalance({ chain: blockchain.chain, address })
    })
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
            transaction = wallet.createTransaction({ recipient, amount, chain: blockchain.chain })
        }
    } catch (error) {
        return res.status(400).json({ type: 'error', message: error.message })
    }

    transactionPool.setTransaction(transaction)

    pubsub.broadcastTransaction(transaction)

    res.json({ type: 'success', transaction })
})

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist/index.html'))
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

// seed
const walletFoo = new Wallet()
const walletBar = new Wallet()

const generateWalletTransaction = ({ wallet, recipient, amount }) => {
    const transaction = wallet.createTransaction({
        recipient, amount, chain: blockchain.chain
    })

    transactionPool.setTransaction(transaction)
}

const walletAction = () => generateWalletTransaction({ wallet, recipient: walletFoo.publicKey, amount: 5 })
const walletFooAction = () => generateWalletTransaction({ wallet: walletFoo, recipient: walletBar.publicKey, amount: 10 })
const walletBarAction = () => generateWalletTransaction({ wallet: walletBar, recipient: wallet.publicKey, amount: 15 })

for (let i = 0; i < 20; i++) {
    if (i % 3 === 0) {
        walletAction()
        walletFooAction()
    } else if (i % 3 === 1) {
        walletAction()
        walletBarAction()
    } else {
        walletFooAction()
        walletBarAction()
    }

    transactionMiner.mineTransactions()
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

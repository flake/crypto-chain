const MINE_RATE = 1000
const INITIAL_DIFFICULTY = 3

const GENESIS_DATA = {
    timestamp: Date.now(),
    lastHash: '-----',
    hash: 'fl@k3-h@5h',
    difficulty: INITIAL_DIFFICULTY,
    nonce: 0,
    data: ['fl@k3-g3n35!5']
}

module.exports = {
    GENESIS_DATA,
    MINE_RATE
}

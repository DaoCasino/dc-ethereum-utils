import { config } from 'dc-configs'
import { Logger } from 'dc-logging'
import { Eth } from '../Eth'
import * as Utils from '../utils'

const log = new Logger('generateRND:Test:')
const {
  gasPrice: price,
  gasLimit: limit,
  web3HttpProviderUrl: httpProviderUrl,
  contracts,
  walletName,
  privateKey
} = config

const eth = new Eth({
  walletName,
  httpProviderUrl,
  ERC20ContractInfo: contracts.ERC20,
  gasParams: { price, limit },
})

const generateRNDTEST = (rangeStart, rangeEnd) => {
  eth.initAccount(privateKey)
  const seed = Utils.makeSeed()
  const hash = eth.signData([{ t: "bytes32", v: seed }])

  const rnd = eth.generateRnd([
    [rangeStart, rangeEnd],
    [rangeStart * 2, rangeEnd * 3],
    [rangeStart, rangeEnd * 5]
  ], hash)

  log.debug(rnd)
}

for (let i = 0; i < 10; i++) {
  generateRNDTEST(i, i * 2)
}
import { config } from 'dc-configs'
import { Eth } from '../Eth'
import * as Utils from '../utils'

const {
  gasPrice: price,
  gasLimit: limit,
  web3HttpProviderUrl: httpProviderUrl,
  contracts,
  privateKey,
} = config

const eth = new Eth({
  httpProviderUrl,
  ERC20ContractInfo: contracts.ERC20,
  gasParams: { price, limit },
  privateKey,
})

const test1 = () => {
  const seed = Utils.makeSeed()
  const hash = eth.signHash(seed)
}

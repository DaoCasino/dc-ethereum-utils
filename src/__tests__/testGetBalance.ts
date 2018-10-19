import { Eth } from "../Eth"
import * as Utils from "../utils"
import { config } from "dc-configs"
import { Logger } from "dc-logging"

const logger = new Logger("eth test")
const {
  gasPrice: price,
  gasLimit: limit,
  web3HttpProviderUrl: httpProviderUrl,
  contracts,
  privateKey
} = config

const eth = new Eth({
  httpProviderUrl,
  ERC20ContractInfo: contracts.ERC20,
  gasParams: { price, limit },
})
const test1 = async () => {
  const balance = await eth.getBetBalance(
    "0xcfe806e85787c1490e85c8028efda159616371c1"
  )
  logger.debug(balance)
}

test1()

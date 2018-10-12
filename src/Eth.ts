import {
  Cache,
  Balance,
  GasParams,
  EthParams,
  LastBalances,
  SolidityTypeValue,
} from './interfaces/IEth'

import BN                from 'bn.js'
import Web3              from 'web3'
import crypto            from 'crypto'
import { config }        from 'dc-configs'
import axios             from 'axios'
import { Logger }        from 'dc-logging'
import { sign, recover } from 'eth-lib/lib/account.js'
import * as Utils        from './utils'

const logger = new Logger('EthInstanse')

export class Eth {
  private _web3          : Web3
  private _cache         : Cache
  private _sign          : any
  private _recover       : any
  private _ERC20Contract : any
  private _account       : any
  private _store         : any
  private _params        : EthParams

  constructor(params: EthParams) {
    this._params  = params
    this._sign    = sign
    this._recover = recover
    this._web3    = new Web3(new Web3.providers.HttpProvider(config.web3HttpProviderUrl))

    this._cache = { lastBalances: { bet: {}, eth: {} } }
    this._store = {}

    // Init ERC20 contract
    this._ERC20Contract = this.initContract(
      params.ERC20ContractInfo.abi,
      params.ERC20ContractInfo.address
    )
  }
  
  getAccount() {
    return this._account
  }
  
  initContract(abi: any, address: string) {
    return new this._web3.eth.Contract(abi, address)
  }
  
  async initAccount() {
    const { privateKey } = this._params
    if (!privateKey) {
      logger.error(`Bankroller ACCOUNT_PRIVATE_KEY required!`)
      logger.info(`set ENV variable ACCOUNT_PRIVATE_KEY`)

      switch(process.env.DC_NETWORK) {
        case 'ropsten':
          logger.info(`
            You can get account with test ETH and BETs , from our faucet https://faucet.dao.casino/ 
            or use this random ${this._web3.eth.accounts.create().privateKey},
            but send Ropsten ETH and BETs to it before using
          `)
          break
        case 'sdk':
          logger.info(`
            For local SDK env you can use this privkey:
            0x8d5366123cb560bb606379f90a0bfd4769eecc0557f1b362dcae9012b548b1e5
          `)
          break
        default:
          logger.info(`
            You can use this privkey: ${this._web3.eth.accounts.create().privateKey},
            but be sure that account have ETH and BETs
          `)
          break
      }

      return false
    }

    this._account = this._web3.eth.accounts.privateKeyToAccount(privateKey)
    this._web3.eth.accounts.wallet.add(privateKey)
    return true
  }


  signHash(argsToSign: SolidityTypeValue[]): string {
    const hash = Utils.sha3(...argsToSign)
    const privateKey = Utils.add0x(this._account.privateKey)
    
    return this._sign(hash, privateKey)
  }

  recover(argsToHash: SolidityTypeValue[], peerSign: string): string {
    const hash = Utils.sha3(...argsToHash)
    return this._recover(hash, peerSign)
  }

  getBlockNumber(): Promise<any> {
    return this._web3.eth.getBlockNumber()
  }

  randomHash() {
    return crypto.randomBytes(16).toString('hex')
  }

  numFromHash(randomHash: any, min: number = 0, max: number = 100): number {
    if (min > max) {
      const box = min
      min = max
      max = box
    }

    if (min === max) return max
    max += 1

    const hashBN = new BN(Utils.remove0x(randomHash), 16)
    const divBN  = new BN(max - min, 10)
    const divRes = hashBN.mod(divBN)

    return Number(divRes.mod) + min
  }

  allowance(
    spender: string,
    address: string = this._account.address
  ): Promise<any> {
    return this._ERC20Contract.methods.allowance(address, spender).call()
  }

  sendTransaction(contract: any, methodName: string, args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const receipt = contract.methods[methodName](...args).send({
        from: this._account.address,
        gas: config.gasLimit,
        gasPrice: config.gasPrice
      })

      receipt.on('error', error => reject(error))
      receipt.on('transactionHash', transactionHash => logger.debug('TX hash', transactionHash))
      receipt.on('confirmation', confirmationCount => {
        if (confirmationCount <= config.waitForConfirmations) {
          logger.debug(methodName, 'confirmationCount: ', confirmationCount)
        } else {
          receipt.off('confirmation')
          logger.debug('Transaction success')
          resolve({status: 'success'})
        }
      })
    })
  }

  async ERC20ApproveSafe(spender: string, amount: number) {
    const allowance = await this.allowance(spender)
    const ammountToWei = this._web3.utils.toWei(amount.toString())
    
    if (0 < allowance && allowance < ammountToWei) {
      await this.sendTransaction(this._ERC20Contract, 'approve', [spender, 0])
    }
    
    if (allowance < ammountToWei) {
      await this.sendTransaction(this._ERC20Contract, 'approve', [spender, ammountToWei])
    }
  }

  async getBalances(
    address: string = this._account.address
  ): Promise<LastBalances> {

    const [ bet, eth ] = await Promise.all([
      this.getBetBalance(address),
      this.getEthBalance(address)
    ])

    this._cache.lastBalances.bet = bet
    this._cache.lastBalances.eth = eth
    
    return this._cache.lastBalances
  }

  async getEthBalance(address: string): Promise<Balance> {
    if (!address) {
      throw new Error('Empty address in ETH balance request')
    }
    
    const weiBalance: number     = await this._web3.eth.getBalance(address)
    const bnBalance: string | BN = this._web3.utils.fromWei(weiBalance, 'ether')
    
    return {
      balance: Number(bnBalance),
      updated: Date.now(),
    }
  }

  async getBetBalance(address: string): Promise<Balance> {
    if (!address) {
      throw new Error('Empty address in BET balance request')
    }

    const decBalance:number = await this._ERC20Contract.methods.balanceOf(address).call()
    const balance:number    = Utils.dec2bet(decBalance)

    return {
      balance,
      updated: Date.now()
    }
  }
}

import {
  Cache,
  Balance,
  LastBalances,
  SolidityTypeValue,
  TransactionReceipt,
  BlockchainUtilsInstance
} from '@daocasino/dc-blockchain-types'
import BN from "bn.js"
import Web3 from "web3"
import hdkey from 'ethereumjs-wallet/hdkey'
import { EthParams } from './interfaces/IEth'
import { config, ABIDefinition } from "@daocasino/dc-configs"
import { Logger } from "@daocasino/dc-logging"
import { sign, recover } from "eth-lib/lib/account.js"
import BigInteger from "node-rsa/src/libs/jsbn"

import * as Utils from "./utils"

import { Account as Web3Account } from "web3/eth/accounts"
import Contract from "web3/eth/contract"

const logger = new Logger("EthInstance")

export class Eth implements BlockchainUtilsInstance {
  private _web3: Web3
  private _cache: Cache
  private _sign: any
  private _recover: any
  private _ERC20Contract: Contract
  private _account: any
  private _params: EthParams
  
  targetTransactionHash: string

  constructor(params: EthParams) {
    this._params = params
    this._sign = sign
    this._recover = recover
    this._web3 = new Web3(
      new Web3.providers.HttpProvider(params.httpProviderUrl)
    )

    this._cache = { lastBalances: { bet: {}, eth: {} } }
    // Init ERC20 contract
    this._ERC20Contract = this.initContract(
      this._params.ERC20ContractInfo.abi,
      this._params.ERC20ContractInfo.address
    )
  }

  getAccount(): Web3Account {
    return this._account
  }

  getGameAbi(): ABIDefinition[] {
    return config.default.contracts.Game.abi
  }

  initContract(abi: ABIDefinition[], address: string): Contract {
    return new this._web3.eth.Contract(abi, address)
  }

  initAccount(privateKey: string): void {
    if (!privateKey) {
      const errorMessage =
        typeof window === "undefined"
          ? `ENV variable ACCOUNT_PRIVATE_KEY required!
           set ENV variable ACCOUNT_PRIVATE_KEY and init again`
          : `Private key is undefined
           Please set private key in params and init again`

      switch (process.env.DC_NETWORK) {
        case "ropsten":
          logger.warn(`
            You can get account with test ETH and BETs , from our faucet https://faucet.dao.casino/ 
            or use this random ${this._web3.eth.accounts.create().privateKey},
            but send Ropsten ETH and BETs to it before using
          `)
          break
        case "sdk":
          logger.warn(`
            For local SDK env you can use this privkey:
            0x8d5366123cb560bb606379f90a0bfd4769eecc0557f1b362dcae9012b548b1e5
          `)
          break
        default:
          logger.warn(`
            You can use this privkey: ${
              this._web3.eth.accounts.create().privateKey
            },
            but be sure that account have ETH and BETs
          `)
          break
      }

      throw new Error(errorMessage)
    }

    this._account = this._web3.eth.accounts.privateKeyToAccount(privateKey)
    this._web3.eth.accounts.wallet.add(privateKey)
  }

  createAccountForMnemonic(
    mneminicSeed: string,
    indexForCreate: number
  ): {
    address: string,
    privateKey: string
  } {
    const hdpath = `m/44'/60'/0'/0/${indexForCreate}`
    const createWallet = hdkey.fromMasterSeed(mneminicSeed).derivePath(hdpath)
    const getWallet = createWallet.getWallet()
    
    this._web3.eth.accounts.wallet.add(getWallet.getPrivateKeyString())
    return {
      address: getWallet.getAddressString(),
      privateKey: getWallet.getPrivateKeyString()
    }
  }

  setDefaultAccount(privateKey: string): void {
    this._account = this._web3.eth.accounts.privateKeyToAccount(privateKey)
  }
  /**
   *
   * @param privateKey
   * @param walletPassword use only in browser
   */
  saveWallet(privateKey: string, walletPassword?: string): void {
    if (
      typeof window !== "undefined" &&
      typeof walletPassword === "undefined"
    ) {
      throw new Error("walletPassword is not defined")
    }

    if (typeof privateKey === "undefined") {
      throw new Error("privateKey is not defined")
    }

    this._web3.eth.accounts.wallet.add(privateKey)
    if (walletPassword && typeof window !== "undefined") {
      this._web3.eth.accounts.wallet.save(
        walletPassword,
        this._params.walletName
      )
    }
  }

  loadWallet(walletPassword: string): void {
    if (typeof walletPassword === "undefined") {
      throw new Error("walletPassword is not define")
    }

    this._web3.eth.accounts.wallet.load(walletPassword, this._params.walletName)
  }

  getWalletAccount(): any {
    return this._web3.eth.accounts.wallet[0]
  }

  signData(argsToSign: SolidityTypeValue[]): string {
    const hash = Utils.sha3(...argsToSign)
    console.log(this)
    const privateKey = Utils.add0x(this._account.privateKey)
    return this._sign(hash, privateKey)
  }

  signHash(hash: string): string {
    const privateKey = Utils.add0x(this._account.privateKey)
    return this._sign(hash, privateKey)
  }

  recover(hash: string, peerSign: string): string {
    return this._recover(hash, peerSign)
  }

  getBlockNumber(): Promise<any> {
    return this._web3.eth.getBlockNumber()
  }

  allowance(
    spender: string,
    address: string = this._account.address
  ): Promise<any> {
    return this._ERC20Contract.methods
      .allowance(address, spender)
      .call()
      .then(weis => Utils.dec2bet(weis))
  }

  sendTransaction(
    contract: Contract,
    methodName: string,
    args: any[],
    addressFrom?: string
  ): Promise<TransactionReceipt> {
    return new Promise((resolve, reject) => {
      const from = addressFrom || this._account.address
      const receipt = contract.methods[methodName](...args).send({
        from,
        gas: this._params.gasParams.limit,
        gasPrice: this._params.gasParams.price
      })
      logger.debug(`Sent transaction: 
        contract: ${contract.options.address}, 
        method: ${methodName},
        from: ${from},
        args: ${JSON.stringify(args)}
        gas: ${this._params.gasParams.limit}
        gasPrice: ${this._params.gasParams.price}
      `)

      // Repeat if error
      receipt.catch(err => {
        logger.error("_REPEAT sendTransaction: " + methodName, err)
        reject(err)
      })
      receipt.on("error", err => {
        logger.error("REPEAT sendTransaction: " + methodName, err)
        reject(err)
      })

      receipt.on("transactionHash", transactionHash => {
        this.targetTransactionHash = transactionHash
        logger.debug("TX hash", transactionHash)
      })
      receipt.on("confirmation", confirmationCount => {
        if (confirmationCount <= config.default.waitForConfirmations) {
          logger.debug(`${methodName} confirmationCount: ${confirmationCount}`)
        } else {
          const rcpt = receipt as any
          rcpt.off("confirmation")
          logger.debug("Transaction success")
          resolve({ status: "success", transactionHash: this.targetTransactionHash })
        }
      })
    })
  }

  async ERC20ApproveSafe(
    spender: string,
    amount: number,
    minAmount: number = amount
  ): Promise<number> {
    const allowance: number = await this.allowance(spender)

    if (0 < allowance && allowance < minAmount) {
      await this.sendTransaction(this._ERC20Contract, "approve", [spender, 0])
    }

    if (allowance < minAmount) {
      await this.sendTransaction(this._ERC20Contract, "approve", [
        spender,
        this._web3.utils.toWei(amount.toString())
      ])
    }

    return allowance
  }

  async getBalances(
    address: string = this._account.address
  ): Promise<LastBalances> {
    try {
      const [bet, eth] = await Promise.all([
        this.getBetBalance(address),
        this.getEthBalance(address)
      ])

      this._cache.lastBalances.bet = bet
      this._cache.lastBalances.eth = eth

      return this._cache.lastBalances
    } catch (error) {
      throw error
    }
  }

  async getEthBalance(address: string): Promise<Balance> {
    if (!address) {
      throw new Error("Empty address in ETH balance request")
    }

    try {
      const weiBalance: number | BN = await this._web3.eth.getBalance(address)
      const bnBalance: string | BN = this._web3.utils.fromWei(
        weiBalance,
        "ether"
      )

      return {
        balance: Number(bnBalance),
        updated: Date.now()
      }
    } catch (error) {
      throw error
    }
  }

  async getBetBalance(address: string): Promise<Balance> {
    if (!address) {
      throw new Error("Empty address in BET balance request")
    }

    try {
      const decBalance: number = await this._ERC20Contract.methods
        .balanceOf(address)
        .call()
      const balance: number = Utils.dec2bet(decBalance)

      return {
        balance,
        updated: Date.now()
      }
    } catch (error) {
      throw error
    }
  }

  async sendToken(
    from: string,
    to: string,
    amount: number
  ): Promise<any> {
    const amountToWei = Utils.bet2dec(amount)
    try {
      const { status, transactionHash } = await this.sendTransaction(
        this._ERC20Contract,
        'transfer',
        [to, amountToWei],
        from
      )

      if (status === 'success') {
        return { status, transactionHash }
      }
    } catch (error) {
      throw error
    }
  }

  async sendBlockchainCurrency(
    from: string,
    to: string,
    amount: number
  ): Promise<TransactionReceipt> {
    const amountToWei = this._web3.utils.toWei(`${amount}`, 'ether')
    try {
      const transactionReceipt = await this._web3.eth.sendTransaction({
        from,
        to,
        value: amountToWei,
        gas: this._params.gasParams.limit,
        gasPrice: this._params.gasParams.price
      })
  
      return { status: 'success', transactionHash: transactionReceipt.transactionHash }
    } catch (error) {
      throw error
    }
  }
}

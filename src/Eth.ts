import {
  Cache,
  Balance,
  EthParams,
  LastBalances,
  SolidityTypeValue
} from "./interfaces/IEth"

import BN from "bn.js"
import Web3 from "web3"
import crypto from "crypto"
import { config } from "dc-configs"
import { Logger } from "dc-logging"
import { sign, recover } from "eth-lib/lib/account.js"
import BigInteger from "node-rsa/src/libs/jsbn"

import * as Utils from "./utils"
import Contract from "web3/eth/contract"

const logger = new Logger("EthInstance")

export class Eth {
  private _web3: Web3
  private _cache: Cache
  private _sign: any
  private _recover: any
  private _signatureForRandom: string
  private _ERC20Contract: Contract
  private _account: any
  private _params: EthParams

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
      params.ERC20ContractInfo.abi,
      params.ERC20ContractInfo.address
    )
  }

  getAccount(): any {
    return this._account
  }

  initContract(abi: any, address: string): Contract {
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

  randomHash() {
    return crypto.randomBytes(16).toString("hex")
  }

  numFromHash(randomHash: string, min: number = 0, max: number = 100): number {
    if (min > max) {
      const box = min
      min = max
      max = box
    }

    if (min === max) return max
    max += 1

    const hashBN = new BN(Utils.remove0x(randomHash), 16)
    const divBN = new BN(max - min, 10)
    const divRes = hashBN.mod(divBN).toNumber()
    return divRes + min
  }

  allowance(
    spender: string,
    address: string = this._account.address
  ): Promise<any> {
    return this._ERC20Contract.methods.allowance(address, spender).call()
  }

  generateRnd(ranges, signature) {
    const randomNumsArray = ranges.map((range, index) => {
      return range.reduce((prevRangeElement, nextRangeElement) => {
        const rangeCalc = nextRangeElement - prevRangeElement + 1
        const rangeInHex = rangeCalc.toString(16)
        const _signature = Utils.add0x(signature.toString("hex"))

        let randomInHex = Utils.sha3(
          { t: "bytes", v: _signature },
          { t: "uint", v: index }
        )
        let randomInBN = new BigInteger(Utils.remove0x(randomInHex), 16)

        const randomForCheck = (2 ** (256 - 1) / rangeCalc) * rangeCalc
        const randomForCheckInBN = new BigInteger(
          randomForCheck.toString(16),
          16
        )

        while (randomInBN.compareTo(randomForCheckInBN) > 0) {
          randomInHex = Utils.sha3({ t: "bytes32", v: randomInHex })
          randomInBN = new BigInteger(Utils.remove0x(randomInHex), 16)
        }

        const rangeInBN = new BigInteger(rangeInHex, 16)
        const minNumberToHex = prevRangeElement.toString(16)
        const minNumberToBN = new BigInteger(minNumberToHex, 16)

        const calcRandom = randomInBN.remainder(rangeInBN).add(minNumberToBN)
        const randomToInt = parseInt(Utils.add0x(calcRandom.toString(16)), 16)
        logger.debug(`local random number: ${randomToInt}`)

        return randomToInt
      })
    })

    delete this._signatureForRandom
    return randomNumsArray
  }

  sendTransaction(
    contract: Contract,
    methodName: string,
    args: any[]
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const from = this._account.address
      const receipt = contract.methods[methodName](...args).send({
        from,
        gas: this._params.gasParams.limit,
        gasPrice: this._params.gasParams.price
      })
      logger.debug(`Sent transaction: 
        contract: ${contract.options.address}, 
        method: ${methodName},
        from: ${from},
        args: ${JSON.stringify(args)}`)
      // const repeat = secs => {
      //   setTimeout(() => {
      //     this.sendTransaction(contract, methodName, args).then(resolve)
      //   }, secs * 1000)
      // }

      // Repeat if error
      receipt.catch(err => {
        logger.error("_REPEAT sendTransaction: " + methodName, err)
        reject(err)
        // return repeat(1)
      })
      receipt.on("error", err => {
        logger.error("REPEAT sendTransaction: " + methodName, err)
        reject(err)
        // return repeat(2)
      })

      receipt.on("transactionHash", transactionHash =>
        logger.debug("TX hash", transactionHash)
      )
      receipt.on("confirmation", confirmationCount => {
        if (confirmationCount <= config.waitForConfirmations) {
          logger.debug(`${methodName} confirmationCount: ${confirmationCount}`)
        } else {
          const rcpt = receipt as any
          rcpt.off("confirmation")
          logger.debug("Transaction success")
          resolve({ status: "success" })
        }
      })
    })
  }

  async ERC20ApproveSafe(spender: string, amount: number): Promise<number> {
    const allowance: number = await this.allowance(spender)

    if (0 < allowance && allowance < amount) {
      await this.sendTransaction(this._ERC20Contract, "approve", [spender, 0])
    }

    if (allowance < amount) {
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
    const [bet, eth] = await Promise.all([
      this.getBetBalance(address),
      this.getEthBalance(address)
    ])

    this._cache.lastBalances.bet = bet
    this._cache.lastBalances.eth = eth

    return this._cache.lastBalances
  }

  async getEthBalance(address: string): Promise<Balance> {
    if (!address) {
      throw new Error("Empty address in ETH balance request")
    }

    const weiBalance: number | BN = await this._web3.eth.getBalance(address)
    const bnBalance: string | BN = this._web3.utils.fromWei(weiBalance, "ether")

    return {
      balance: Number(bnBalance),
      updated: Date.now()
    }
  }

  async getBetBalance(address: string): Promise<Balance> {
    if (!address) {
      throw new Error("Empty address in BET balance request")
    }

    const decBalance: number = await this._ERC20Contract.methods
      .balanceOf(address)
      .call()
    const balance: number = Utils.dec2bet(decBalance)

    return {
      balance,
      updated: Date.now()
    }
  }
}

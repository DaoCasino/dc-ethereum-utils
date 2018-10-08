import BN from "bn.js";
import Web3 from "web3";
import crypto from "crypto";
import { config, ContractInfo } from "dc-configs";
import fetch from "node-fetch";
import { sign as signHash } from "eth-lib/lib/account.js";
import * as Utils from "./utils";
import Contract from "web3/eth/contract";

interface Balance {
  balance?: number;
  updated?: number;
}
interface LastBalances {
  bet: Balance;
  eth: Balance;
}
interface Cache {
  lastBalances: LastBalances;
}

export interface GasParams {
  //_config.network
  price: number;
  limit: number;
}

export interface EthParams {
  privateKey: string;
  httpProviderUrl: string; //_config.network.rpc_url
  ERC20ContractInfo: ContractInfo; //_config.network.contracts.erc20
  faucetServerUrl: string; //_config.faucet.get_acc_url
  gasParams: GasParams;
}

export class Eth {
  private _web3: Web3;
  private _getAccountPromise: Promise<string>;
  private _cache: Cache;
  private _ERC20Contract: any;
  private _payChannelContract: any;
  private _account: any;
  private _store: any;
  private _params: EthParams;
  constructor(params: EthParams) {
    this._params = params;
    this._web3 = new Web3(
      new Web3.providers.HttpProvider(params.httpProviderUrl)
    );

    this._cache = { lastBalances: { bet: {}, eth: {} } };
    this._store = {};
    // Init ERC20 contract
    this._ERC20Contract = new this._web3.eth.Contract(
      params.ERC20ContractInfo.abi,
      params.ERC20ContractInfo.address
    );

    // setTimeout(async ()=>{
    //   this._cache.lastBalances = await this.getBalances()
    //   console.log('Acc balance '+ this.acc.address, this._cache.lastBalances );
    // }, 5000)
  }
  account() {
    return this._account;
  }
  getContract(abi: any, address: string) {
    return new this._web3.eth.Contract(abi, address);
  }
  async initAccount() {
    const { privateKey } = this._params;
    if (!privateKey) {
      console.error(`Bankroller account PRIVATE_KEY required!`);
      console.info(`set ENV variable privateKey`);

      if (process.env.DC_NETWORK === "ropsten") {
        console.info(`You can get account with test ETH and BETs , from our faucet https://faucet.dao.casino/ 
          or use this random ${
            this._web3.eth.accounts.create().privateKey
          } , but send Ropsten ETH and BETs to it before using
        `);
      } else if (process.env.DC_NETWORK === "sdk") {
        console.info(
          `For local SDK env you can use this privkey: 0x8d5366123cb560bb606379f90a0bfd4769eecc0557f1b362dcae9012b548b1e5`
        );
      } else {
        console.info(
          `You can use this privkey: ${
            this._web3.eth.accounts.create().privateKey
          }, but be sure that account have ETH and BETs `
        );
      }

      process.exit();
    }

    this._account = this._web3.eth.accounts.privateKeyToAccount(privateKey);
    this._web3.eth.accounts.wallet.add(privateKey);
    return true;
  }

  // TODO WTF???
  signHash(rawHash) {
    const hash = Utils.add0x(rawHash);
    if (!this._web3.utils.isHex(hash)) {
      Utils.debugLog(hash + " is not correct hex");
      Utils.debugLog(
        "Use DCLib.Utils.makeSeed or Utils.soliditySHA3(your_args) to create valid hash"
      );
    }
    return signHash(hash, Utils.add0x(this._account.privateKey));
  }
  // signHash2(rawHash) {
  //   const hash = Utils.add0x(rawHash);
  //   const privateKey = Utils.add0x(this._account.privateKey)
  //   const curve = crypto.createSign('secp256k1');
  //   curve.setPrivateKey(Buffer.from(privateKey, 'hex'))
  //   return crypto.
  // }
  recover(state_hash, sign): string {
    return this._web3.eth.accounts.recover(state_hash, sign);
  }
  getBlockNumber(): Promise<any> {
    return this._web3.eth.getBlockNumber();
  }
  randomHash() {
    return crypto.randomBytes(16).toString("hex");
  }

  numFromHash(randomHash, min = 0, max = 100) {
    if (min > max) {
      let c = min;
      min = max;
      max = c;
    }
    if (min === max) return max;
    max += 1;

    const hashBN = new BN(Utils.remove0x(randomHash), 16);
    const divBN = new BN(max - min, 10);
    const divRes = hashBN.mod(divBN);

    return +divRes.mod + min;
  }

  sigRecover(raw_msg, signed_msg) {
    raw_msg = Utils.remove0x(raw_msg);
    return this._web3.eth.accounts.recover(raw_msg, signed_msg).toLowerCase();
  }

  sigHashRecover(raw_msg, signed_msg) {
    return this._web3.eth.accounts.recover(raw_msg, signed_msg).toLowerCase();
  }

  checkSig(raw_msg, signed_msg, need_address) {
    raw_msg = Utils.remove0x(raw_msg);
    return (
      need_address.toLowerCase() ===
      this._web3.eth.accounts.recover(raw_msg, signed_msg).toLowerCase()
    );
  }
  checkHashSig(raw_msg, signed_msg, need_address) {
    return (
      need_address.toLowerCase() ===
      this._web3.eth.accounts.recover(raw_msg, signed_msg).toLowerCase()
    );
  }

  async getAccountFromServer(): Promise<string> {
    if (this._getAccountPromise) {
      await this._getAccountPromise;
    }
    if (this._store.account_from_server) return this._store.account_from_server;

    this._getAccountPromise = fetch(this._params.faucetServerUrl, {}).then(
      res => res.json()
    );

    const requestResult = await this._getAccountPromise;
    this._store.account_from_server = JSON.parse(requestResult);
    Utils.debugLog(["Server account data: ", this._store.account_from_server]);
    return this._store.account_from_server.privateKey;
  }
  allowance(
    spender: string,
    address: string = this._account.address
  ): Promise<any> {
    return this._ERC20Contract.methods.allowance(address, spender).call();
  }

  async ERC20ApproveSafe(spender: string, amount: number) {
    let allowance = await this.allowance(spender);
    if (0 < allowance && allowance < amount) {
      await this.ERC20Approve(spender, 0);
    }
    if (allowance < amount) {
      await this.ERC20Approve(spender, amount);
    }
  }
  async ERC20Approve(spender: string, amount: number) {
    const receipt = await this._ERC20Contract.methods
      .approve(spender, this._web3.utils.toWei(amount.toString()))
      .send({
        from: this._account.address,
        gasPrice: this._params.gasParams.price,
        gas: this._params.gasParams.limit
      });

    if (
      typeof receipt === "undefined" ||
      !["0x01", "0x1", true].includes(receipt.status)
    ) {
      throw new Error(receipt);
    }
  }

  async getBalances(
    address: string = this._account.address
  ): Promise<LastBalances> {
    this._cache.lastBalances.bet = await this.getBetBalance(address);
    this._cache.lastBalances.eth = await this.getEthBalance(address);
    return this._cache.lastBalances;
  }

  async getEthBalance(address): Promise<Balance> {
    if (!address) throw new Error("Empty address in ETH balance request");
    const weiBalance = await this._web3.eth.getBalance(address);
    const bnBalance: any = this._web3.utils.fromWei(weiBalance, "ether");
    return {
      balance: Number(bnBalance),
      updated: Date.now()
    };
  }

  async getBetBalance(address): Promise<Balance> {
    if (!address) throw new Error("Empty address in BET balance request");
    const decBalance = await this._ERC20Contract.methods
      .balanceOf(address)
      .call();
    const balance = Utils.dec2bet(decBalance);
    return { balance, updated: Date.now() };
  }
}

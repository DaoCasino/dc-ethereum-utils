import BN from 'bn.js';
import Web3 from 'web3';
import crypto from 'crypto';
import { ContractInfo } from 'dc-configs';
import { sign, recover } from 'eth-lib/lib/account.js';
import * as Utils from './utils';
import { Logger } from 'dc-logging';

const logger = new Logger('Eth');
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
  // _config.network
  price: number;
  limit: number;
}

export interface EthParams {
  privateKey: string;
  httpProviderUrl: string; // _config.network.rpc_url
  ERC20ContractInfo: ContractInfo; // _config.network.contracts.erc20
  faucetServerUrl: string; // _config.faucet.get_acc_url
  gasParams: GasParams;
}

export class Eth {
  private _web3: Web3;
  private _getAccountPromise: Promise<string>;
  private _cache: Cache;
  private _sign: any;
  private _recover: any;
  private _ERC20Contract: any;
  private _payChannelContract: any;
  private _account: any;
  private _store: any;
  private _params: EthParams;
  constructor(params: EthParams) {
    this._params = params;
    this._sign = sign;
    this._recover = recover;
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
      logger.error(`Bankroller account PRIVATE_KEY required!`);
      logger.info(`set ENV variable privateKey`);

      if (process.env.DC_NETWORK === 'ropsten') {
        logger.info(`You can get account with test ETH and BETs , from our faucet https://faucet.dao.casino/ 
          or use this random ${
            this._web3.eth.accounts.create().privateKey
          } , but send Ropsten ETH and BETs to it before using
        `);
      } else if (process.env.DC_NETWORK === 'sdk') {
        logger.info(
          `For local SDK env you can use this privkey: 0x8d5366123cb560bb606379f90a0bfd4769eecc0557f1b362dcae9012b548b1e5`
        );
      } else {
        logger.info(
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

  signHash(rawHash) {
    const hash = Utils.add0x(rawHash);
    if (!this._web3.utils.isHex(hash)) {
      logger.debug(hash + ' is not correct hex');
      logger.debug(
        'Use DCLib.Utils.makeSeed or Utils.soliditySHA3(your_args) to create valid hash'
      );
    }
    return this._sign(hash, Utils.add0x(this._account.privateKey));
  }

  // signHash2(rawHash) {
  //   const hash = Utils.add0x(rawHash);
  //   const privateKey = Utils.add0x(this._account.privateKey)
  //   const curve = crypto.createSign('secp256k1');
  //   curve.setPrivateKey(Buffer.from(privateKey, 'hex'))
  //   return crypto.
  // }

  recover(stateHash, peerSign): string {
    return this._recover(stateHash, peerSign);
  }

  getBlockNumber(): Promise<any> {
    return this._web3.eth.getBlockNumber();
  }

  randomHash() {
    return crypto.randomBytes(16).toString('hex');
  }

  numFromHash(randomHash, min = 0, max = 100) {
    if (min > max) {
      [min, max] = [max, min];
    }
    if (min === max) return max;
    max += 1;

    const hashBN = new BN(Utils.remove0x(randomHash), 16);
    const divBN = new BN(max - min, 10);
    const divRes = hashBN.mod(divBN);

    return +divRes.mod + min;
  }

  // sigRecover(raw_msg, signed_msg) {
  //   raw_msg = Utils.remove0x(raw_msg);
  //   return this._web3.eth.accounts.recover(raw_msg, signed_msg).toLowerCase();
  // }

  // sigHashRecover(raw_msg, signed_msg) {
  //   return this._web3.eth.accounts.recover(raw_msg, signed_msg).toLowerCase();
  // }

  // checkSig(raw_msg, signed_msg, need_address) {
  //   raw_msg = Utils.remove0x(raw_msg);
  //   return (
  //     need_address.toLowerCase() ===
  //     this._web3.eth.accounts.recover(raw_msg, signed_msg).toLowerCase()
  //   );
  // }
  // checkHashSig(raw_msg, signed_msg, need_address) {
  //   return (
  //     need_address.toLowerCase() ===
  //     this._web3.eth.accounts.recover(raw_msg, signed_msg).toLowerCase()
  //   );
  // }

  allowance(
    spender: string,
    address: string = this._account.address
  ): Promise<any> {
    return this._ERC20Contract.methods.allowance(address, spender).call();
  }

  async ERC20ApproveSafe(spender: string, amount: number) {
    const allowance = await this.allowance(spender);
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
      typeof receipt === 'undefined' ||
      !['0x01', '0x1', true].includes(receipt.status)
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
    if (!address) throw new Error('Empty address in ETH balance request');
    const weiBalance = await this._web3.eth.getBalance(address);
    const bnBalance: any = this._web3.utils.fromWei(weiBalance, 'ether');
    return {
      balance: Number(bnBalance),
      updated: Date.now()
    };
  }

  async getBetBalance(address): Promise<Balance> {
    if (!address) throw new Error('Empty address in BET balance request');
    const decBalance = await this._ERC20Contract.methods
      .balanceOf(address)
      .call();
    const balance = Utils.dec2bet(decBalance);
    return { balance, updated: Date.now() };
  }
}

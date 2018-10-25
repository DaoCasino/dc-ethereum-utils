import Contract from "web3/eth/contract"
import { ContractInfo } from "dc-configs"

type SolidityType =
  | "bytes32"
  | "address"
  | "uint"
  | "uint256"
  | "bytes"
  | "bool"

export interface SolidityTypeValue {
  t: SolidityType
  v: string | number[] | boolean
}

export interface Balance {
  balance?: number
  updated?: number
}

export interface LastBalances {
  bet: Balance
  eth: Balance
}

export interface Cache {
  lastBalances: LastBalances
}

export interface GasParams {
  price: number
  limit: number
}

export interface EthParams {
  walletName: string,
  httpProviderUrl: string
  ERC20ContractInfo: ContractInfo
  gasParams: GasParams
}

export interface ETHInstance {
  getAccount: () => any
  initContract: (abi: any, address: string) => Contract
  initAccount: (privateKey: string) => void

  saveWallet: (privateKey: string, walletPassword?: string) => void
  loadWallet: (walletPassword: string) => void
  getWalletAccount: () => any

  signData: (argsToSign: SolidityTypeValue[]) => string
  signHash: (hash: string) => string
  recover: (hash: string, peerSign: string) => string
  
  getBlockNumber: () => Promise<any>
  randomHash: () => string

  numFromHash: (
    randomHash: string,
    min: number,
    max: number
  ) => number

  allowance: (
    spender: string,
    address: string
  ) => Promise<any>

  generateRnd: (
    ranges: number[][],
    signature: string
  ) => number[]
  
  sendTransaction: (
    contract: Contract,
    methodName: string,
    args: any[]
  ) => Promise<any>

  ERC20ApproveSafe: (
    spender: string,
    amount: number
  ) => Promise<number>

  getBalances: (address?: string) => Promise<LastBalances>
  getEthBalance: (address: string) => Promise<Balance>
  getBetBalance: (address: string) => Promise<Balance> 
}
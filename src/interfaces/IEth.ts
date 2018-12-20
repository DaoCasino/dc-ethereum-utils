import { GasParams } from '@daocasino/dc-blockchain-types'
import { ContractInfo } from "@daocasino/dc-configs"
// import Contract from "web3/eth/contract"
// import { Account as Web3Account } from "web3/eth/accounts"

// type SolidityType =
//   | "bytes32"
//   | "address"
//   | "uint"
//   | "uint256"
//   | "bytes"
//   | "bool"

// export interface SolidityTypeValue {
//   t: SolidityType
//   v: string | string[] | number[] | boolean
// }

// export interface Balance {
//   balance?: number
//   updated?: number
// }

// export interface LastBalances {
//   bet: Balance
//   eth: Balance
// }

// export interface Cache {
//   lastBalances: LastBalances
// }

// export interface GasParams {
//   price: number
//   limit: number
// }

export interface EthParams {
  walletName: string
  httpProviderUrl: string
  ERC20ContractInfo: ContractInfo
  gasParams: GasParams
}

// export interface ETHInstance {
//   getAccount: () => AccountInterface
//   initContract: (abi: any, address: string) => ContractInterface
//   initAccount: (privateKey: string) => void

//   saveWallet: (privateKey: string, walletPassword?: string) => void
//   loadWallet: (walletPassword: string) => void
//   getWalletAccount: () => any

//   signData: (argsToSign: SolidityTypeValue[]) => string
//   signHash: (hash: string) => string
//   recover: (hash: string, peerSign: string) => string

//   getBlockNumber: () => Promise<any>

//   allowance: (spender: string, address: string) => Promise<any>

//   sendTransaction: (
//     contract: ContractInterface,
//     methodName: string,
//     args: any[]
//   ) => Promise<any>

//   ERC20ApproveSafe: (
//     spender: string,
//     amount: number,
//     minAmount?: number
//   ) => Promise<number>

//   getBalances: (address?: string) => Promise<LastBalances>
//   getEthBalance: (address: string) => Promise<Balance>
//   getBetBalance: (address: string) => Promise<Balance>

//   sendToken(
//     from: string,
//     to: string,
//     amount: number
//   ): Promise<TransactionReceipt>
//   sendBlockchainCurrency(
//     from: string,
//     to: string,
//     amount: number
//   ): Promise<TransactionReceipt>
// }

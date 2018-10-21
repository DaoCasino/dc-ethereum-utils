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

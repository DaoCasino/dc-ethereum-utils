import { ContractInfo } from "dc-configs"

type SolidityType = "bytes32" | "address" | "uint" | "bytes" | "bool"

export interface SolidityTypeValue {
  t: SolidityType
  v: string | number[]
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
  privateKey: string
  httpProviderUrl: string
  ERC20ContractInfo: ContractInfo
  gasParams: GasParams
}

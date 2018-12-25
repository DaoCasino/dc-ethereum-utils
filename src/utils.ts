import { SolidityTypeValue } from './interfaces/IEth'
import web3_utils from 'web3-utils'

const web3Sha3 = web3_utils.soliditySha3
const ZERO_X = '0x'
const NUMS_FOR_ROUND = 6

export const sha3 = web3Sha3

export const dec2bet = (value: number | string): number  => {
  const numInWei = web3_utils.fromWei(numToHex(value))
  return Number(numInWei)
}

export const bet2dec = (value: number | string): string => {
  let numInWei = web3_utils.toWei(value.toString())
  if (~numInWei.indexOf('.')) {
    numInWei = numInWei.split('.')[0]
  }

  let roundNum = numInWei.substr(0, numInWei.length - NUMS_FOR_ROUND)
  for (let i = 0; i < NUMS_FOR_ROUND; i++) {
    roundNum += '0'
  }

  return roundNum
}

export const generateStructoreForSign = (
  ...signArguments: any[]
): SolidityTypeValue[] => {
  const structForSign = []
  for (let arg of signArguments) {
    if (
      Array.isArray(arg) &&
      arg.every(element => (!web3_utils.isHexStrict(element) && !isNaN(element)))
    ) {
      structForSign.push({ t: 'uint256', v: arg })
      continue
    }

    switch (true) {
      case (typeof arg === 'boolean'):
        structForSign.push({ t: 'bool', v: arg })
        break
      case (!web3_utils.isHexStrict(arg) && !isNaN(arg)):
        structForSign.push({ t: 'uint256', v: arg })
        break
      case web3_utils.isAddress(arg):
        structForSign.push({ t: 'address', v: arg })
        break
        case (web3_utils.hexToBytes(arg).length === 32):
        structForSign.push({ t: 'bytes32', v: arg })
        break
      default:
        structForSign.push({ t: 'bytes', v: arg })
    }
  }

  return structForSign
}

export const bets2decs = (value: number[]): string[] => {
  const arr: string[] = []
  for(let i = 0; i < value.length; i++){
    arr.push(bet2dec(value[i]))
  }

  return arr
}

export const betsSumm = (arr: number[] ): string => {
  return bet2dec(arr.reduce((a, b)=> a + b))
}

export const flatternArr = (arr: any[][]) => {
   return arr.reduce((acc, val) => Array.isArray(val) ? acc.concat(flatternArr(val)) : acc.concat(val), [])
}

export const clearcode = string => {
  return string
    .toString()
    .split('\t')
    .join('')
    .split('\n')
    .join('')
    .split('  ')
    .join(' ')
}
export const checksum = string => {
  return sha3(clearcode(string))
}

export const toFixed = (value, precision) => {
  precision = Math.pow(10, precision)
  return Math.ceil(value * precision) / precision
}

export const numToHex = num => {
  return num.toString(16)
}

export const hexToNum = str => {
  return parseInt(str, 16)
}

export const hexToString = hex => {
  let str = ''
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16))
  }
  return str
}

export const pad = (num, size) => {
  let s = num + ''
  while (s.length < size) s = '0' + s
  return s
}

export const buf2hex = buffer => {
  return Array.prototype.map
    .call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2))
    .join('')
}
export const buf2bytes32 = buffer => {
  return '0x' + buf2hex(buffer)
}

export const remove0x = str => {
  if (str.length > 2 && str.substr(0, 2) === ZERO_X) {
    str = str.substr(2)
  }
  return str
}

export const add0x = str => (str.startsWith(ZERO_X) ? str : `0x${str}`)

export const makeSeed = ():string => {
  let str = '0x'
  const possible = 'abcdef0123456789'

  for (let i = 0; i < 64; i++) {
    if (new Date().getTime() % 2 === 0) {
      str += possible.charAt(Math.floor(Math.random() * possible.length))
    } else {
      str += possible.charAt(Math.floor(Math.random() * (possible.length - 1)))
    }
  }

  return web3Sha3(numToHex(str))
}

export const concatUint8Array = (buffer1, buffer2) => {
  const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength)
  tmp.set(new Uint8Array(buffer1), 0)
  tmp.set(new Uint8Array(buffer2), buffer1.byteLength)
  return tmp.buffer
}




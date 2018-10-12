import web3_utils from 'web3-utils'

const web3Sha3 = web3_utils.soliditySha3
const ZERO_X = '0x'

export const sha3 = web3Sha3

export const dec2bet = (val, r = 2) => {
  return web3_utils.fromWei(numToHex(val)) * 1
}

export const bet2dec = (value: number) => {
  let b = web3_utils.toWei(value.toString())
  if (b.indexOf('.') > -1) {
    b = b.split('.')[0] * 1
  }
  return b
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

export const makeSeed = () => {
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

export const sleep = sec => {
  return new Promise(resolve=>{ setTimeout(resolve, sec*1000)})
}


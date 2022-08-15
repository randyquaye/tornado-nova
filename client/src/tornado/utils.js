/* global network */
import { ethers } from 'ethers'
const crypto = require('crypto-browserify')
const BigNumber = ethers.BigNumber
const { poseidon } = require('circomlib')

export const poseidonHash = (items) => BigNumber.from(poseidon(items).toString())
export const poseidonHash2 = (a, b) => poseidonHash([a, b])

export const FIELD_SIZE = BigNumber.from(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
)

/** Generate random number of specified byte length */
export const randomBN = (nbytes = 31) => BigNumber.from(crypto.randomBytes(nbytes))

export function getExtDataHash({
  recipient,
  extAmount,
  relayer,
  fee,
  encryptedOutput1,
  encryptedOutput2,
  tokenType,
  isSwap,
  anonAddress,
  rand,
  tokenOut
  // r1: r1,
  // r2: r2,
  //   pubKey: pubKey,
  // isL1Withdrawal,
  // l1Fee,
}) {
  const abi = new ethers.utils.AbiCoder()


  
  const encodedData = abi.encode(
    [
      'tuple(address recipient,int256 extAmount,address relayer,uint256 fee,bytes encryptedOutput1,bytes encryptedOutput2,address tokenType,bool isSwap,bytes32 anonAddress,bytes32 rand,address tokenOut)',
    ],
    [
      {
        recipient: toFixedHex(recipient, 20),
        extAmount: toFixedHex(extAmount),
        relayer: toFixedHex(relayer, 20),
        fee: toFixedHex(fee),
        encryptedOutput1: encryptedOutput1,
        encryptedOutput2: encryptedOutput2,
        tokenType: tokenType,
        isSwap:isSwap,
        anonAddress:anonAddress,
        rand:rand,
        tokenOut:tokenOut
      },
    ],
  )
  const hash = ethers.utils.keccak256(encodedData)
  return BigNumber.from(hash).mod(FIELD_SIZE)
}

/** BigNumber to hex string of specified length */
export function toFixedHex(number, length = 32) {
  let result =
    '0x' +
    (number instanceof Buffer
      ? number.toString('hex')
      : BigNumber.from(number).toHexString().replace('0x', '')
    ).padStart(length * 2, '0')
  if (result.indexOf('-') > -1) {
    result = '-' + result.replace('-', '')
  }
  return result
}

/** Convert value into buffer of specified byte length */
export const toBuffer = (value, length) =>
  Buffer.from(
    BigNumber.from(value)
      .toHexString()
      .slice(2)
      .padStart(length * 2, '0'),
    'hex',
  )

export function shuffle(array) {
  let currentIndex = array.length
  let randomIndex

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex--

    // And swap it with the current element.
    ;[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]]
  }

  return array
}

// async function getSignerFromAddress(address) {
//   await network.provider.request({
//     method: 'hardhat_impersonateAccount',
//     params: [address],
//   })

//   return await ethers.provider.getSigner(address)
// }



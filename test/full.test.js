
const hre = require('hardhat')
const { ethers, waffle } = hre
const { loadFixture } = waffle
const { expect } = require('chai')
const { utils } = ethers
const Utxo = require('../src/utxo')
const { transaction, registerAndTransact, prepareTransaction, buildMerkleTree } = require('../src/index')
const { toFixedHex, poseidonHash,poseidonHash2 } = require('../src/utils')
const { Keypair } = require('../src/keypair')
const { encodeDataForBridge } = require('./utils')
const config = require('../config')
const { generate } = require('../src/0_generateAddresses')
const { BigNumber } = require('ethers')

const MERKLE_TREE_HEIGHT = 5
const l1ChainId = 1
const MAXIMUM_DEPOSIT_AMOUNT = utils.parseEther(process.env.MAXIMUM_DEPOSIT_AMOUNT || '1')

const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const WETH9 = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"

describe('TornadoPool', function () {
  this.timeout(20000)

  async function deploy(contractName, ...args) {
    const Factory = await ethers.getContractFactory(contractName)
    const instance = await Factory.deploy(...args)
    return instance.deployed()
  }

  async function fixture() {
    require('../scripts/compileHasher')
    const [sender, gov, multisig] = await ethers.getSigners()
    const verifier2 = await deploy('Verifier2')
    const verifier16 = await deploy('Verifier16')
    const hasher = await deploy('Hasher')
    const hasher4 = await deploy('Hasher4')

    const token = await deploy('PermittableToken', 'Wrapped ETH', 'WETH', 18, l1ChainId)
    await token.mint(sender.address, utils.parseEther('10000'))

    const l1Token = await deploy('WETH', 'Wrapped ETH', 'WETH')
    await l1Token.deposit({ value: utils.parseEther('3') })

    const amb = await deploy('MockAMB', gov.address, l1ChainId)
    const omniBridge = await deploy('MockOmniBridge', amb.address)

    // deploy L1Unwrapper with CREATE2
    const singletonFactory = await ethers.getContractAt('SingletonFactory', config.singletonFactory)

    let customConfig = Object.assign({}, config)
    customConfig.omniBridge = omniBridge.address
    customConfig.hasher4 = hasher4.address
    customConfig.weth = l1Token.address
    customConfig.multisig = multisig.address
    const contracts = await generate(customConfig)
    await singletonFactory.deploy(contracts.unwrapperContract.bytecode, config.salt)
    const l1Unwrapper = await ethers.getContractAt('L1Unwrapper', contracts.unwrapperContract.address)

    /** @type {TornadoPool} */
    const tornadoPoolImpl = await deploy(
      'TornadoPool',
      verifier2.address,
      verifier16.address,
      MERKLE_TREE_HEIGHT,
      hasher.address,
      hasher4.address,
      // omniBridge.address,
      // l1Unwrapper.address,
      // gov.address,
      // l1ChainId,
      multisig.address
    )

    
    const { data } = await tornadoPoolImpl.populateTransaction.initialize(MAXIMUM_DEPOSIT_AMOUNT)
    const proxy = await deploy(
      'CrossChainUpgradeableProxy',
      tornadoPoolImpl.address,
      gov.address,
      data,
      amb.address,
      l1ChainId,
    )

    const tornadoPool = tornadoPoolImpl.attach(proxy.address)


    await l1Token.approve(tornadoPool.address, utils.parseEther('10000'))

    return { tornadoPool, token, proxy, omniBridge, amb, gov, multisig, l1Unwrapper, sender, l1Token }
  }

  it('should deposit, transact and withdraw', async function () {
    const { tornadoPool, token, l1Token } = await loadFixture(fixture)

    // Alice deposits into tornado pool
    const aliceKeypair = new Keypair() // contains private and public keys
    const aliceDepositAmount = utils.parseEther('0.1')
    const aliceDepositUtxo = new Utxo({ amount: aliceDepositAmount, keypair:aliceKeypair, type: l1Token.address })
    await transaction({ tornadoPool, outputs: [aliceDepositUtxo] })


    // Alice withdraws a part of his funds from the shielded pool
    const aliceWithdrawAmount = utils.parseEther('0.05')
    const aliceEthAddress = '0xDeaD00000000000000000000000000000000BEEf'
    const aliceChangeUtxo = new Utxo({
      type: l1Token.address,
      amount: aliceDepositAmount.sub(aliceWithdrawAmount),
      keypair: aliceKeypair,
    })
    await transaction({
      tornadoPool,
      inputs: [aliceDepositUtxo],
      outputs: [aliceChangeUtxo],
      recipient: aliceEthAddress,
    })

    // // Alice wants to swap token to tokenout(DAI)
    // const tokenOut = DAI
    // await transaction({tornadoPool, inputs:[aliceDepositUtxo], isSwap: true})

    // //Alice parses chain to detect swap
    // const swapFilter = tornadoPool.filters.SwapCommitment()
    // const swapBlock = await ethers.provider.getBlock()
    // const swapEvent = await tornadoPool.queryFilter(swapFilter, swapBlock.number)
    // let swapOutputUtxo
    // try {
    //   swapOutputUtxo = new Utxo({amount: swapEvent[0].args.amountOut, blinding: swapEvent[0].args.r1, 
    //                                 rand: swapEvent[0].args.r2,type:swapEvent[0].args.tokenOut, keypair:aliceKeypair })
    // } catch (e) {
    //   console.log("No swap found");
    // }


    // // Bob gives Alice address to send some eth inside the shielded pool
    // const bobKeypair = new Keypair() // contains private and public keys
    // const bobAddress = bobKeypair.address() // contains only public key

    // // Alice sends some tokenOut funds to Bob
    // const bobSendAmount = utils.parseEther('0.02')
    // const bobSendUtxo = new Utxo({ amount: bobSendAmount, keypair: Keypair.fromString(bobAddress), type: tokenOut })
    // const aliceChangeUtxo = new Utxo({
    //   amount: swapOutputUtxo.amount.sub(bobSendAmount),
    //   keypair: swapOutputUtxo.keypair,
    //   type: tokenOut
    // })
    //  await transaction({ tornadoPool, inputs: [swapOutputUtxo], outputs: [bobSendUtxo, aliceChangeUtxo] })

  })

})






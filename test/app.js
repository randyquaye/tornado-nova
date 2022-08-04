
// const hre = require('hardhat')
// const { ethers, waffle } = hre
// const { loadFixture } = waffle
// const { expect } = require('chai')
// const { utils } = ethers

// const Utxo = require('../src/utxo')
// const { transaction, registerAndTransact, prepareTransaction, buildMerkleTree } = require('../src/index')
// const { toFixedHex, poseidonHash } = require('../src/utils')
// const { Keypair } = require('../src/keypair')
// const { encodeDataForBridge } = require('./utils')
// const config = require('../config')
// const { generate } = require('../src/0_generateAddresses')

// const MERKLE_TREE_HEIGHT = 5
// const l1ChainId = 1
// const MAXIMUM_DEPOSIT_AMOUNT = utils.parseEther(process.env.MAXIMUM_DEPOSIT_AMOUNT || '1')

// describe('TornadoPool', function () {
//   this.timeout(20000)

//   async function deploy(contractName, ...args) {
//     const Factory = await ethers.getContractFactory(contractName)
//     const instance = await Factory.deploy(...args)
//     return instance.deployed()
//   }

//   async function fixture() {
//     require('../scripts/compileHasher')
//     const [sender, gov, multisig] = await ethers.getSigners()
//     const verifier2 = await deploy('Verifier2')
//     const verifier16 = await deploy('Verifier16')
//     const hasher = await deploy('Hasher')

//     const token = await deploy('PermittableToken', 'Wrapped ETH', 'WETH', 18, l1ChainId)
//     await token.mint(sender.address, utils.parseEther('10000'))

//     const l1Token = await deploy('WETH', 'Wrapped ETH', 'WETH')
//     await l1Token.deposit({ value: utils.parseEther('3') })

//     const amb = await deploy('MockAMB', gov.address, l1ChainId)
//     const omniBridge = await deploy('MockOmniBridge', amb.address)

//     // const swapRouterFactory = await ethers.getContractFactory(abi, bytecode);
//     // const swapRouter =  (await swapRouterFactory.deploy()).deployed()


//     // deploy L1Unwrapper with CREATE2
//     const singletonFactory = await ethers.getContractAt('SingletonFactory', config.singletonFactory)

//     let customConfig = Object.assign({}, config)
//     customConfig.omniBridge = omniBridge.address
//     customConfig.weth = l1Token.address
//     customConfig.multisig = multisig.address
//     const contracts = await generate(customConfig)
//     await singletonFactory.deploy(contracts.unwrapperContract.bytecode, config.salt)
//     const l1Unwrapper = await ethers.getContractAt('L1Unwrapper', contracts.unwrapperContract.address)

//     /** @type {TornadoPool} */
//     const tornadoPoolImpl = await deploy(
//       'TornadoPool',
//       verifier2.address,
//       verifier16.address,
//       MERKLE_TREE_HEIGHT,
//       hasher.address,
//       token.address,
//       omniBridge.address,
//       l1Unwrapper.address,
//       gov.address,
//       l1ChainId,
//       multisig.address
//       // swapRouter.address
//     )

//     const { data } = await tornadoPoolImpl.populateTransaction.initialize(MAXIMUM_DEPOSIT_AMOUNT)
//     const proxy = await deploy(
//       'CrossChainUpgradeableProxy',
//       tornadoPoolImpl.address,
//       gov.address,
//       data,
//       amb.address,
//       l1ChainId,
//     )

//     const tornadoPool = tornadoPoolImpl.attach(proxy.address)

//     await token.approve(tornadoPool.address, utils.parseEther('10000'))

//     return { tornadoPool, token, proxy, omniBridge, amb, gov, multisig, l1Unwrapper, sender, l1Token }
//   }

  
//   it('should deposit, transact and withdraw', async function () {

//     const { tornadoPool, token, proxy, omniBridge, amb, gov, multisig, l1Unwrapper, sender, l1Token } = await loadFixture(fixture)

    
//     // Alice deposits into tornado pool
//     const aliceDepositAmount = utils.parseEther('0.1')
//     const aliceDepositUtxo = new Utxo({ amount: aliceDepositAmount })
//     await transaction({ tornadoPool, outputs: [aliceDepositUtxo] })

//     // Bob gives Alice address to send some eth inside the shielded pool
//     const bobKeypair = new Keypair() // contains private and public keys
//     const bobAddress = bobKeypair.address() // contains only public key

//     // Alice sends some funds to Bob
//     const bobSendAmount = utils.parseEther('0.06')
//     const bobSendUtxo = new Utxo({ amount: bobSendAmount, keypair: Keypair.fromString(bobAddress) })
//     const aliceChangeUtxo = new Utxo({
//       amount: aliceDepositAmount.sub(bobSendAmount),
//       keypair: aliceDepositUtxo.keypair,
//     })
//     await transaction({ tornadoPool, inputs: [aliceDepositUtxo], outputs: [bobSendUtxo, aliceChangeUtxo] })

//     // Bob parses chain to detect incoming funds
//     const filter = tornadoPool.filters.NewCommitment()
//     const fromBlock = await ethers.provider.getBlock()
//     const events = await tornadoPool.queryFilter(filter, fromBlock.number)
//     let bobReceiveUtxo
//     try {
//       bobReceiveUtxo = Utxo.decrypt(bobKeypair, events[0].args.encryptedOutput, events[0].args.index)
//     } catch (e) {
//       // we try to decrypt another output here because it shuffles outputs before sending to blockchain
//       bobReceiveUtxo = Utxo.decrypt(bobKeypair, events[1].args.encryptedOutput, events[1].args.index)
//     }
//     expect(bobReceiveUtxo.amount).to.be.equal(bobSendAmount)

//     // Bob withdraws a part of his funds from the shielded pool
//     const bobWithdrawAmount = utils.parseEther('0.05')
//     const bobEthAddress = '0xDeaD00000000000000000000000000000000BEEf'
//     const bobChangeUtxo = new Utxo({ amount: bobSendAmount.sub(bobWithdrawAmount), keypair: bobKeypair })
//     await transaction({
//       tornadoPool,
//       inputs: [bobReceiveUtxo],
//       outputs: [bobChangeUtxo],
//       recipient: bobEthAddress,
//     })
//     const bobBalance = await token.balanceOf(bobEthAddress)
//     expect(bobBalance).to.be.equal(bobWithdrawAmount)
//   })



// //UNDERSTAND L1 STUFF
// })


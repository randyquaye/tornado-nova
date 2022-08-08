
const hre = require('hardhat')
const { ethers, waffle } = hre
const { loadFixture } = waffle
const { expect } = require('chai')
const { utils } = ethers
const Utxo = require('../src/utxo')
const { transaction, registerAndTransact, prepareTransaction, buildMerkleTree } = require('../src/index')
const { toFixedHex, poseidonHash,poseidonHash2,randomBN } = require('../src/utils')
const { Keypair } = require('../src/keypair')
const { encodeDataForBridge } = require('./utils')
const config = require('../config')
const { generate } = require('../src/0_generateAddresses')
const { BigNumber } = require('ethers')
// const { abi: SwapRouter } = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')

// const { WETHArtifact } = require('./WETH.json');
// const { USDCArtifact } = require('./USDC.json');

const MERKLE_TREE_HEIGHT = 5
const l1ChainId = 1
const MAXIMUM_DEPOSIT_AMOUNT = utils.parseEther(process.env.MAXIMUM_DEPOSIT_AMOUNT || '1')

const provider = new ethers.providers.WebSocketProvider('wss://rinkeby.infura.io/ws/v3/234c85e0ec6944a9825e84f1ea01ddd0')


const USDC = "0xeb8f08a975Ab53E34D8a0330E0D34de942C95926"
const WETH = "0xc778417E063141139Fce010982780140Aa0cD5Ab"
const SWAPROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564"

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

    

    const path = require('path')
    const fs = require('fs');
    
    const jsonFile = path.join(__dirname, 'SwapRouter.json')
    const parsed= JSON.parse(fs.readFileSync(jsonFile));
    const abi = parsed.abi;
    const _swapRouter  = new ethers.Contract(SWAPROUTER,abi, provider)
    const swapRouter = await _swapRouter.deployed()

    const WETHJson = path.join(__dirname, 'WETH.json')
    const WETHparsed= JSON.parse(fs.readFileSync(WETHJson));
    const WETHabi = WETHparsed.abi;
    const _WETHContract  = new ethers.Contract(WETH,WETHabi, provider)
    const WETHContract = await _WETHContract.deployed()

    const USDCJson = path.join(__dirname, 'USDC.json')
    const USDCparsed= JSON.parse(fs.readFileSync(USDCJson));
    const USDCabi = USDCparsed.abi;
    const _USDCContract  = new ethers.Contract(USDC,USDCabi, provider)
    const USDCContract = await _USDCContract.deployed()



    /** @type {TornadoPool} */
    const tornadoPool = await deploy(
      'TornadoPool',
      verifier2.address,
      verifier16.address,
      MERKLE_TREE_HEIGHT,
      hasher.address,
      hasher4.address,
      multisig.address
    )
    

    await tornadoPool.initialize(MAXIMUM_DEPOSIT_AMOUNT)
    await tornadoPool.initializeTokens(
      ethers.utils.formatBytes32String('WETH'),
      WETHContract.address
    )

    await tornadoPool.initializeTokens(
      ethers.utils.formatBytes32String('USDC'),
      USDCContract.address
    )
    


    await WETHContract.connect(sender).approve(tornadoPool.address, utils.parseEther('10000'))
    await USDCContract.connect(sender).approve(tornadoPool.address, utils.parseEther('10000'))


    return { tornadoPool,WETHContract, USDCContract }
  }

  it('should deposit, transact and withdraw', async function () {
    const { tornadoPool, WETHContract, USDCContract } = await loadFixture(fixture)
    
    // Alice deposits tokenA into tornado pool
    const aliceKeypair = new Keypair() // contains private and public keys
    const aliceDepositAmount = utils.parseEther('0.1')
    const aliceDepositUtxoA = new Utxo({ amount: aliceDepositAmount, keypair:aliceKeypair, type: WETHContract.address })
    await transaction({ tornadoPool, outputs: [aliceDepositUtxoA], tokenType:WETHContract.address })
    
    
    // Alice deposits tokenB into tornado pool
    const aliceDepositUtxoB = new Utxo({ amount: aliceDepositAmount, keypair:aliceKeypair, type: USDCContract.address })
    await transaction({ tornadoPool, outputs: [aliceDepositUtxoB], tokenType:USDCContract.address })

    // Alice wants to swap token to tokenA to tokenB
    const _blinding = BigNumber.from(randomBN())
    const _anonaddress = poseidonHash([aliceKeypair.pubkey, _blinding ])
    const _rand = randomBN()
    const _tokenOut = WETHContract.address
    // const _swapData = {anonaddress: _anonaddress, rand: _rand, tokenOut:_tokenOut}
    await transaction({tornadoPool, inputs:[aliceDepositUtxoB], isSwap: true, tokenType:USDCContract.address, anonAddress: _anonaddress, rand: _rand, tokenOut:_tokenOut})

    //Alice parses chain to detect swap
    const swapFilter = tornadoPool.filters.NewSwap(_anonaddress)
    const swapBlock = await ethers.provider.getBlock()
    const swapEvent = await tornadoPool.queryFilter(swapFilter, swapBlock.number)
    let swapOutputUtxo
    try {
      // console.log(swapEvent[0].args.amountOut)
      swapOutputUtxo = new Utxo({amount: swapEvent[0].args.amountOut, blinding: _blinding,rand: _rand,type:_tokenOut, keypair:aliceKeypair })
    } catch (e) {
      console.log("No swap found");
    }
    // Bob gives Alice address to send some eth inside the shielded pool
    const bobKeypair = new Keypair() // contains private and public keys
    const bobAddress = bobKeypair.address() // contains only public key

    // Alice sends some tokenOut funds to Bob
    const bobSendAmount = swapOutputUtxo.amount
    const bobSendUtxo = new Utxo({ amount: bobSendAmount, keypair: Keypair.fromString(bobAddress), type:_tokenOut })
    const aliceChangeUtxo = new Utxo({
      amount: swapOutputUtxo.amount.sub(bobSendAmount),
      keypair: swapOutputUtxo.keypair,
      type: _tokenOut
    })
     await transaction({ tornadoPool, inputs: [swapOutputUtxo], outputs: [bobSendUtxo, aliceChangeUtxo], tokenType:_tokenOut })

  })

})






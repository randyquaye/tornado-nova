
const hre = require('hardhat')
const { ethers, waffle } = hre
const { loadFixture } = waffle
const { utils } = ethers
const Utxo = require('../src/utxo')
const { transaction} = require('../src/index')
const { poseidonHash,randomBN } = require('../src/utils')
const { Keypair } = require('../src/keypair')
const { BigNumber } = require('ethers')
const MERKLE_TREE_HEIGHT = 5
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

  //sets up the state of the block chain network, deploying the
  //contracts required for the protocol to work
  async function fixture() {
    require('../scripts/compileHasher')
    
    //setup sender for transaction (one of Alice's EOA)
    const [sender, gov, multisig] = await ethers.getSigners()
    const verifier2 = await deploy('Verifier2')
    const verifier16 = await deploy('Verifier16')
    const hasher = await deploy('Hasher')
    const hasher4 = await deploy('Hasher4')

    const path = require('path')
    const fs = require('fs');

    //deploy Uniswap Router
    const jsonFile = path.join(__dirname, 'SwapRouter.json')
    const parsed= JSON.parse(fs.readFileSync(jsonFile));
    const abi = parsed.abi;
    const _swapRouter  = new ethers.Contract(SWAPROUTER,abi, provider)
    await _swapRouter.deployed()

    //deploy WETH tokencontract
    const WETHJson = path.join(__dirname, 'WETH.json')
    const WETHparsed= JSON.parse(fs.readFileSync(WETHJson));
    const WETHabi = WETHparsed.abi;
    const _WETHContract  = new ethers.Contract(WETH,WETHabi, provider)
    const WETHContract = await _WETHContract.deployed()

    //deploy USDC token contract
    const USDCJson = path.join(__dirname, 'USDC.json')
    const USDCparsed= JSON.parse(fs.readFileSync(USDCJson));
    const USDCabi = USDCparsed.abi;
    const _USDCContract  = new ethers.Contract(USDC,USDCabi, provider)
    const USDCContract = await _USDCContract.deployed()


    //deploy new contract
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
    

    //initialise WETH and USDC tokens to be supported by contracts

    await tornadoPool.initialize(MAXIMUM_DEPOSIT_AMOUNT)
    await tornadoPool.initializeTokens(
      ethers.utils.formatBytes32String('WETH'),
      WETHContract.address
    )

    await tornadoPool.initializeTokens(
      ethers.utils.formatBytes32String('USDC'),
      USDCContract.address
    )
    
    //approve both token contracr to allow sender to spend tokens
    await WETHContract.connect(sender).approve(tornadoPool.address, utils.parseEther('10000'))
    await USDCContract.connect(sender).approve(tornadoPool.address, utils.parseEther('10000'))


    return { tornadoPool,WETHContract, USDCContract }
  }

  it('should deposit multiple tokens', async function () {
    const { tornadoPool, WETHContract, USDCContract } = await loadFixture(fixture)
    
    console.log("\n\nWETH Deposit Performed")
    // // Alice deposits WETH into tornado pool
    const aliceKeypair = new Keypair() // contains private and public keys
    const aliceDepositAmount = utils.parseEther('0.5')
    const aliceDepositUtxoA = new Utxo({ amount: aliceDepositAmount, keypair:aliceKeypair, type: WETHContract.address })
    const receipt = await transaction({ tornadoPool, outputs: [aliceDepositUtxoA], tokenType:WETHContract.address })
    console.log("gas:", receipt.gasUsed)

    console.log("\n\nUSDC Deposit Performed")
    // Alice deposits USDC into tornado pool
    const aliceDepositUtxoB = new Utxo({ amount: aliceDepositAmount, keypair:aliceKeypair, type: USDCContract.address })
    await transaction({ tornadoPool, outputs: [aliceDepositUtxoB], tokenType:USDCContract.address })

  })


  it('should deposit and withdraw multiple tokens', async function () {
    const { tornadoPool, WETHContract, USDCContract } = await loadFixture(fixture)
    
    console.log("\n\nWETH Deposit Performed")
    // Alice deposits tokenA into tornado pool
    const aliceKeypair = new Keypair() // contains private and public keys
    const aliceDepositAmount = utils.parseEther('0.5')
    const aliceDepositUtxoA = new Utxo({ 
      amount: aliceDepositAmount, 
      keypair:aliceKeypair, 
      type: WETHContract.address })
    await transaction({ 
      tornadoPool, outputs: [aliceDepositUtxoA], 
      tokenType:WETHContract.address })
    
    console.log("\nUSDC Deposit Performed")
    // Alice deposits tokenB into tornado pool
    const aliceDepositUtxoB = new Utxo({ 
      amount: aliceDepositAmount, 
      keypair:aliceKeypair, 
      type: USDCContract.address })
    await transaction({ tornadoPool, 
      outputs: [aliceDepositUtxoB], 
      tokenType:USDCContract.address })

    console.log("\nWETH Withdrawal of 0.3 Performed")
    const aliceEthAdress = '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f'
    const aliceWithdrawAmount = utils.parseEther('0.3')
    const aliceChangeUtxo =  new Utxo({ 
      amount: aliceDepositAmount.sub(aliceWithdrawAmount), 
      keypair:aliceKeypair, type: WETHContract.address })
    await transaction({ tornadoPool, 
      inputs:[aliceDepositUtxoA], outputs:[aliceChangeUtxo], 
      recipient: aliceEthAdress, tokenType:WETHContract.address })

    console.log("\nUSDC Withdrawal of 0.1 Performed")
    const aliceWithdrawAmountB = utils.parseEther('0.1')
    const aliceChangeUtxoB =  new Utxo({ 
      amount: aliceDepositAmount.sub(aliceWithdrawAmountB), 
      keypair:aliceKeypair, type: USDCContract.address })
    await transaction({ tornadoPool, 
      inputs:[aliceDepositUtxoB], outputs:[aliceChangeUtxoB], 
      recipient: aliceEthAdress, tokenType:USDCContract.address })
  
  })

  it('should deposit, swap, transfer, and withdraw', async function () {
    const { tornadoPool, WETHContract, USDCContract } = await loadFixture(fixture)
    
    console.log("\nDeposit Completed")
    // Alice deposits USDC into tornado pool
    const aliceKeypair = new Keypair() // contains private and public keys
    const aliceDepositAmount = utils.parseEther('0.0000000001') //equivalent to 1000 USDC
    const aliceDepositUtxoA = new Utxo({ amount: aliceDepositAmount, keypair:aliceKeypair, type: USDCContract.address })
    await transaction({ tornadoPool, outputs: [aliceDepositUtxoA], tokenType:USDCContract.address })
    
    console.log("\nSwap Requested")
    // Alice wants to swap USDC to WETH
    const _blinding = BigNumber.from(randomBN())
    const _anonaddress = poseidonHash([aliceKeypair.pubkey, _blinding ])
    const _rand = randomBN()
    const _tokenOut = WETHContract.address
    // const _swapData = {anonaddress: _anonaddress, rand: _rand, tokenOut:_tokenOut}
    await transaction({tornadoPool, inputs:[aliceDepositUtxoA], isSwap: true, tokenType:USDCContract.address, anonAddress: _anonaddress, rand: _rand, tokenOut:_tokenOut})

    //Alice parses chain to detect swap
    const swapFilter = tornadoPool.filters.NewSwap(_anonaddress)
    const swapBlock = await ethers.provider.getBlock()
    const swapEvent = await tornadoPool.queryFilter(swapFilter, swapBlock.number)
    let swapOutputUtxo
    try {
      swapOutputUtxo = new Utxo({amount: swapEvent[0].args.amountOut, blinding: _blinding,rand: _rand,type:_tokenOut, keypair:aliceKeypair })
    } catch (e) {
      console.log("No swap found");
    }

    // Bob gives Alice address to send some WETH inside the shielded pool
    const bobKeypair = new Keypair() // contains private and public keys
    const bobAddress = bobKeypair.address() // contains only public key

    // Alice transfers private WETH funds to Bob
    console.log("\nAlice sends some WETH funds to Bob")
    const bobSendAmount = swapOutputUtxo.amount
    const bobSendUtxo = new Utxo({ amount: bobSendAmount, keypair: Keypair.fromString(bobAddress), type:_tokenOut })
    const aliceChangeUtxo = new Utxo({
      amount: swapOutputUtxo.amount.sub(bobSendAmount),
      keypair: swapOutputUtxo.keypair,
      type: _tokenOut
    })
     await transaction({ tornadoPool, inputs: [swapOutputUtxo], outputs: [bobSendUtxo, aliceChangeUtxo], tokenType:_tokenOut })

     // Bob checks the events to detect incoming funds
    const filter = tornadoPool.filters.NewCommitment()
    const fromBlock = await ethers.provider.getBlock()
    const events = await tornadoPool.queryFilter(filter, fromBlock.number)
    let bobReceiveUtxo
    try {
      bobReceiveUtxo = Utxo.decrypt(bobKeypair, events[0].args.encryptedOutput, events[0].args.index)
    } catch (e) {
      bobReceiveUtxo = Utxo.decrypt(bobKeypair, events[1].args.encryptedOutput, events[1].args.index)
    }

    // Bob withdraws his funds from the shielded pool
    console.log("\nBob withdraws his funds")
    const bobWithdrawAmount = bobReceiveUtxo.amount
    const bobEthAddress = '0xfabb0ac9d68b0b445fb7357272ff202c5651694a'
    const bobChangeUtxo = new Utxo({ amount: BigNumber.from(0), keypair: bobKeypair, type:WETHContract.address })
   const rec = await transaction({
      tornadoPool,
      inputs: [bobReceiveUtxo],
      outputs: [bobChangeUtxo],
      recipient: bobEthAddress,
      tokenType:WETHContract.address
    })

  })

})

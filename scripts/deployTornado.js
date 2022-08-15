const { ethers } = require('hardhat')
const { utils } = ethers
// const prompt = require('prompt-sync')()

const MERKLE_TREE_HEIGHT = 23
const { MINIMUM_WITHDRAWAL_AMOUNT, MAXIMUM_DEPOSIT_AMOUNT } = process.env

async function main() {

  const [signer1] = await ethers.getSigners();

  require('./compileHasher')
  const govAddress = '0xBAE5aBfa98466Dbe68836763B087f2d189f4D28f'
  const omniBridge = '0x59447362798334d3485c64D1e4870Fde2DDC0d75'
  const amb = '0x162e898bd0aacb578c8d5f8d6ca588c13d2a383f'
  const token = '0xCa8d20f3e0144a72C6B5d576e9Bd3Fd8557E2B04' // WBNB
  const l1Unwrapper = '0x8845F740F8B01bC7D9A4C82a6fD4A60320c07AF1' // WBNB -> BNB
  const l1ChainId = 56
  const multisig = '0xE3611102E23a43136a13993E3a00BAD67da19119'

  const Verifier2 = await ethers.getContractFactory('Verifier2',signer1)
  const verifier2 = await Verifier2.deploy()
  await verifier2.deployed()
  console.log(`verifier2: ${verifier2.address}`)

  const Verifier16 = await ethers.getContractFactory('Verifier16',signer1)
  const verifier16 = await Verifier16.deploy()
  await verifier16.deployed()
  console.log(`verifier16: ${verifier16.address}`)

  const Hasher = await await ethers.getContractFactory('Hasher', signer1)
  const hasher = await Hasher.deploy()
  await hasher.deployed()
  console.log(`hasher: ${hasher.address}`)

  const Hasher4 = await await ethers.getContractFactory('Hasher4', signer1)
  const hasher4 = await Hasher4.deploy()
  await hasher4.deployed()
  console.log(`hasher4: ${hasher.address}`)


  // const TokenA =  await ethers.getContractFactory('WETH')
  // const tokenA = await TokenA.deploy('WETH', 'Wrapped ETH', 'WETH')
  // await tokenA.deployed()
  // console.log(`tokenA: ${tokenA.address}`)


  // const TokenB =  await ethers.getContractFactory('USDC')
  // const tokenB = await TokenB.deploy('USDC', 'Tether', 'USDC')
  // await tokenB.deployed()
  // console.log(`tokenB: ${tokenB.address}`)


  const Pool = await ethers.getContractFactory('TornadoPool', signer1)
  
  //const tornadoImpl = prompt('Deploy tornado pool implementation and provide address here:\n')
  const tornadoImpl = await Pool.deploy(
    verifier2.address,
    verifier16.address,
    MERKLE_TREE_HEIGHT,
    hasher.address,
    hasher4.address,
    // omniBridge,
    // l1Unwrapper,
    // govAddress,
    // l1ChainId,
    multisig,
  )
  await tornadoImpl.deployed()
  console.log(`TornadoPool implementation address: ${tornadoImpl.address}`)

  // const CrossChainUpgradeableProxy = await ethers.getContractFactory('CrossChainUpgradeableProxy')
  // const proxy = await CrossChainUpgradeableProxy.deploy(tornadoImpl.address, govAddress, [], amb, l1ChainId)
  // await proxy.deployed()
  // console.log(`proxy address: ${proxy.address}`)

  // const tornadoPool = await Pool.attach(proxy.address)

  await tornadoImpl.initialize(
    // utils.parseEther(MINIMUM_WITHDRAWAL_AMOUNT),
    utils.parseEther(MAXIMUM_DEPOSIT_AMOUNT),
  )

  const USDC = "0xeb8f08a975Ab53E34D8a0330E0D34de942C95926"
  const WETH = "0xc778417E063141139Fce010982780140Aa0cD5Ab"
    await tornadoImpl.initializeTokens(
      ethers.utils.formatBytes32String('WETH'),
      WETH
    )

    await tornadoImpl.initializeTokens(
      ethers.utils.formatBytes32String('USDC'),
      USDC
    )

  // console.log(
  //   `Proxy initialized with MINIMUM_WITHDRAWAL_AMOUNT=${MINIMUM_WITHDRAWAL_AMOUNT} ETH and MAXIMUM_DEPOSIT_AMOUNT=${MAXIMUM_DEPOSIT_AMOUNT} ETH`,
  // )

  // const WETHFactory = await ethers.getContractFactory('WETH',signer2)
  // const WETH = await ethers.getContractAt().deployed()
  // await WETH.deposit({ value: utils.parseEther('3') })

  // console.log(`WETH adress:${WETH.address}` )
  console.log(`Signer 1: ${signer1.address}`)
  // console.log(`Signer 2: ${signer2.address}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

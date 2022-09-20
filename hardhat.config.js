/* eslint-disable indent, no-undef */
require('@typechain/hardhat')
require('@nomiclabs/hardhat-ethers')
require('@nomiclabs/hardhat-waffle')
require('@nomiclabs/hardhat-etherscan')
require('dotenv').config()

task('hasher', 'Compile Poseidon hasher', () => {
  require('./scripts/compileHasher')
})

const config = {
 
  solidity: {
    compilers: [
      {
        version: '0.4.24',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.6.2',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.7.5',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.7.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  paths:{
    artifacts: './client/src/artifacts'
  },
  defaultNetwork: "rinkeby",
  networks: {
    hardhat: {
      forking: {
        url: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
        blockNumber: 11402718,
      },
      chainId: 1,
      initialBaseFeePerGas: 5,
      loggingEnabled: false,
      allowUnlimitedContractSize: false,
      blockGasLimit: 50000000,
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts:[`${process.env.PRIVATE_KEY}`,"964b4a3f8d26210fdd18fc64891ef2491578615bc436f31d31aad19d3f736dd6",
      "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80","59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"]
    },
    xdai: {
      url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
      accounts: process.env.PRIVATE_KEY
        ? [process.env.PRIVATE_KEY]
        : {
            mnemonic: 'test test test test test test test test test test test junk',
          },
      gasPrice: 25000000000,
    },
    bsc: {
      url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
      accounts: process.env.PRIVATE_KEY
        ? [process.env.PRIVATE_KEY]
        : {
            mnemonic: 'test test test test test test test test test test test junk',
          },
    },
    mainnet: {
      url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
      accounts: process.env.PRIVATE_KEY
        ? [process.env.PRIVATE_KEY]
        : {
            mnemonic: 'test test test test test test test test test test test junk',
          },
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY,
  },
  mocha: {
    timeout: 600000000,
  },
  typechain: {
    outDir: 'src/types',
  },
}

module.exports = config

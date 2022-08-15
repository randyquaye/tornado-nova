import './App.css';
import { ethers } from 'ethers';
import { useEffect, useState } from 'react';
import Modal from './Modal.js';
import *  as crypto from 'crypto-browserify';

import {Utxo}  from './tornado/utxo'
import {Keypair} from './tornado/keypair'
import {prepareTransaction} from './tornado/index';

import tornadoArtifact from './artifacts/contracts/TornadoPool.sol/TornadoPool.json';
import WETHArtifact from './WETH.json';
import USDCArtifact from './USDC.json';

function App() {
  const [provider, setProvider] = useState(undefined);
  const [signer, setSigner] = useState(undefined);
  const [signerAddress, setSignerAddress] = useState(undefined);
  const [tornadoContract, setTornadoContract] = useState(undefined);
  const [tokenContracts, setTokenContracts] = useState({});
  const [tokenBalances, setTokenBalances] = useState({});
  const [tokenSymbols, setTokenSymbols] = useState([]);

  const [amount, setAmount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(undefined);
  const [isDeposit, setIsDeposit] = useState(true);

  const toBytes32 = text => ( ethers.utils.formatBytes32String(text) );
  const toString = bytes32 => ( ethers.utils.parseBytes32String(bytes32) );
  const toWei = ether => ( ethers.utils.parseEther(ether) );
  const toEther = wei => ( ethers.utils.formatEther(wei).toString() );
  const toRound = num => ( Number(num).toFixed(2) );

  useEffect(() => {
    const init = async () => {
      const provider = await new ethers.providers.Web3Provider(window.ethereum)
      setProvider(provider)

      const tornadoContract = await new ethers.Contract("0x2ef34D9c2F346f3154e0CdFfD8499D6Dfe9F8e13", tornadoArtifact.abi)
      setTornadoContract(tornadoContract)

      tornadoContract.connect(provider).getSymbols()
        .then((result) => {
          const symbols = result.map(s => toString(s))
          setTokenSymbols(symbols)
          getTokenContracts(symbols, tornadoContract, provider)
        })
    }
    init();
  }, [])

  const randomBN = (nbytes = 31) => ethers.BigNumber.from(crypto.randomBytes(nbytes))

  const getTokenContract = async (symbol, tornadoContract, provider) => {
    const address = await tornadoContract.connect(provider).getTokenAddress( toBytes32(symbol) )
    const abi = symbol === 'WETH' ? WETHArtifact.abi : USDCArtifact.abi
    const tokenContract = new ethers.Contract(address, abi)
    return tokenContract
  }

  const getTokenContracts = async (symbols, tornadoContract, provider) => {
    symbols.map(async symbol => {
      const contract = await getTokenContract(symbol, tornadoContract, provider)
      setTokenContracts(prev => ({...prev, [symbol]:contract}))
    })
  }

  const isConnected = () => (signer !== undefined)

  const getSigner = async provider => {
    provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();

    signer.getAddress()
      .then(address => {
        setSignerAddress(address)
      })

    return signer
  }

  const connect = () => {
    getSigner(provider)
      .then(signer => {
        setSigner(signer)
        // getTokenBalances(signer)
      })
  }

//   const getTokenBalance = async (symbol, signer) => {
//     const balance = await tornadoContract.connect(signer).getTokenBalance( toBytes32(symbol) )
//     return toEther(balance)
//   }

//   const getTokenBalances = (signer) => {
//     tokenSymbols.map(async symbol => {
//       const balance = await getTokenBalance(symbol, signer)
//       setTokenBalances(prev => ({...prev, [symbol]: balance.toString()}))
//     })
//   }

  const displayModal = (symbol) => {
    setSelectedSymbol(symbol)
    setShowModal(true)
  }

  const depositTokens = (wei, symbol) => {
    if (symbol === 'ETH') {
      signer.sendTransaction({
        to: tornadoContract.address,
        value: wei
      })
    } else {
      const tokenContract = tokenContracts[ symbol ]
      tokenContract.connect(signer).approve(tornadoContract.address, wei)
        .then(() => {
          const aliceKeypair = new Keypair() // contains private and public keys
          console.log(aliceKeypair.privkey)
          const aliceDepositUtxo = new Utxo({ amount: wei, keypair:aliceKeypair, type: tokenContract.address})
          prepareTransaction({
            tornadoPool:tornadoContract, 
            outputs: [aliceDepositUtxo],
            tokenType:tokenContract.address
          }).then((_transaction)=>{
            console.log(_transaction.args.root)
            tornadoContract.connect(signer).transact(_transaction.args, _transaction.extData, {
              gasLimit: 3e6,
            }).then((receipt)=>{
              receipt.wait()
            })
          }

          )
        
        
        })
    }
  }

  const withdrawTokens = (wei, symbol) => {
    // if (symbol === 'Eth') {
    //   tornadoContract.connect(signer).withdrawEther(wei)
    // } else {
    //   tornadoContract.connect(signer).withdrawTokens(wei, toBytes32(symbol));
    // }
  }

  const depositOrWithdraw = (e, symbol) => {
    e.preventDefault();
    const wei = toWei(amount)

    if(isDeposit) {
      depositTokens(wei, symbol)
    } else {
      withdrawTokens(wei, symbol)
    }
  }

return (
  <div className="App">
    <header className="App-header">
      {isConnected() ? (
        <div>
          <p>
            Welcome {signerAddress?.substring(0,10)}...
          </p>
          <div>
            <div className="list-group">
              <div className="list-group-item">
                {tokenSymbols.map((symbol) => (
                  <div className=" row d-flex py-3" key={symbol}>

                    <div className="col-md-3">
                      <div>{symbol.toUpperCase()}</div>
                    </div>
{/* 
                    <div className="d-flex gap-4 col-md-3">
                      <small className="opacity-50 text-nowrap">{toRound(tokenBalances[symbol])}</small>
                    </div>

                     */}

                    <div className="d-flex gap-4 col-md-6">
                        <button onClick={ () => displayModal(symbol) } className="btn btn-primary">Deposit/Withdraw</button>
                        <Modal
                          show={showModal}
                          onClose={() => setShowModal(false)}
                          symbol={selectedSymbol}
                          depositOrWithdraw={depositOrWithdraw}
                          isDeposit={isDeposit}
                          setIsDeposit={setIsDeposit}
                          setAmount={setAmount}
                        />
                      </div>

                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div>
          <p>
            You are not connected
          </p>
          <button onClick={connect} className="btn btn-primary">Connect Metamask</button>
        </div>
      )}
    </header>
  </div>
);
}

export default App;
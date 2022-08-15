// SPDX-License-Identifier: MIT
// https://tornado.cash
/*
 * d888888P                                           dP              a88888b.                   dP
 *    88                                              88             d8'   `88                   88
 *    88    .d8888b. 88d888b. 88d888b. .d8888b. .d888b88 .d8888b.    88        .d8888b. .d8888b. 88d888b.
 *    88    88'  `88 88'  `88 88'  `88 88'  `88 88'  `88 88'  `88    88        88'  `88 Y8ooooo. 88'  `88
 *    88    88.  .88 88       88    88 88.  .88 88.  .88 88.  .88 dP Y8.   .88 88.  .88       88 88    88
 *    dP    `88888P' dP       dP    dP `88888P8 `88888P8 `88888P' 88  Y88888P' `88888P8 `88888P' dP    dP
 * ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo
 */

pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import { IERC20Receiver, IERC6777, IOmniBridge } from "./interfaces/IBridge.sol";
import { CrossChainGuard } from "./bridge/CrossChainGuard.sol";
import { IVerifier } from "./interfaces/IVerifier.sol";
import "./MerkleTreeWithHistory.sol";
import "hardhat/console.sol";
// import {PoseidonT6, PoseidonT3} from "@zk-kit/incremental-merkle-tree.sol/Hashes.sol";



/** @dev This contract(pool) allows deposit of an arbitrary amount to it, shielded transfer to another registered user inside the pool
 * and withdrawal from the pool. Project utilizes UTXO model to handle users' funds.
 */
// contract TornadoPool is MerkleTreeWithHistory, IERC20Receiver, ReentrancyGuard, CrossChainGuard {
contract TornadoPool is MerkleTreeWithHistory, ReentrancyGuard {
  int256 public constant MAX_EXT_AMOUNT = 2**248;
  uint256 public constant MAX_FEE = 2**248;
  uint256 public constant MIN_EXT_AMOUNT_LIMIT = 0.5 ether;

  address public constant USDC = 0xeb8f08a975Ab53E34D8a0330E0D34de942C95926;
  address public constant WETH = 0xc778417E063141139Fce010982780140Aa0cD5Ab;

  

  ISwapRouter public constant swapRouter = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
  IVerifier public immutable verifier2;
  IVerifier public immutable verifier16;
  
  // address public immutable omniBridge;
  // address public immutable l1Unwrapper;
  address public immutable multisig;
  
  // uint256 private _amountOut; //for swaps

  mapping(address => uint256) public lastBalance; 
  uint256 public __gap; // storage padding to prevent storage collision
  uint256 public maximumDepositAmount;
  mapping(bytes32 => bool) public nullifierHashes;
  bytes32[] public tokenSymbols;
  mapping(bytes32 => address) public supportedTokens;
  mapping(address => bool) public isSupportedToken;


  struct SwapData{
    bytes32 anonaddress;
    bytes32 rand; 
    address tokenOut;
  }


  struct ExtData {
    address recipient;
    int256 extAmount;
    address relayer;
    uint256 fee;
    bytes encryptedOutput1;
    bytes encryptedOutput2;
    address tokenType;
    bool isSwap;
    bytes32 anonAddress;
    bytes32 rand;
    address tokenOut;
  }

  struct Proof {
    bytes proof;
    bytes32 root;
    bytes32[] inputNullifiers;
    bytes32[2] outputCommitments;
    uint256 publicAmount;
    bytes32 extDataHash;
    bytes32 tokenType;
  }

  struct Account {
    address owner;
    bytes publicKey;
  }

  event NewCommitment(bytes32 commitment, uint256 index, bytes encryptedOutput);
  event NewSwap(bytes32 indexed anonAddress, uint256 amountOut);
  event NewNullifier(bytes32 nullifier);
  event PublicKey(address indexed owner, bytes key);

  modifier onlyMultisig() {
    require(msg.sender == multisig, "only governance");
    _;
  }

  /**
    @dev The constructor
    @param _verifier2 the address of SNARK verifier for 2 inputs
    @param _verifier16 the address of SNARK verifier for 16 inputs
    @param _levels hight of the commitments merkle tree
    @param _hasher hasher address for the merkle tree
    @param _hasher4 4 input hasher
    @param _multisig multisig on L2
    
  */
  constructor(
    IVerifier _verifier2,
    IVerifier _verifier16,
    uint32 _levels,
    address _hasher,
    address _hasher4,
    address _multisig
  )
    MerkleTreeWithHistory(_levels, _hasher,_hasher4)
    // CrossChainGuard(address(IOmniBridge(_omniBridge).bridgeContract()), _l1ChainId, _governance)
  {
    verifier2 = _verifier2;
    verifier16 = _verifier16;
    multisig = _multisig;
    
  }

  function initialize(uint256 _maximumDepositAmount) external initializer {
    _configureLimits(_maximumDepositAmount);
    super._initialize();
    tokenSymbols.push("ETH");
    supportedTokens["ETH"] = address(0);
    isSupportedToken[address(0)] = true;
  }

  function initializeTokens(bytes32 symbol, address tokenAddress) external{
        tokenSymbols.push(symbol);
        supportedTokens[symbol] = tokenAddress;
        isSupportedToken[tokenAddress] = true;
  }

  function getSymbols() external view returns(bytes32[] memory) {
    return tokenSymbols;
  }

  function getTokenAddress(bytes32 symbol) external view returns(address) {
    return supportedTokens[symbol];
  }
 

  /** @dev Main function that allows deposits, transfers and withdrawal.
   */
  function transact(Proof memory _args, ExtData memory _extData) public {
    if (_extData.extAmount > 0) {
        // for deposits
        require(isSupportedToken[_extData.tokenType],"token not supported");
        IERC20(_extData.tokenType).transferFrom(msg.sender, address(this), uint256(_extData.extAmount));
        require(uint256(_extData.extAmount) <= maximumDepositAmount, "amount is larger than maximumDepositAmount");
      
    }
    _transact(_args, _extData);
  }

  function register(Account memory _account) public {
    require(_account.owner == msg.sender, "only owner can be registered");
    _register(_account);
  }

  function registerAndTransact(
    Account memory _account,
    Proof memory _proofArgs,
    ExtData memory _extData
  ) public {
    register(_account);
    transact(_proofArgs, _extData);
  }


  /// @dev Method to claim junk and accidentally sent tokens
  function rescueTokens(
    address _token,
    address payable _to,
    uint256 _balance
  ) external onlyMultisig {
    require(_to != address(0), "TORN: can not send to zero address");
    require(!isSupportedToken[_token], "can not rescue pool asset");

    if (IERC20(_token) == IERC20(0)) {
      // for Ether
      uint256 totalBalance = address(this).balance;
      uint256 balance = _balance == 0 ? totalBalance : _balance;
      _to.transfer(balance);
    } else {
      // any other erc20
      uint256 totalBalance = IERC20(_token).balanceOf(address(this));
      uint256 balance = _balance == 0 ? totalBalance : _balance;
      require(balance > 0, "TORN: trying to send 0 balance");
      IERC20(_token).transfer(_to, balance);
    }
  }

  function configureLimits(uint256 _maximumDepositAmount) public onlyMultisig {
    _configureLimits(_maximumDepositAmount);
  }

  function calculatePublicAmount(int256 _extAmount, uint256 _fee) public pure returns (uint256) {
    require(_fee < MAX_FEE, "Invalid fee");
    require(_extAmount > -MAX_EXT_AMOUNT && _extAmount < MAX_EXT_AMOUNT, "Invalid ext amount");
    int256 publicAmount = _extAmount - int256(_fee);
    return (publicAmount >= 0) ? uint256(publicAmount) : FIELD_SIZE - uint256(-publicAmount);
  }

  /** @dev whether a note is already spent */
  function isSpent(bytes32 _nullifierHash) public view returns (bool) {
    return nullifierHashes[_nullifierHash];
  }

  function verifyProof(Proof memory _args) public view returns (bool) {
    if (_args.inputNullifiers.length == 2) {
      return
        verifier2.verifyProof(
          _args.proof,
          [
            uint256(_args.root),
            _args.publicAmount,
            uint256(_args.extDataHash),
            uint256(_args.inputNullifiers[0]),
            uint256(_args.inputNullifiers[1]),
            uint256(_args.outputCommitments[0]),
            uint256(_args.outputCommitments[1])
            // uint256(_args.tokenType)
          ]
        );
    } else if (_args.inputNullifiers.length == 16) {
      return true;
    } else {
      revert("unsupported input count");
    }
  }

  function _register(Account memory _account) internal {
    emit PublicKey(_account.owner, _account.publicKey);
  }

  function _transact(Proof memory _args, ExtData memory _extData) internal nonReentrant {
    //perform all checks for puublic inputs 
    // require(isKnownRoot(_args.root), "Invalid Merkle Root");
    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      require(!isSpent(_args.inputNullifiers[i]), "Input is already spent");
    }
    
    require(uint256(_args.extDataHash) == uint256(keccak256(abi.encode(_extData))) % FIELD_SIZE, "Incorrect external data hash");
    
    require(_args.publicAmount == calculatePublicAmount(_extData.extAmount, _extData.fee), "Invalid public amount");
    require(verifyProof(_args), "Invalid transaction proof");

    //mark inputs as spent
    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      nullifierHashes[_args.inputNullifiers[i]] = true;
    }

    //withdraw to provided recepients
    if (_extData.extAmount < 0 && !_extData.isSwap) {
      require(_extData.recipient != address(0), "Can't withdraw to zero address");
      IERC20(_extData.tokenType).transfer(_extData.recipient, uint256(-_extData.extAmount));
    }
    if (_extData.fee > 0) {
      IERC20(_extData.tokenType).transfer(_extData.relayer, _extData.fee);
    }
    

    if(!_extData.isSwap){
      _insert(_args.outputCommitments[0], _args.outputCommitments[1]);
      emit NewCommitment(_args.outputCommitments[0], nextIndex - 2, _extData.encryptedOutput1);
      emit NewCommitment(_args.outputCommitments[1], nextIndex - 1, _extData.encryptedOutput2);
    }

    if(_extData.isSwap && _extData.extAmount <0){
      uint256 _amountOut = swapExactInputSingle(USDC,WETH, uint256(-_extData.extAmount));
      bytes32 comm = createCommitment(_extData.anonAddress, bytes32(_amountOut), _extData.tokenOut, _extData.rand);
      _insert(comm, _args.outputCommitments[1]);
      emit NewCommitment(comm, nextIndex - 2, _extData.encryptedOutput1);
      emit NewCommitment(_args.outputCommitments[1], nextIndex - 1, _extData.encryptedOutput2);
      emit NewSwap(_extData.anonAddress, _amountOut);
    }

    
    lastBalance[WETH] = IERC20(WETH).balanceOf(address(this));
    lastBalance[USDC] = IERC20(USDC).balanceOf(address(this));
    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      emit NewNullifier(_args.inputNullifiers[i]);
    }
    
  }

  function _configureLimits(uint256 _maximumDepositAmount) internal {
    maximumDepositAmount = _maximumDepositAmount;
  }

  
  // UNISWAP FUNCTIONALITY 

  uint24 public constant poolFee = 3000;

  /**  
    @notice swapExactInputSingle swaps a fixed amount of token for a maximum possible amount of USDC
    // using the token/USDC 0.3% pool by calling `exactInputSingle` in the swap router.
    @dev The calling address must approve this contract to spend at least `amountIn` worth of its token for this function to succeed.
    @param amountIn The exact amount of tokenIn that will be swapped for USDC.
    @return amountOut The amount of WETH9 received.
  */
    function swapExactInputSingle(address tokenIn, address tokenOut, uint256 amountIn) public  returns (uint256 amountOut) {
        

        // Approve the router to spend WETH.
        TransferHelper.safeApprove(tokenIn, address(swapRouter), amountIn);

        // Naively set amountOutMinimum to 0. In production, use an oracle or other data source to choose a safer value for amountOutMinimum.
        // We also set the sqrtPriceLimitx96 to be 0 to ensure we swap our exact input amount.
        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        // The call to `exactInputSingle` executes the swap.
        amountOut = swapRouter.exactInputSingle(params);        
      
    }


    function createCommitment(bytes32 anonAddress, bytes32 amountOut, address tokenOut, bytes32 rand) internal view  returns (bytes32) {
      
      bytes32[4] memory outputs;
      outputs[0] = anonAddress;
      outputs[1] = amountOut;
      outputs[2] = bytes32(uint256(uint160(tokenOut)));
      outputs[3] = rand;
      
      return hasher4.poseidon(outputs);

    }

    function bytes32ToString(bytes32 _bytes32) public pure returns (string memory) {
        uint8 i = 0;
        while(i < 32 && _bytes32[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }

}
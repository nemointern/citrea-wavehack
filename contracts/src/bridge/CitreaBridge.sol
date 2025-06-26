// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../tokens/WrappedBRC20.sol";

/**
 * @title CitreaBridge
 * @dev Main bridge contract for BRC20 <-> Wrapped ERC20 conversion
 */
contract CitreaBridge is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant INDEXER_ROLE = keccak256("INDEXER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    struct BridgeRequest {
        address user;
        string btcAddress;
        string brc20Ticker;
        uint256 amount;
        string btcTxHash;
        bool processed;
        uint256 timestamp;
    }
    
    struct WrappedToken {
        address contractAddress;
        string originalTicker;
        bool active;
        uint256 totalBridged;
    }
    
    // State variables
    mapping(string => WrappedToken) public wrappedTokens; // ticker => WrappedToken
    mapping(address => string) public userBtcAddresses; // user => btc address
    mapping(string => bool) public processedTxHashes; // btc tx hash => processed
    mapping(uint256 => BridgeRequest) public bridgeRequests; // id => request
    
    uint256 public nextRequestId;
    uint256 public constant CONFIRMATION_BLOCKS = 6; // Bitcoin confirmations needed
    
    // Events
    event UserRegistered(address indexed user, string btcAddress);
    event WrappedTokenDeployed(string indexed ticker, address indexed tokenAddress);
    event BridgeRequestCreated(uint256 indexed requestId, address indexed user, string ticker, uint256 amount);
    event BridgeCompleted(uint256 indexed requestId, address indexed user, address indexed token, uint256 amount);
    event BridgeBack(address indexed user, address indexed token, uint256 amount, string btcAddress);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(INDEXER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }
    
    /**
     * @dev Register user with their Bitcoin address
     * @param btcAddress User's Bitcoin address for receiving BRC20
     */
    function registerUser(string memory btcAddress) external {
        require(bytes(btcAddress).length > 0, "BTC address cannot be empty");
        require(bytes(userBtcAddresses[msg.sender]).length == 0, "User already registered");
        
        userBtcAddresses[msg.sender] = btcAddress;
        emit UserRegistered(msg.sender, btcAddress);
    }
    
    /**
     * @dev Deploy new wrapped token for BRC20
     * @param ticker Original BRC20 ticker
     * @param name ERC20 name
     * @param symbol ERC20 symbol
     * @param maxSupply Maximum supply that can be bridged
     */
    function deployWrappedToken(
        string memory ticker,
        string memory name,
        string memory symbol,
        uint256 maxSupply
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(wrappedTokens[ticker].contractAddress == address(0), "Token already exists");
        
        WrappedBRC20 wrappedToken = new WrappedBRC20(name, symbol, ticker, maxSupply);
        wrappedToken.grantRole(wrappedToken.BRIDGE_ROLE(), address(this));
        
        wrappedTokens[ticker] = WrappedToken({
            contractAddress: address(wrappedToken),
            originalTicker: ticker,
            active: true,
            totalBridged: 0
        });
        
        emit WrappedTokenDeployed(ticker, address(wrappedToken));
    }
    
    /**
     * @dev Process bridge request from Bitcoin to Citrea (called by indexer)
     * @param user User address on Citrea
     * @param ticker BRC20 ticker
     * @param amount Amount to bridge
     * @param btcTxHash Bitcoin transaction hash
     */
    function processBridgeIn(
        address user,
        string memory ticker,
        uint256 amount,
        string memory btcTxHash
    ) external onlyRole(INDEXER_ROLE) whenNotPaused nonReentrant {
        require(user != address(0), "Invalid user address");
        require(amount > 0, "Amount must be greater than 0");
        require(!processedTxHashes[btcTxHash], "Transaction already processed");
        require(wrappedTokens[ticker].active, "Token not supported");
        
        // Create bridge request
        uint256 requestId = nextRequestId++;
        bridgeRequests[requestId] = BridgeRequest({
            user: user,
            btcAddress: userBtcAddresses[user],
            brc20Ticker: ticker,
            amount: amount,
            btcTxHash: btcTxHash,
            processed: false,
            timestamp: block.timestamp
        });
        
        // Mark transaction as processed
        processedTxHashes[btcTxHash] = true;
        
        // Mint wrapped tokens
        WrappedBRC20 wrappedToken = WrappedBRC20(wrappedTokens[ticker].contractAddress);
        wrappedToken.bridgeMint(user, amount, btcTxHash);
        
        // Update tracking
        wrappedTokens[ticker].totalBridged += amount;
        bridgeRequests[requestId].processed = true;
        
        emit BridgeRequestCreated(requestId, user, ticker, amount);
        emit BridgeCompleted(requestId, user, address(wrappedToken), amount);
    }
    
    /**
     * @dev Bridge tokens back to Bitcoin
     * @param ticker BRC20 ticker
     * @param amount Amount to bridge back
     */
    function bridgeOut(
        string memory ticker,
        uint256 amount
    ) external whenNotPaused nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(wrappedTokens[ticker].active, "Token not supported");
        require(bytes(userBtcAddresses[msg.sender]).length > 0, "User not registered");
        
        WrappedBRC20 wrappedToken = WrappedBRC20(wrappedTokens[ticker].contractAddress);
        require(wrappedToken.balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        // Burn wrapped tokens
        wrappedToken.bridgeBurn(msg.sender, amount, userBtcAddresses[msg.sender]);
        
        // Update tracking
        wrappedTokens[ticker].totalBridged -= amount;
        
        emit BridgeBack(msg.sender, address(wrappedToken), amount, userBtcAddresses[msg.sender]);
    }
    
    /**
     * @dev Associate an externally deployed wrapped token (admin only)
     * @param ticker BRC20 ticker
     * @param tokenAddress Address of the deployed WrappedBRC20 contract
     */
    function setWrappedToken(string memory ticker, address tokenAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(tokenAddress != address(0), "Invalid token address");
        
        // Get token info from the contract
        WrappedBRC20 wrappedToken = WrappedBRC20(tokenAddress);
        
        wrappedTokens[ticker] = WrappedToken({
            contractAddress: tokenAddress,
            originalTicker: ticker,
            active: true,
            totalBridged: 0
        });
        
        emit WrappedTokenDeployed(ticker, tokenAddress);
    }

    /**
     * @dev Get wrapped token address for ticker
     */
    function getWrappedToken(string memory ticker) external view returns (address) {
        return wrappedTokens[ticker].contractAddress;
    }
    
    /**
     * @dev Check if user is registered
     */
    function isUserRegistered(address user) external view returns (bool) {
        return bytes(userBtcAddresses[user]).length > 0;
    }
    
    /**
     * @dev Pause bridge operations
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause bridge operations
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
} 
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title WrappedBRC20
 * @dev ERC20 wrapper for BRC20 tokens bridged from Bitcoin
 */
contract WrappedBRC20 is ERC20, AccessControl, Pausable {
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    // Original BRC20 token info
    string public originalTicker;
    uint256 public immutable bridgedTotalSupply;
    
    // Bridge tracking
    mapping(address => uint256) public bridgedAmounts;
    uint256 public totalBridged;
    
    event BridgeMint(address indexed to, uint256 amount, string btcTxHash);
    event BridgeBurn(address indexed from, uint256 amount, string btcAddress);
    
    constructor(
        string memory name,
        string memory symbol,
        string memory _originalTicker,
        uint256 _bridgedTotalSupply
    ) ERC20(name, symbol) {
        originalTicker = _originalTicker;
        bridgedTotalSupply = _bridgedTotalSupply;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BRIDGE_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }
    
    /**
     * @dev Mint tokens when bridged from Bitcoin
     * @param to Recipient address
     * @param amount Amount to mint
     * @param btcTxHash Bitcoin transaction hash proving the bridge
     */
    function bridgeMint(
        address to, 
        uint256 amount, 
        string memory btcTxHash
    ) external onlyRole(BRIDGE_ROLE) whenNotPaused {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than 0");
        require(totalBridged + amount <= bridgedTotalSupply, "Exceeds bridged supply");
        
        bridgedAmounts[to] += amount;
        totalBridged += amount;
        
        _mint(to, amount);
        emit BridgeMint(to, amount, btcTxHash);
    }
    
    /**
     * @dev Burn tokens to bridge back to Bitcoin
     * @param from Address to burn from
     * @param amount Amount to burn
     * @param btcAddress Bitcoin address to receive BRC20
     */
    function bridgeBurn(
        address from, 
        uint256 amount, 
        string memory btcAddress
    ) external onlyRole(BRIDGE_ROLE) whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(from) >= amount, "Insufficient balance");
        require(bridgedAmounts[from] >= amount, "Exceeds bridged amount");
        
        bridgedAmounts[from] -= amount;
        totalBridged -= amount;
        
        _burn(from, amount);
        emit BridgeBurn(from, amount, btcAddress);
    }
    
    /**
     * @dev Pause contract functions
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause contract functions
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Get remaining bridge capacity
     */
    function bridgeCapacityRemaining() external view returns (uint256) {
        return bridgedTotalSupply - totalBridged;
    }
} 
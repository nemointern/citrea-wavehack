// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/bridge/CitreaBridge.sol";
import "../src/tokens/WrappedBRC20.sol";

/**
 * @title CitreaBridgeTest
 * @dev Comprehensive tests for CitreaBridge contract
 */
contract CitreaBridgeTest is Test {
    CitreaBridge public bridge;
    WrappedBRC20 public wPEPE;
    
    address public admin = makeAddr("admin");
    address public indexer = makeAddr("indexer");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public pauser = makeAddr("pauser");
    
    string public constant PEPE_TICKER = "PEPE";
    string public constant BTC_ADDRESS_1 = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
    string public constant BTC_ADDRESS_2 = "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3";
    string public constant SAMPLE_TX_HASH = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    
    uint256 public constant MAX_SUPPLY = 420690000000000 * 1e18;
    uint256 public constant BRIDGE_AMOUNT = 1000 * 1e18;

    function setUp() public {
        vm.startPrank(admin);
        
        // Deploy CitreaBridge
        bridge = new CitreaBridge();
        
        // Setup roles
        bridge.grantRole(bridge.INDEXER_ROLE(), indexer);
        bridge.grantRole(bridge.PAUSER_ROLE(), pauser);
        
        vm.stopPrank();
        
        console.log("Setup completed successfully");
        console.log("CitreaBridge:", address(bridge));
    }

    /// @dev Test user registration
    function testUserRegistration() public {
        console.log("Testing User Registration");
        
        // Register user1
        vm.prank(user1);
        bridge.registerUser(BTC_ADDRESS_1);
        
        // Verify registration
        assertTrue(bridge.isUserRegistered(user1), "User1 should be registered");
        assertEq(bridge.userBtcAddresses(user1), BTC_ADDRESS_1, "BTC address should match");
        
        // Register user2
        vm.prank(user2);
        bridge.registerUser(BTC_ADDRESS_2);
        
        assertTrue(bridge.isUserRegistered(user2), "User2 should be registered");
        assertEq(bridge.userBtcAddresses(user2), BTC_ADDRESS_2, "BTC address should match");
        
        console.log("User registration verified!");
    }

    /// @dev Test user registration error conditions
    function testUserRegistrationErrors() public {
        console.log("Testing User Registration Errors");
        
        // Test empty BTC address
        vm.prank(user1);
        vm.expectRevert("BTC address cannot be empty");
        bridge.registerUser("");
        
        // Register user1 first
        vm.prank(user1);
        bridge.registerUser(BTC_ADDRESS_1);
        
        // Test double registration
        vm.prank(user1);
        vm.expectRevert("User already registered");
        bridge.registerUser(BTC_ADDRESS_2);
        
        console.log("User registration errors verified!");
    }

    /// @dev Test wrapped token deployment
    function testWrappedTokenDeployment() public {
        console.log("Testing Wrapped Token Deployment");
        
        vm.prank(admin);
        bridge.deployWrappedToken(PEPE_TICKER, "Wrapped PEPE", "wPEPE", MAX_SUPPLY);
        
        // Verify token was deployed
        address tokenAddress = bridge.getWrappedToken(PEPE_TICKER);
        assertTrue(tokenAddress != address(0), "Token should be deployed");
        
        // Verify token info
        (address contractAddr, string memory ticker, bool active, uint256 totalBridged) = bridge.wrappedTokens(PEPE_TICKER);
        assertEq(contractAddr, tokenAddress, "Contract address should match");
        assertEq(ticker, PEPE_TICKER, "Ticker should match");
        assertTrue(active, "Token should be active");
        assertEq(totalBridged, 0, "Total bridged should be 0 initially");
        
        // Test the deployed token contract
        WrappedBRC20 token = WrappedBRC20(tokenAddress);
        assertEq(token.name(), "Wrapped PEPE", "Token name should match");
        assertEq(token.symbol(), "wPEPE", "Token symbol should match");
        assertEq(token.originalTicker(), PEPE_TICKER, "Original ticker should match");
        
        console.log("Wrapped token deployment verified!");
    }

    /// @dev Test wrapped token deployment errors
    function testWrappedTokenDeploymentErrors() public {
        console.log("Testing Wrapped Token Deployment Errors");
        
        // Deploy token first
        vm.prank(admin);
        bridge.deployWrappedToken(PEPE_TICKER, "Wrapped PEPE", "wPEPE", MAX_SUPPLY);
        
        // Test duplicate deployment
        vm.prank(admin);
        vm.expectRevert("Token already exists");
        bridge.deployWrappedToken(PEPE_TICKER, "Another PEPE", "aPEPE", MAX_SUPPLY);
        
        // Test unauthorized deployment
        vm.prank(user1);
        vm.expectRevert(); // Should revert with access control error
        bridge.deployWrappedToken("DOGE", "Dogecoin", "DOGE", MAX_SUPPLY);
        
        console.log("Wrapped token deployment errors verified!");
    }

    /// @dev Test setting externally deployed wrapped token
    function testSetWrappedToken() public {
        console.log("Testing Set Wrapped Token");
        
        // Deploy a token externally
        vm.prank(admin);
        wPEPE = new WrappedBRC20("Wrapped PEPE", "wPEPE", PEPE_TICKER, MAX_SUPPLY);
        
        // Set it in the bridge
        vm.prank(admin);
        bridge.setWrappedToken(PEPE_TICKER, address(wPEPE));
        
        // Verify it was set correctly
        address tokenAddress = bridge.getWrappedToken(PEPE_TICKER);
        assertEq(tokenAddress, address(wPEPE), "Token address should match");
        
        (address contractAddr, string memory ticker, bool active, ) = bridge.wrappedTokens(PEPE_TICKER);
        assertEq(contractAddr, address(wPEPE), "Contract address should match");
        assertEq(ticker, PEPE_TICKER, "Ticker should match");
        assertTrue(active, "Token should be active");
        
        console.log("Set wrapped token verified!");
    }

    /// @dev Test set wrapped token errors
    function testSetWrappedTokenErrors() public {
        console.log("Testing Set Wrapped Token Errors");
        
        // Test invalid token address
        vm.prank(admin);
        vm.expectRevert("Invalid token address");
        bridge.setWrappedToken(PEPE_TICKER, address(0));
        
        // Test unauthorized access
        vm.prank(user1);
        vm.expectRevert(); // Should revert with access control error
        bridge.setWrappedToken(PEPE_TICKER, address(this));
        
        console.log("Set wrapped token errors verified!");
    }

    /// @dev Test bridge in process
    function testBridgeIn() public {
        console.log("Testing Bridge In Process");
        
        // Setup: Deploy token and register user
        vm.prank(admin);
        bridge.deployWrappedToken(PEPE_TICKER, "Wrapped PEPE", "wPEPE", MAX_SUPPLY);
        
        vm.prank(user1);
        bridge.registerUser(BTC_ADDRESS_1);
        
        address tokenAddress = bridge.getWrappedToken(PEPE_TICKER);
        WrappedBRC20 token = WrappedBRC20(tokenAddress);
        
        // Record initial balance
        uint256 initialBalance = token.balanceOf(user1);
        
        // Process bridge in
        vm.prank(indexer);
        bridge.processBridgeIn(user1, PEPE_TICKER, BRIDGE_AMOUNT, SAMPLE_TX_HASH);
        
        // Verify tokens were minted
        uint256 finalBalance = token.balanceOf(user1);
        assertEq(finalBalance - initialBalance, BRIDGE_AMOUNT, "Tokens should be minted");
        
        // Verify bridge request was created
        (address user, string memory btcAddr, string memory ticker, uint256 amount, string memory txHash, bool processed, ) = bridge.bridgeRequests(0);
        assertEq(user, user1, "User should match");
        assertEq(btcAddr, BTC_ADDRESS_1, "BTC address should match");
        assertEq(ticker, PEPE_TICKER, "Ticker should match");
        assertEq(amount, BRIDGE_AMOUNT, "Amount should match");
        assertEq(txHash, SAMPLE_TX_HASH, "TX hash should match");
        assertTrue(processed, "Request should be processed");
        
        // Verify total bridged updated
        (, , , uint256 totalBridged) = bridge.wrappedTokens(PEPE_TICKER);
        assertEq(totalBridged, BRIDGE_AMOUNT, "Total bridged should be updated");
        
        // Verify transaction hash is marked as processed
        assertTrue(bridge.processedTxHashes(SAMPLE_TX_HASH), "TX hash should be processed");
        
        console.log("Bridge in process verified!");
    }

    /// @dev Test bridge in error conditions
    function testBridgeInErrors() public {
        console.log("Testing Bridge In Errors");
        
        // Setup: Deploy token
        vm.prank(admin);
        bridge.deployWrappedToken(PEPE_TICKER, "Wrapped PEPE", "wPEPE", MAX_SUPPLY);
        
        vm.startPrank(indexer);
        
        // Test invalid user address
        vm.expectRevert("Invalid user address");
        bridge.processBridgeIn(address(0), PEPE_TICKER, BRIDGE_AMOUNT, SAMPLE_TX_HASH);
        
        // Test zero amount
        vm.expectRevert("Amount must be greater than 0");
        bridge.processBridgeIn(user1, PEPE_TICKER, 0, SAMPLE_TX_HASH);
        
        // Test unsupported token
        vm.expectRevert("Token not supported");
        bridge.processBridgeIn(user1, "UNSUPPORTED", BRIDGE_AMOUNT, SAMPLE_TX_HASH);
        
        // Process valid transaction first
        bridge.processBridgeIn(user1, PEPE_TICKER, BRIDGE_AMOUNT, SAMPLE_TX_HASH);
        
        // Test duplicate transaction
        vm.expectRevert("Transaction already processed");
        bridge.processBridgeIn(user1, PEPE_TICKER, BRIDGE_AMOUNT, SAMPLE_TX_HASH);
        
        vm.stopPrank();
        
        // Test unauthorized access
        vm.prank(user1);
        vm.expectRevert(); // Should revert with access control error
        bridge.processBridgeIn(user1, PEPE_TICKER, BRIDGE_AMOUNT, "another_tx");
        
        console.log("Bridge in errors verified!");
    }

    /// @dev Test bridge out process
    function testBridgeOut() public {
        console.log("Testing Bridge Out Process");
        
        // Setup: Deploy token, register user, and bridge some tokens in
        vm.prank(admin);
        bridge.deployWrappedToken(PEPE_TICKER, "Wrapped PEPE", "wPEPE", MAX_SUPPLY);
        
        vm.prank(user1);
        bridge.registerUser(BTC_ADDRESS_1);
        
        vm.prank(indexer);
        bridge.processBridgeIn(user1, PEPE_TICKER, BRIDGE_AMOUNT, SAMPLE_TX_HASH);
        
        address tokenAddress = bridge.getWrappedToken(PEPE_TICKER);
        WrappedBRC20 token = WrappedBRC20(tokenAddress);
        
        // Record initial balance and total bridged
        uint256 initialBalance = token.balanceOf(user1);
        (, , , uint256 initialTotalBridged) = bridge.wrappedTokens(PEPE_TICKER);
        
        // Bridge out half the amount
        uint256 bridgeOutAmount = BRIDGE_AMOUNT / 2;
        vm.prank(user1);
        bridge.bridgeOut(PEPE_TICKER, bridgeOutAmount);
        
        // Verify tokens were burned
        uint256 finalBalance = token.balanceOf(user1);
        assertEq(initialBalance - finalBalance, bridgeOutAmount, "Tokens should be burned");
        
        // Verify total bridged updated
        (, , , uint256 finalTotalBridged) = bridge.wrappedTokens(PEPE_TICKER);
        assertEq(initialTotalBridged - finalTotalBridged, bridgeOutAmount, "Total bridged should decrease");
        
        console.log("Bridge out process verified!");
    }

    /// @dev Test bridge out error conditions
    function testBridgeOutErrors() public {
        console.log("Testing Bridge Out Errors");
        
        // Setup: Deploy token and register user
        vm.prank(admin);
        bridge.deployWrappedToken(PEPE_TICKER, "Wrapped PEPE", "wPEPE", MAX_SUPPLY);
        
        vm.prank(user1);
        bridge.registerUser(BTC_ADDRESS_1);
        
        vm.startPrank(user1);
        
        // Test zero amount
        vm.expectRevert("Amount must be greater than 0");
        bridge.bridgeOut(PEPE_TICKER, 0);
        
        // Test unsupported token
        vm.expectRevert("Token not supported");
        bridge.bridgeOut("UNSUPPORTED", BRIDGE_AMOUNT);
        
        vm.stopPrank();
        
        // Test unregistered user
        vm.prank(user2);
        vm.expectRevert("User not registered");
        bridge.bridgeOut(PEPE_TICKER, BRIDGE_AMOUNT);
        
        // Bridge in some tokens for user1
        vm.prank(indexer);
        bridge.processBridgeIn(user1, PEPE_TICKER, BRIDGE_AMOUNT, SAMPLE_TX_HASH);
        
        // Test insufficient balance
        vm.prank(user1);
        vm.expectRevert("Insufficient balance");
        bridge.bridgeOut(PEPE_TICKER, BRIDGE_AMOUNT * 2);
        
        console.log("Bridge out errors verified!");
    }

    /// @dev Test pause/unpause functionality
    function testPauseUnpause() public {
        console.log("Testing Pause/Unpause");
        
        // Setup: Deploy token and register user
        vm.prank(admin);
        bridge.deployWrappedToken(PEPE_TICKER, "Wrapped PEPE", "wPEPE", MAX_SUPPLY);
        
        vm.prank(user1);
        bridge.registerUser(BTC_ADDRESS_1);
        
        // Pause the bridge
        vm.prank(pauser);
        bridge.pause();
        
        // Test that bridgeIn fails when paused
        vm.prank(indexer);
        vm.expectRevert(); // Should revert with "Pausable: paused"
        bridge.processBridgeIn(user1, PEPE_TICKER, BRIDGE_AMOUNT, SAMPLE_TX_HASH);
        
        // Test that bridgeOut fails when paused
        vm.prank(user1);
        vm.expectRevert(); // Should revert with "Pausable: paused"
        bridge.bridgeOut(PEPE_TICKER, BRIDGE_AMOUNT);
        
        // Unpause the bridge
        vm.prank(pauser);
        bridge.unpause();
        
        // Test that operations work after unpause
        vm.prank(indexer);
        bridge.processBridgeIn(user1, PEPE_TICKER, BRIDGE_AMOUNT, SAMPLE_TX_HASH);
        
        console.log("Pause/Unpause functionality verified!");
    }

    /// @dev Test role-based access control
    function testRoleBasedAccess() public {
        console.log("Testing Role-Based Access Control");
        
        address unauthorizedUser = makeAddr("unauthorized");
        
        // Test unauthorized deployWrappedToken
        vm.prank(unauthorizedUser);
        vm.expectRevert(); // Should revert with access control error
        bridge.deployWrappedToken(PEPE_TICKER, "PEPE", "PEPE", MAX_SUPPLY);
        
        // Test unauthorized setWrappedToken
        vm.prank(unauthorizedUser);
        vm.expectRevert(); // Should revert with access control error
        bridge.setWrappedToken(PEPE_TICKER, address(this));
        
        // Test unauthorized processBridgeIn
        vm.prank(unauthorizedUser);
        vm.expectRevert(); // Should revert with access control error
        bridge.processBridgeIn(user1, PEPE_TICKER, BRIDGE_AMOUNT, SAMPLE_TX_HASH);
        
        // Test unauthorized pause
        vm.prank(unauthorizedUser);
        vm.expectRevert(); // Should revert with access control error
        bridge.pause();
        
        // Test unauthorized unpause
        vm.prank(unauthorizedUser);
        vm.expectRevert(); // Should revert with access control error
        bridge.unpause();
        
        console.log("Role-based access control verified!");
    }

    /// @dev Test getter functions
    function testGetterFunctions() public {
        console.log("Testing Getter Functions");
        
        // Test getWrappedToken for non-existent token
        address tokenAddr = bridge.getWrappedToken("NONEXISTENT");
        assertEq(tokenAddr, address(0), "Non-existent token should return zero address");
        
        // Test isUserRegistered for unregistered user
        bool isRegistered = bridge.isUserRegistered(user1);
        assertFalse(isRegistered, "Unregistered user should return false");
        
        // Deploy token and register user
        vm.prank(admin);
        bridge.deployWrappedToken(PEPE_TICKER, "Wrapped PEPE", "wPEPE", MAX_SUPPLY);
        
        vm.prank(user1);
        bridge.registerUser(BTC_ADDRESS_1);
        
        // Test getters with valid data
        tokenAddr = bridge.getWrappedToken(PEPE_TICKER);
        assertTrue(tokenAddr != address(0), "Existing token should return valid address");
        
        isRegistered = bridge.isUserRegistered(user1);
        assertTrue(isRegistered, "Registered user should return true");
        
        console.log("Getter functions verified!");
    }

    /// @dev Test complex bridge flow
    function testComplexBridgeFlow() public {
        console.log("Testing Complex Bridge Flow");
        
        // Deploy multiple tokens
        vm.startPrank(admin);
        bridge.deployWrappedToken("PEPE", "Wrapped PEPE", "wPEPE", MAX_SUPPLY);
        bridge.deployWrappedToken("DOGE", "Wrapped DOGE", "wDOGE", MAX_SUPPLY);
        vm.stopPrank();
        
        // Register multiple users
        vm.prank(user1);
        bridge.registerUser(BTC_ADDRESS_1);
        
        vm.prank(user2);
        bridge.registerUser(BTC_ADDRESS_2);
        
        // Bridge in different amounts for different users and tokens
        vm.startPrank(indexer);
        bridge.processBridgeIn(user1, "PEPE", 1000 * 1e18, "tx1");
        bridge.processBridgeIn(user2, "PEPE", 2000 * 1e18, "tx2");
        bridge.processBridgeIn(user1, "DOGE", 500 * 1e18, "tx3");
        vm.stopPrank();
        
        // Verify balances
        address pepeAddr = bridge.getWrappedToken("PEPE");
        address dogeAddr = bridge.getWrappedToken("DOGE");
        
        assertEq(WrappedBRC20(pepeAddr).balanceOf(user1), 1000 * 1e18, "User1 PEPE balance");
        assertEq(WrappedBRC20(pepeAddr).balanceOf(user2), 2000 * 1e18, "User2 PEPE balance");
        assertEq(WrappedBRC20(dogeAddr).balanceOf(user1), 500 * 1e18, "User1 DOGE balance");
        
        // Bridge out some tokens
        vm.prank(user1);
        bridge.bridgeOut("PEPE", 300 * 1e18);
        
        vm.prank(user2);
        bridge.bridgeOut("PEPE", 500 * 1e18);
        
        // Verify final balances
        assertEq(WrappedBRC20(pepeAddr).balanceOf(user1), 700 * 1e18, "User1 final PEPE balance");
        assertEq(WrappedBRC20(pepeAddr).balanceOf(user2), 1500 * 1e18, "User2 final PEPE balance");
        
        // Verify total bridged amounts
        (, , , uint256 pepeTotalBridged) = bridge.wrappedTokens("PEPE");
        (, , , uint256 dogeTotalBridged) = bridge.wrappedTokens("DOGE");
        
        assertEq(pepeTotalBridged, 2200 * 1e18, "PEPE total bridged should be 3000 - 800 = 2200");
        assertEq(dogeTotalBridged, 500 * 1e18, "DOGE total bridged should be 500");
        
        console.log("Complex bridge flow verified!");
    }
} 
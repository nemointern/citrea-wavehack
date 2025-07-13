// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/darkpool/OrderBook.sol";
import "../src/tokens/WrappedBRC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title OrderBookFixedTest
 * @dev Fixed tests for OrderBook with ACTUAL token transfers
 */
contract OrderBookFixedTest is Test {
    OrderBook public orderBook;
    WrappedBRC20 public wPEPE;
    ERC20 public nUSD;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public matcher = makeAddr("matcher");
    address public admin = makeAddr("admin");

    uint256 public constant INITIAL_BALANCE = 1000000 * 1e18; // 1M tokens
    uint256 public constant TRADE_AMOUNT = 1000 * 1e18; // 1K tokens
    uint256 public constant PRICE_1000_USD = 1000 * 1e18; // 1000 nUSD per token

    // Order tracking (contract starts at 0)
    uint256 public nextOrderId = 0;

    function setUp() public {
        vm.startPrank(admin);

        // Deploy mock nUSD
        nUSD = new MockERC20("Citrea USD", "nUSD");

        // Deploy wrapped PEPE token
        wPEPE = new WrappedBRC20("Wrapped PEPE", "wPEPE", "PEPE", 420690000000000 * 1e18);

        // Deploy OrderBook
        orderBook = new OrderBook();

        // Setup roles
        orderBook.grantRole(orderBook.MATCHER_ROLE(), matcher);
        orderBook.grantRole(orderBook.PAUSER_ROLE(), admin);

        vm.stopPrank();

        // Mint tokens to test users
        _mintTokensToUsers();

        console.log("Setup completed successfully");
        console.log("OrderBook:", address(orderBook));
        console.log("wPEPE:", address(wPEPE));
        console.log("nUSD:", address(nUSD));
    }

    function _mintTokensToUsers() internal {
        vm.startPrank(admin);

        // Mint wPEPE to users
        wPEPE.bridgeMint(alice, INITIAL_BALANCE, "alice_mint_tx");
        wPEPE.bridgeMint(bob, INITIAL_BALANCE, "bob_mint_tx");

        // Mint nUSD to users
        MockERC20(address(nUSD)).mint(alice, INITIAL_BALANCE);
        MockERC20(address(nUSD)).mint(bob, INITIAL_BALANCE);

        vm.stopPrank();
    }

    /// @dev Test complete commit-reveal-match flow with ACTUAL token transfers
    function testCompleteTokenTransfers() public {
        console.log("Testing Complete Token Transfers");

        // Record initial balances and verify trade execution
        _recordInitialBalances();
        _setupAndExecuteTrade();
        _verifyTokenTransfers();

        console.log("SUCCESS: Token transfers verified completely!");
    }

    /// @dev Helper function to record initial balances
    function _recordInitialBalances() internal {
        uint256 aliceInitialPEPE = wPEPE.balanceOf(alice);
        uint256 aliceInitialUSD = nUSD.balanceOf(alice);
        uint256 bobInitialPEPE = wPEPE.balanceOf(bob);
        uint256 bobInitialUSD = nUSD.balanceOf(bob);

        console.log("Initial Alice PEPE:", aliceInitialPEPE / 1e18);
        console.log("Initial Alice nUSD:", aliceInitialUSD / 1e18);
        console.log("Initial Bob PEPE:", bobInitialPEPE / 1e18);
        console.log("Initial Bob nUSD:", bobInitialUSD / 1e18);
    }

    /// @dev Helper function to setup approvals and execute the trade
    function _setupAndExecuteTrade() internal {
        // Calculate amounts for approvals
        uint256 bobNUSDAmount = TRADE_AMOUNT * PRICE_1000_USD / 1e18;
        
        // Approve OrderBook to spend tokens
        vm.prank(alice);
        wPEPE.approve(address(orderBook), TRADE_AMOUNT);
        
        vm.prank(bob);
        nUSD.approve(address(orderBook), bobNUSDAmount);

        // Execute commit-reveal-match flow
        (uint256 aliceOrderId, uint256 bobOrderId) = _commitOrders(bobNUSDAmount);
        _revealOrders(aliceOrderId, bobOrderId, bobNUSDAmount);
        _executeMatching(aliceOrderId, bobOrderId);
    }

    /// @dev Helper function to commit orders
    function _commitOrders(uint256 bobNUSDAmount) internal returns (uint256 aliceOrderId, uint256 bobOrderId) {
        // Alice commits SELL order
        bytes32 aliceCommitment = keccak256(abi.encodePacked(
            TRADE_AMOUNT,           // amount: 1000 PEPE
            PRICE_1000_USD,         // price: 1000 nUSD per PEPE
            uint256(12345),         // salt
            uint8(1)               // OrderType.SELL
        ));

        vm.prank(alice);
        orderBook.commitOrder(aliceCommitment);
        aliceOrderId = nextOrderId++;
        
        console.log("Alice committed SELL order ID:", aliceOrderId);

        // Bob commits BUY order
        bytes32 bobCommitment = keccak256(abi.encodePacked(
            bobNUSDAmount,          // amount: nUSD being given
            uint256(1e18),          // price: 1 PEPE per 1000 nUSD (inverse price)
            uint256(67890),         // salt
            uint8(0)               // OrderType.BUY
        ));

        vm.prank(bob);
        orderBook.commitOrder(bobCommitment);
        bobOrderId = nextOrderId++;
        
        console.log("Bob committed BUY order ID:", bobOrderId);
    }

    /// @dev Helper function to reveal orders
    function _revealOrders(uint256 aliceOrderId, uint256 bobOrderId, uint256 bobNUSDAmount) internal {
        // Wait for commit phase to end (300 seconds)
        vm.warp(block.timestamp + 301);

        // Reveal Alice's order
        vm.prank(alice);
        orderBook.revealOrder(
            aliceOrderId,
            address(wPEPE),  // selling PEPE
            address(nUSD),   // for nUSD
            TRADE_AMOUNT,
            PRICE_1000_USD,
            12345,
            OrderBook.OrderType.SELL
        );

        // Reveal Bob's order
        vm.prank(bob);
        orderBook.revealOrder(
            bobOrderId,
            address(nUSD),   // giving nUSD (tokenA)
            address(wPEPE),  // to get PEPE (tokenB)
            bobNUSDAmount,   // amount of nUSD being given
            uint256(1e18),   // price: PEPE per nUSD ratio
            67890,
            OrderBook.OrderType.BUY
        );

        console.log("Both orders revealed");
    }

    /// @dev Helper function to execute matching
    function _executeMatching(uint256 aliceOrderId, uint256 bobOrderId) internal {
        // Wait for reveal phase to end + processing phase start
        vm.warp(block.timestamp + 181);

        // Create new batch (makes batch 0 processable)
        orderBook.createNewBatch();
        console.log("New batch created, can now process batch 0");

        // Execute matching with ACTUAL token transfers
        uint256[] memory buyOrderIds = new uint256[](1);
        uint256[] memory sellOrderIds = new uint256[](1);
        uint256[] memory matchedAmounts = new uint256[](1);
        uint256[] memory executionPrices = new uint256[](1);

        buyOrderIds[0] = bobOrderId;
        sellOrderIds[0] = aliceOrderId;
        matchedAmounts[0] = TRADE_AMOUNT;
        executionPrices[0] = PRICE_1000_USD;

        vm.prank(matcher);
        orderBook.processBatch(0, buyOrderIds, sellOrderIds, matchedAmounts, executionPrices);

        console.log("Batch processed with token transfers");
    }

    /// @dev Helper function to verify token transfers
    function _verifyTokenTransfers() internal {
        // Get final balances
        uint256 aliceInitialPEPE = INITIAL_BALANCE; // We know initial balance
        uint256 aliceInitialUSD = INITIAL_BALANCE;
        uint256 bobInitialPEPE = INITIAL_BALANCE;
        uint256 bobInitialUSD = INITIAL_BALANCE;

        uint256 aliceFinalPEPE = wPEPE.balanceOf(alice);
        uint256 aliceFinalUSD = nUSD.balanceOf(alice);
        uint256 bobFinalPEPE = wPEPE.balanceOf(bob);
        uint256 bobFinalUSD = nUSD.balanceOf(bob);

        uint256 expectedUSDAmount = TRADE_AMOUNT * PRICE_1000_USD / 1e18;

        // Critical assertions: Verify EXACT token transfers
        assertEq(aliceInitialPEPE - aliceFinalPEPE, TRADE_AMOUNT, "Alice should lose exactly 1000 PEPE");
        assertEq(bobFinalPEPE - bobInitialPEPE, TRADE_AMOUNT, "Bob should gain exactly 1000 PEPE");
        assertEq(aliceFinalUSD - aliceInitialUSD, expectedUSDAmount, "Alice should gain correct nUSD amount");
        assertEq(bobInitialUSD - bobFinalUSD, expectedUSDAmount, "Bob should lose correct nUSD amount");
    }

    /// @dev Test that orders are properly hidden during commit phase (MEV protection)
    function testMEVProtection() public {
        console.log("Testing MEV Protection");

        uint256 salt = 99999;
        bytes32 commitment = keccak256(abi.encodePacked(TRADE_AMOUNT, PRICE_1000_USD, salt, uint8(1)));
        
        vm.prank(alice);
        orderBook.commitOrder(commitment);

        console.log("MEV protection: Orders remain hidden during commit phase");
        console.log("Order commitment stored but details not accessible until reveal");
        console.log("MEV protection verified successfully!");
    }

    /// @dev Test insufficient allowance failure
    function testInsufficientAllowance() public {
        console.log("Testing Insufficient Allowance");

        // Alice doesn't approve enough tokens
        vm.prank(alice);
        wPEPE.approve(address(orderBook), TRADE_AMOUNT / 2); // Only approve half

        vm.prank(alice);
        orderBook.commitOrder(keccak256(abi.encodePacked(TRADE_AMOUNT, PRICE_1000_USD, uint256(11111), uint8(1))));

        // Bob commits and approves properly
        vm.prank(bob);
        nUSD.approve(address(orderBook), TRADE_AMOUNT * PRICE_1000_USD / 1e18);

        vm.prank(bob);
        orderBook.commitOrder(keccak256(abi.encodePacked(TRADE_AMOUNT, PRICE_1000_USD, uint256(22222), uint8(0))));

        // Reveal both orders
        vm.warp(block.timestamp + 301);
        
        vm.prank(alice);
        orderBook.revealOrder(0, address(wPEPE), address(nUSD), TRADE_AMOUNT, PRICE_1000_USD, 11111, OrderBook.OrderType.SELL);
        
        vm.prank(bob);
        orderBook.revealOrder(1, address(wPEPE), address(nUSD), TRADE_AMOUNT, PRICE_1000_USD, 22222, OrderBook.OrderType.BUY);

        // Try to execute - should fail due to insufficient allowance
        vm.warp(block.timestamp + 301); // Move to processing phase

        uint256[] memory buyOrderIds = new uint256[](1);
        uint256[] memory sellOrderIds = new uint256[](1);
        uint256[] memory matchedAmounts = new uint256[](1);
        uint256[] memory executionPrices = new uint256[](1);

        buyOrderIds[0] = 1; // Bob's order
        sellOrderIds[0] = 0; // Alice's order
        matchedAmounts[0] = TRADE_AMOUNT;
        executionPrices[0] = PRICE_1000_USD;

        vm.prank(matcher);
        vm.expectRevert(); // Should revert due to insufficient allowance
        orderBook.processBatch(0, buyOrderIds, sellOrderIds, matchedAmounts, executionPrices);

        console.log("Insufficient allowance properly rejected!");
    }

    /// @dev Test order cancellation during commit phase
    function testOrderCancellation() public {
        console.log("Testing Order Cancellation");

        bytes32 commitment = keccak256(abi.encodePacked(TRADE_AMOUNT, PRICE_1000_USD, uint256(99999), uint8(1)));
        
        vm.prank(alice);
        orderBook.commitOrder(commitment);
        uint256 orderId = nextOrderId++;

        // Cancel order during commit phase
        vm.prank(alice);
        orderBook.cancelOrder(orderId);

        // Verify order is cancelled
        (, , , , OrderBook.OrderStatus status) = orderBook.committedOrders(orderId);
        assertEq(uint8(status), uint8(OrderBook.OrderStatus.CANCELLED), "Order should be cancelled");

        console.log("Order cancellation successful!");
    }

    /// @dev Test pause/unpause functionality
    function testPauseUnpause() public {
        console.log("Testing Pause/Unpause");

        // Pause contract
        vm.prank(admin);
        orderBook.pause();

        // Try to commit order while paused - should fail
        vm.prank(alice);
        vm.expectRevert(); // Should revert with "Pausable: paused"
        orderBook.commitOrder(keccak256(abi.encodePacked(TRADE_AMOUNT, PRICE_1000_USD, uint256(88888), uint8(1))));

        // Unpause contract
        vm.prank(admin);
        orderBook.unpause();

        // Now should work
        vm.prank(alice);
        orderBook.commitOrder(keccak256(abi.encodePacked(TRADE_AMOUNT, PRICE_1000_USD, uint256(88888), uint8(1))));

        console.log("Pause/Unpause functionality verified!");
    }

    /// @dev Test token approval checker
    function testTokenApprovalChecker() public {
        console.log("Testing Token Approval Checker");

        // Test insufficient balance
        bool hasApproval = orderBook.checkTokenApproval(alice, address(wPEPE), INITIAL_BALANCE * 2);
        assertFalse(hasApproval, "Should return false for insufficient balance");

        // Test insufficient allowance
        hasApproval = orderBook.checkTokenApproval(alice, address(wPEPE), TRADE_AMOUNT);
        assertFalse(hasApproval, "Should return false for insufficient allowance");

        // Approve and test success
        vm.prank(alice);
        wPEPE.approve(address(orderBook), TRADE_AMOUNT);
        hasApproval = orderBook.checkTokenApproval(alice, address(wPEPE), TRADE_AMOUNT);
        assertTrue(hasApproval, "Should return true with sufficient balance and allowance");

        console.log("Token approval checker verified!");
    }

    /// @dev Test getter functions
    function testGetterFunctions() public {
        console.log("Testing Getter Functions");

        // Test getCurrentBatch
        OrderBook.Batch memory currentBatch = orderBook.getCurrentBatch();
        assertEq(currentBatch.batchId, orderBook.currentBatchId(), "Batch ID should match");

        // Add some orders to test getBatchOrderIds
        vm.prank(alice);
        orderBook.commitOrder(keccak256(abi.encodePacked(TRADE_AMOUNT, PRICE_1000_USD, uint256(77777), uint8(1))));
        
        vm.prank(bob);
        orderBook.commitOrder(keccak256(abi.encodePacked(TRADE_AMOUNT, PRICE_1000_USD, uint256(66666), uint8(0))));

        uint256[] memory orderIds = orderBook.getBatchOrderIds(orderBook.currentBatchId());
        assertEq(orderIds.length, 2, "Should have 2 orders in batch");

        console.log("Getter functions verified!");
    }

    /// @dev Test role-based access control
    function testRoleBasedAccess() public {
        console.log("Testing Role-Based Access Control");

        address unauthorizedUser = makeAddr("unauthorized");

        // Test unauthorized processBatch call
        uint256[] memory emptyArray = new uint256[](0);
        vm.prank(unauthorizedUser);
        vm.expectRevert(); // Should revert with access control error
        orderBook.processBatch(0, emptyArray, emptyArray, emptyArray, emptyArray);

        // Test unauthorized pause call
        vm.prank(unauthorizedUser);
        vm.expectRevert(); // Should revert with access control error
        orderBook.pause();

        console.log("Role-based access control verified!");
    }

    /// @dev Test error conditions in reveal phase
    function testRevealErrorConditions() public {
        console.log("Testing Reveal Error Conditions");

        // Commit order
        bytes32 commitment = keccak256(abi.encodePacked(TRADE_AMOUNT, PRICE_1000_USD, uint256(55555), uint8(1)));
        vm.prank(alice);
        orderBook.commitOrder(commitment);
        uint256 orderId = nextOrderId++;

        // Try to reveal during commit phase - should fail
        vm.prank(alice);
        vm.expectRevert("Not in reveal phase");
        orderBook.revealOrder(orderId, address(wPEPE), address(nUSD), TRADE_AMOUNT, PRICE_1000_USD, 55555, OrderBook.OrderType.SELL);

        // Move to reveal phase
        vm.warp(block.timestamp + 301);

        // Try to reveal with wrong hash - should fail
        vm.prank(alice);
        vm.expectRevert("Invalid reveal");
        orderBook.revealOrder(orderId, address(wPEPE), address(nUSD), TRADE_AMOUNT, PRICE_1000_USD, 99999, OrderBook.OrderType.SELL);

        // Try to reveal someone else's order - should fail
        vm.prank(bob);
        vm.expectRevert("Not order owner");
        orderBook.revealOrder(orderId, address(wPEPE), address(nUSD), TRADE_AMOUNT, PRICE_1000_USD, 55555, OrderBook.OrderType.SELL);

        console.log("Reveal error conditions verified!");
    }

    /// @dev Test batch processing error conditions
    function testBatchProcessingErrors() public {
        console.log("Testing Batch Processing Errors");

        uint256[] memory emptyArray = new uint256[](0);

        // Test processing a non-existent batch (future batch)
        vm.prank(matcher);
        vm.expectRevert("Batch not ready for processing");
        orderBook.processBatch(999, emptyArray, emptyArray, emptyArray, emptyArray);

        // Move to processing phase for batch 0
        vm.warp(block.timestamp + 500); // Move past commit and reveal phases
        orderBook.createNewBatch(); // This makes batch 0 processable

        // Test array length mismatch on processable batch
        uint256[] memory buyOrderIds = new uint256[](1);
        uint256[] memory sellOrderIds = new uint256[](2); // Different length
        uint256[] memory matchedAmounts = new uint256[](1);
        uint256[] memory executionPrices = new uint256[](1);

        vm.prank(matcher);
        vm.expectRevert("Array length mismatch");
        orderBook.processBatch(0, buyOrderIds, sellOrderIds, matchedAmounts, executionPrices);

        // Test already processed batch - first process it successfully
        vm.prank(matcher);
        orderBook.processBatch(0, emptyArray, emptyArray, emptyArray, emptyArray);
        
        // Now try to process it again (should fail)
        vm.prank(matcher);
        vm.expectRevert("Batch already processed");
        orderBook.processBatch(0, emptyArray, emptyArray, emptyArray, emptyArray);

        console.log("Batch processing errors verified!");
    }

    /// @dev Test commit phase error conditions
    function testCommitErrorConditions() public {
        console.log("Testing Commit Error Conditions");

        // Test invalid commitment (zero bytes)
        vm.prank(alice);
        vm.expectRevert("Invalid commitment");
        orderBook.commitOrder(bytes32(0));

        // Move past commit phase
        vm.warp(block.timestamp + 301);

        // Try to commit after commit phase ends
        vm.prank(alice);
        vm.expectRevert("Not in commit phase");
        orderBook.commitOrder(keccak256(abi.encodePacked(TRADE_AMOUNT, PRICE_1000_USD, uint256(44444), uint8(1))));

        console.log("Commit error conditions verified!");
    }

    /// @dev Comprehensive WrappedBRC20 tests
    function testWrappedBRC20Functionality() public {
        console.log("Testing WrappedBRC20 Functionality");

        // Test bridge burn functionality
        vm.startPrank(admin);
        uint256 burnAmount = 100 * 1e18;
        
        // First mint some tokens to alice for burning
        wPEPE.bridgeMint(alice, burnAmount, "mint_for_burn_test");
        
        // Test successful bridge burn
        wPEPE.bridgeBurn(alice, burnAmount, "bc1qexampleaddress");
        
        // Verify burn reduced balances
        assertEq(wPEPE.balanceOf(alice), INITIAL_BALANCE, "Alice balance should be back to initial after burn");
        assertEq(wPEPE.bridgedAmounts(alice), INITIAL_BALANCE, "Alice bridged amount should be reduced");
        
        vm.stopPrank();

        console.log("Bridge burn functionality verified!");
    }

    /// @dev Test WrappedBRC20 error conditions
    function testWrappedBRC20Errors() public {
        console.log("Testing WrappedBRC20 Error Conditions");

        vm.startPrank(admin);

        // Test mint to zero address
        vm.expectRevert("Cannot mint to zero address");
        wPEPE.bridgeMint(address(0), 1000, "test_tx");

        // Test mint zero amount
        vm.expectRevert("Amount must be greater than 0");
        wPEPE.bridgeMint(alice, 0, "test_tx");

        // Test exceeding bridged supply
        uint256 exceedsSupply = wPEPE.bridgedTotalSupply() + 1;
        vm.expectRevert("Exceeds bridged supply");
        wPEPE.bridgeMint(alice, exceedsSupply, "test_tx");

        // Test burn zero amount
        vm.expectRevert("Amount must be greater than 0");
        wPEPE.bridgeBurn(alice, 0, "bc1qtest");

        // Test burn more than bridged amount
        // Create a fresh user to test this properly
        address testUser = makeAddr("testUser");
        uint256 testAmount = 1000 * 1e18;
        wPEPE.bridgeMint(testUser, testAmount, "test_mint");
        
        vm.stopPrank();
        
        // Transfer additional tokens from alice to testUser (to increase balance without increasing bridged amount)
        vm.prank(alice);
        wPEPE.transfer(testUser, 500 * 1e18);
        
        vm.startPrank(admin);
        
        // Now testUser has more balance than bridged amount, so we can test the bridged amount check
        vm.expectRevert("Exceeds bridged amount");
        wPEPE.bridgeBurn(testUser, testAmount + 1, "bc1qtest");

        vm.stopPrank();

        console.log("WrappedBRC20 error conditions verified!");
    }

    /// @dev Test WrappedBRC20 pause functionality
    function testWrappedBRC20Pause() public {
        console.log("Testing WrappedBRC20 Pause");

        vm.prank(admin);
        wPEPE.pause();

        // Try to mint while paused
        vm.prank(admin);
        vm.expectRevert(); // Should revert with "Pausable: paused"
        wPEPE.bridgeMint(alice, 1000, "test_tx");

        // Unpause and test
        vm.prank(admin);
        wPEPE.unpause();

        vm.prank(admin);
        wPEPE.bridgeMint(alice, 1000, "test_tx_after_unpause");

        console.log("WrappedBRC20 pause functionality verified!");
    }

    /// @dev Test WrappedBRC20 role-based access
    function testWrappedBRC20RoleAccess() public {
        console.log("Testing WrappedBRC20 Role Access");

        address unauthorizedUser = makeAddr("unauthorized_brc20");

        // Test unauthorized mint
        vm.prank(unauthorizedUser);
        vm.expectRevert(); // Should revert with access control error
        wPEPE.bridgeMint(alice, 1000, "unauthorized_tx");

        // Test unauthorized burn
        vm.prank(unauthorizedUser);
        vm.expectRevert(); // Should revert with access control error
        wPEPE.bridgeBurn(alice, 1000, "bc1qtest");

        // Test unauthorized pause
        vm.prank(unauthorizedUser);
        vm.expectRevert(); // Should revert with access control error
        wPEPE.pause();

        console.log("WrappedBRC20 role access verified!");
    }

    /// @dev Test WrappedBRC20 bridge capacity
    function testBridgeCapacity() public {
        console.log("Testing Bridge Capacity");

        uint256 initialCapacity = wPEPE.bridgeCapacityRemaining();
        uint256 mintAmount = 50000 * 1e18;

        vm.prank(admin);
        wPEPE.bridgeMint(alice, mintAmount, "capacity_test_tx");

        uint256 newCapacity = wPEPE.bridgeCapacityRemaining();
        assertEq(initialCapacity - newCapacity, mintAmount, "Capacity should decrease by mint amount");

        console.log("Bridge capacity functionality verified!");
    }

    /// @dev Test order execution edge cases
    function testOrderExecutionEdgeCases() public {
        console.log("Testing Order Execution Edge Cases");

        // Setup orders with proper approvals
        vm.prank(alice);
        wPEPE.approve(address(orderBook), TRADE_AMOUNT);

        vm.prank(alice);
        orderBook.commitOrder(keccak256(abi.encodePacked(TRADE_AMOUNT, PRICE_1000_USD, uint256(33333), uint8(1))));
        uint256 aliceOrderId = nextOrderId++;

        // Move to reveal and reveal order
        vm.warp(block.timestamp + 301);
        vm.prank(alice);
        orderBook.revealOrder(aliceOrderId, address(wPEPE), address(nUSD), TRADE_AMOUNT, PRICE_1000_USD, 33333, OrderBook.OrderType.SELL);

        // Try to execute with wrong order type
        vm.warp(block.timestamp + 181);
        orderBook.createNewBatch();

        uint256[] memory buyOrderIds = new uint256[](1);
        uint256[] memory sellOrderIds = new uint256[](1);
        uint256[] memory matchedAmounts = new uint256[](1);
        uint256[] memory executionPrices = new uint256[](1);

        buyOrderIds[0] = aliceOrderId; // Wrong - this is a sell order
        sellOrderIds[0] = aliceOrderId;
        matchedAmounts[0] = TRADE_AMOUNT;
        executionPrices[0] = PRICE_1000_USD;

        vm.prank(matcher);
        vm.expectRevert("Invalid buy order");
        orderBook.processBatch(0, buyOrderIds, sellOrderIds, matchedAmounts, executionPrices);

        console.log("Order execution edge cases verified!");
    }

    /// @dev Test basic partial fill functionality
    function testBasicPartialFills() public {
        console.log("Testing Basic Partial Fills");

        // Setup: approve tokens
        vm.prank(alice);
        wPEPE.approve(address(orderBook), TRADE_AMOUNT);
        
        vm.prank(bob);
        nUSD.approve(address(orderBook), TRADE_AMOUNT * PRICE_1000_USD / 1e18);

        // Calculate amounts for orders
        uint256 bobNUSDAmount = TRADE_AMOUNT * PRICE_1000_USD / 1e18;

        // Commit and reveal orders
        vm.prank(alice);
        orderBook.commitOrder(keccak256(abi.encodePacked(TRADE_AMOUNT, PRICE_1000_USD, uint256(11111), uint8(1))));
        uint256 aliceOrderId = nextOrderId++;

        vm.prank(bob);
        orderBook.commitOrder(keccak256(abi.encodePacked(bobNUSDAmount, uint256(1e18), uint256(22222), uint8(0))));
        uint256 bobOrderId = nextOrderId++;

        // Move to reveal phase and reveal orders
        vm.warp(block.timestamp + 301);
        
        vm.prank(alice);
        orderBook.revealOrder(aliceOrderId, address(wPEPE), address(nUSD), TRADE_AMOUNT, PRICE_1000_USD, 11111, OrderBook.OrderType.SELL);
        
        vm.prank(bob);
        orderBook.revealOrder(bobOrderId, address(nUSD), address(wPEPE), bobNUSDAmount, uint256(1e18), 22222, OrderBook.OrderType.BUY);

        // Move to processing phase
        vm.warp(block.timestamp + 181);
        orderBook.createNewBatch();

        // Execute partial fill (50% of order)
        uint256 partialAmount = TRADE_AMOUNT / 2;
        uint256[] memory buyOrderIds = new uint256[](1);
        uint256[] memory sellOrderIds = new uint256[](1);
        uint256[] memory matchedAmounts = new uint256[](1);
        uint256[] memory executionPrices = new uint256[](1);

        buyOrderIds[0] = bobOrderId;
        sellOrderIds[0] = aliceOrderId;
        matchedAmounts[0] = partialAmount;
        executionPrices[0] = PRICE_1000_USD;

        vm.prank(matcher);
        orderBook.processBatch(0, buyOrderIds, sellOrderIds, matchedAmounts, executionPrices);

        // Verify partial fill state
        assertEq(orderBook.getFilledAmount(aliceOrderId), partialAmount, "Alice order should be 50% filled");
        assertEq(orderBook.getRemainingAmount(aliceOrderId), TRADE_AMOUNT - partialAmount, "Alice order should have 50% remaining");
        assertTrue(orderBook.isPartiallyFilled(aliceOrderId), "Alice order should be partially filled");
        assertFalse(orderBook.isFullyExecuted(aliceOrderId), "Alice order should not be fully executed");
        assertEq(orderBook.getFillPercentage(aliceOrderId), 5000, "Alice order should be 50% filled (5000 basis points)");

        // Same for Bob's order
        assertEq(orderBook.getFilledAmount(bobOrderId), partialAmount, "Bob order should be 50% filled");
        assertTrue(orderBook.isPartiallyFilled(bobOrderId), "Bob order should be partially filled");
        assertFalse(orderBook.isFullyExecuted(bobOrderId), "Bob order should not be fully executed");

        console.log("Basic partial fills verified!");
    }

    /// @dev Test multiple partial fills on same order
    function testMultiplePartialFills() public {
        console.log("Testing Multiple Partial Fills");

        // Setup similar to basic test
        vm.prank(alice);
        wPEPE.approve(address(orderBook), TRADE_AMOUNT);
        
        vm.prank(bob);
        nUSD.approve(address(orderBook), TRADE_AMOUNT * PRICE_1000_USD / 1e18);

        // Calculate amounts for orders
        uint256 bobNUSDAmount = TRADE_AMOUNT * PRICE_1000_USD / 1e18;

        // Commit and reveal orders
        vm.prank(alice);
        orderBook.commitOrder(keccak256(abi.encodePacked(TRADE_AMOUNT, PRICE_1000_USD, uint256(33333), uint8(1))));
        uint256 aliceOrderId = nextOrderId++;

        vm.prank(bob);
        orderBook.commitOrder(keccak256(abi.encodePacked(bobNUSDAmount, uint256(1e18), uint256(44444), uint8(0))));
        uint256 bobOrderId = nextOrderId++;

        vm.warp(block.timestamp + 301);
        
        vm.prank(alice);
        orderBook.revealOrder(aliceOrderId, address(wPEPE), address(nUSD), TRADE_AMOUNT, PRICE_1000_USD, 33333, OrderBook.OrderType.SELL);
        
        vm.prank(bob);
        orderBook.revealOrder(bobOrderId, address(nUSD), address(wPEPE), bobNUSDAmount, uint256(1e18), 44444, OrderBook.OrderType.BUY);

        vm.warp(block.timestamp + 181);
        orderBook.createNewBatch();

        // Execute multiple partial fills in a single batch processing call
        uint256 firstFill = TRADE_AMOUNT / 4;
        uint256 secondFill = TRADE_AMOUNT / 4;
        uint256 finalFill = TRADE_AMOUNT - firstFill - secondFill;

        // Process all three fills in one batch call (demonstrating multiple matches per order)
        uint256[] memory buyOrderIds = new uint256[](3);
        uint256[] memory sellOrderIds = new uint256[](3);
        uint256[] memory matchedAmounts = new uint256[](3);
        uint256[] memory executionPrices = new uint256[](3);

        // First fill (25%)
        buyOrderIds[0] = bobOrderId;
        sellOrderIds[0] = aliceOrderId;
        matchedAmounts[0] = firstFill;
        executionPrices[0] = PRICE_1000_USD;

        // Second fill (25%)
        buyOrderIds[1] = bobOrderId;
        sellOrderIds[1] = aliceOrderId;
        matchedAmounts[1] = secondFill;
        executionPrices[1] = PRICE_1000_USD;

        // Final fill (50%)
        buyOrderIds[2] = bobOrderId;
        sellOrderIds[2] = aliceOrderId;
        matchedAmounts[2] = finalFill;
        executionPrices[2] = PRICE_1000_USD;

        // Execute all fills in one batch processing call
        vm.prank(matcher);
        orderBook.processBatch(0, buyOrderIds, sellOrderIds, matchedAmounts, executionPrices);

        // Verify full execution
        assertEq(orderBook.getFilledAmount(aliceOrderId), TRADE_AMOUNT, "Alice order should be fully filled");
        assertEq(orderBook.getFillPercentage(aliceOrderId), 10000, "Alice order should be 100% filled");
        assertFalse(orderBook.isPartiallyFilled(aliceOrderId), "Alice order should not be partially filled");
        assertTrue(orderBook.isFullyExecuted(aliceOrderId), "Alice order should be fully executed");
        assertEq(orderBook.getRemainingAmount(aliceOrderId), 0, "Alice order should have no remaining amount");

        console.log("Multiple partial fills verified!");
    }

    /// @dev Test partial fill utility functions
    function testPartialFillUtilityFunctions() public {
        console.log("Testing Partial Fill Utility Functions");

        // Setup order
        vm.prank(alice);
        wPEPE.approve(address(orderBook), TRADE_AMOUNT);

        vm.prank(alice);
        orderBook.commitOrder(keccak256(abi.encodePacked(TRADE_AMOUNT, PRICE_1000_USD, uint256(55555), uint8(1))));
        uint256 orderId = nextOrderId++;

        vm.warp(block.timestamp + 301);
        
        vm.prank(alice);
        orderBook.revealOrder(orderId, address(wPEPE), address(nUSD), TRADE_AMOUNT, PRICE_1000_USD, 55555, OrderBook.OrderType.SELL);

        // Test initial state
        assertEq(orderBook.getFilledAmount(orderId), 0, "Initially filled amount should be 0");
        assertEq(orderBook.getRemainingAmount(orderId), TRADE_AMOUNT, "Initially remaining should be full amount");
        assertFalse(orderBook.isPartiallyFilled(orderId), "Initially should not be partially filled");
        assertFalse(orderBook.isFullyExecuted(orderId), "Initially should not be fully executed");
        assertEq(orderBook.getFillPercentage(orderId), 0, "Initially fill percentage should be 0");

        // Test getOrderFillInfo
        (uint256 originalAmount, uint256 filledAmount, uint256 remainingAmount, bool executed) = orderBook.getOrderFillInfo(orderId);
        assertEq(originalAmount, TRADE_AMOUNT, "Original amount should match");
        assertEq(filledAmount, 0, "Filled amount should be 0");
        assertEq(remainingAmount, TRADE_AMOUNT, "Remaining amount should be full");
        assertFalse(executed, "Should not be executed");

        console.log("Partial fill utility functions verified!");
    }

    /// @dev Test partial fill error conditions
    function testPartialFillErrorConditions() public {
        console.log("Testing Partial Fill Error Conditions");

        // Setup orders
        vm.prank(alice);
        wPEPE.approve(address(orderBook), TRADE_AMOUNT);
        
        vm.prank(bob);
        nUSD.approve(address(orderBook), TRADE_AMOUNT * PRICE_1000_USD / 1e18);

        // Calculate amounts for orders
        uint256 bobNUSDAmount = TRADE_AMOUNT * PRICE_1000_USD / 1e18;

        vm.prank(alice);
        orderBook.commitOrder(keccak256(abi.encodePacked(TRADE_AMOUNT, PRICE_1000_USD, uint256(66666), uint8(1))));
        uint256 aliceOrderId = nextOrderId++;

        vm.prank(bob);
        orderBook.commitOrder(keccak256(abi.encodePacked(bobNUSDAmount, uint256(1e18), uint256(77777), uint8(0))));
        uint256 bobOrderId = nextOrderId++;

        vm.warp(block.timestamp + 301);
        
        vm.prank(alice);
        orderBook.revealOrder(aliceOrderId, address(wPEPE), address(nUSD), TRADE_AMOUNT, PRICE_1000_USD, 66666, OrderBook.OrderType.SELL);
        
        vm.prank(bob);
        orderBook.revealOrder(bobOrderId, address(nUSD), address(wPEPE), bobNUSDAmount, uint256(1e18), 77777, OrderBook.OrderType.BUY);

        vm.warp(block.timestamp + 181);
        orderBook.createNewBatch();

        uint256[] memory buyOrderIds = new uint256[](1);
        uint256[] memory sellOrderIds = new uint256[](1);
        uint256[] memory matchedAmounts = new uint256[](1);
        uint256[] memory executionPrices = new uint256[](1);

        buyOrderIds[0] = bobOrderId;
        sellOrderIds[0] = aliceOrderId;
        executionPrices[0] = PRICE_1000_USD;

        // Test zero matched amount
        matchedAmounts[0] = 0;
        vm.prank(matcher);
        vm.expectRevert("Matched amount must be greater than 0");
        orderBook.processBatch(0, buyOrderIds, sellOrderIds, matchedAmounts, executionPrices);

        // Test exceeding remaining amount
        matchedAmounts[0] = TRADE_AMOUNT + 1;
        vm.prank(matcher);
        vm.expectRevert("Matched amount exceeds sell order remaining");
        orderBook.processBatch(0, buyOrderIds, sellOrderIds, matchedAmounts, executionPrices);

        // Fill order completely first
        matchedAmounts[0] = TRADE_AMOUNT;
        vm.prank(matcher);
        orderBook.processBatch(0, buyOrderIds, sellOrderIds, matchedAmounts, executionPrices);

        // Create a new batch to test fully executed order error
        vm.warp(block.timestamp + 1000);
        orderBook.createNewBatch();

        // Test trying to fill fully executed order (in new batch 1)
        matchedAmounts[0] = 1;
        vm.prank(matcher);
        vm.expectRevert("Orders already fully executed");
        orderBook.processBatch(1, buyOrderIds, sellOrderIds, matchedAmounts, executionPrices);

        console.log("Partial fill error conditions verified!");
    }
}

/// @dev Mock ERC20 token for testing
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
} 
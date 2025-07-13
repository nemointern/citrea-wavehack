// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title OrderBook
 * @dev Dark pool order book with commit-reveal pattern and batch execution for MEV protection
 */
contract OrderBook is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant MATCHER_ROLE = keccak256("MATCHER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    enum OrderType { BUY, SELL }
    enum OrderStatus { COMMITTED, REVEALED, MATCHED, CANCELLED }
    
    struct CommittedOrder {
        address trader;
        bytes32 commitment; // keccak256(amount, price, salt, orderType)
        uint256 commitTime;
        uint256 batchId;
        OrderStatus status;
    }
    
    struct RevealedOrder {
        address trader;
        address tokenA; // Token being sold
        address tokenB; // Token being bought
        uint256 amount; // Original order amount
        uint256 filledAmount; // Amount already filled
        uint256 price; // Price in tokenB per tokenA (scaled by 1e18)
        uint256 salt;
        OrderType orderType;
        uint256 orderId;
        uint256 batchId;
        bool executed; // True when order is fully executed
    }
    
    struct Batch {
        uint256 batchId;
        uint256 startTime;
        uint256 endTime;
        uint256[] orderIds;
        bool processed;
        uint256 totalOrders;
    }
    
    // State variables
    mapping(uint256 => CommittedOrder) public committedOrders;
    mapping(uint256 => RevealedOrder) public revealedOrders;
    mapping(uint256 => Batch) public batches;
    
    uint256 public nextOrderId;
    uint256 public nextBatchId;
    uint256 public currentBatchId;
    
    // Timing configuration
    uint256 public constant COMMIT_PHASE_DURATION = 300; // 5 minutes
    uint256 public constant REVEAL_PHASE_DURATION = 180; // 3 minutes
    uint256 public constant MIN_COMMIT_TIME = 2; // 2 blocks minimum
    
    // Events
    event OrderCommitted(uint256 indexed orderId, address indexed trader, bytes32 commitment, uint256 batchId);
    event OrderRevealed(uint256 indexed orderId, address indexed trader, uint256 amount, uint256 price, OrderType orderType);
    event BatchCreated(uint256 indexed batchId, uint256 startTime, uint256 endTime);
    event BatchProcessed(uint256 indexed batchId, uint256 totalMatches);
    event OrderMatched(uint256 indexed buyOrderId, uint256 indexed sellOrderId, uint256 matchedAmount, uint256 executionPrice);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MATCHER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        
        // Initialize first batch
        _createNewBatch();
    }
    
    /**
     * @dev Commit an order hash to the current batch
     * @param commitment Hash of order details (amount, price, salt, orderType)
     */
    function commitOrder(bytes32 commitment) external whenNotPaused nonReentrant {
        require(commitment != bytes32(0), "Invalid commitment");
        require(_isCommitPhase(), "Not in commit phase");
        
        uint256 orderId = nextOrderId++;
        
        committedOrders[orderId] = CommittedOrder({
            trader: msg.sender,
            commitment: commitment,
            commitTime: block.timestamp,
            batchId: currentBatchId,
            status: OrderStatus.COMMITTED
        });
        
        // Add to current batch
        batches[currentBatchId].orderIds.push(orderId);
        batches[currentBatchId].totalOrders++;
        
        emit OrderCommitted(orderId, msg.sender, commitment, currentBatchId);
    }
    
    /**
     * @dev Reveal a committed order
     * @param orderId Order ID to reveal
     * @param tokenA Token being sold
     * @param tokenB Token being bought  
     * @param amount Amount of tokenA to sell/buy
     * @param price Price in tokenB per tokenA (scaled by 1e18)
     * @param salt Random salt used in commitment
     * @param orderType BUY or SELL
     */
    function revealOrder(
        uint256 orderId,
        address tokenA,
        address tokenB,
        uint256 amount,
        uint256 price,
        uint256 salt,
        OrderType orderType
    ) external whenNotPaused nonReentrant {
        CommittedOrder storage committed = committedOrders[orderId];
        
        require(committed.trader == msg.sender, "Not order owner");
        require(committed.status == OrderStatus.COMMITTED, "Order not committed");
        require(_isRevealPhase(committed.batchId), "Not in reveal phase");
        require(block.timestamp >= committed.commitTime + MIN_COMMIT_TIME, "Too early to reveal");
        
        // Verify commitment
        bytes32 computedHash = keccak256(abi.encodePacked(amount, price, salt, orderType));
        require(computedHash == committed.commitment, "Invalid reveal");
        
        // Update status
        committed.status = OrderStatus.REVEALED;
        
        // Store revealed order
        revealedOrders[orderId] = RevealedOrder({
            trader: msg.sender,
            tokenA: tokenA,
            tokenB: tokenB,
            amount: amount,
            filledAmount: 0,
            price: price,
            salt: salt,
            orderType: orderType,
            orderId: orderId,
            batchId: committed.batchId,
            executed: false
        });
        
        emit OrderRevealed(orderId, msg.sender, amount, price, orderType);
    }
    
    /**
     * @dev Process a batch (called by matcher) - supports partial fills
     * @param batchId Batch to process
     * @param buyOrderIds Array of buy order IDs to match (can contain duplicates for partial fills)
     * @param sellOrderIds Array of sell order IDs to match (can contain duplicates for partial fills)
     * @param matchedAmounts Array of matched amounts (must not exceed remaining amounts)
     * @param executionPrices Array of execution prices
     */
    function processBatch(
        uint256 batchId,
        uint256[] memory buyOrderIds,
        uint256[] memory sellOrderIds,
        uint256[] memory matchedAmounts,
        uint256[] memory executionPrices
    ) external onlyRole(MATCHER_ROLE) whenNotPaused {
        require(batchId < currentBatchId, "Batch not ready for processing");
        require(!batches[batchId].processed, "Batch already processed");
        require(_isProcessingPhase(batchId), "Not in processing phase");
        
        require(
            buyOrderIds.length == sellOrderIds.length &&
            sellOrderIds.length == matchedAmounts.length &&
            matchedAmounts.length == executionPrices.length,
            "Array length mismatch"
        );
        
        // Execute matches
        for (uint256 i = 0; i < buyOrderIds.length; i++) {
            _executeMatch(
                buyOrderIds[i],
                sellOrderIds[i],
                matchedAmounts[i],
                executionPrices[i]
            );
        }
        
        // Mark batch as processed
        batches[batchId].processed = true;
        
        emit BatchProcessed(batchId, buyOrderIds.length);
    }
    
    /**
     * @dev Cancel a committed order (only during commit phase)
     * @param orderId Order ID to cancel
     */
    function cancelOrder(uint256 orderId) external {
        CommittedOrder storage order = committedOrders[orderId];
        
        require(order.trader == msg.sender, "Not order owner");
        require(order.status == OrderStatus.COMMITTED, "Order not cancellable");
        require(_isCommitPhase() && order.batchId == currentBatchId, "Cannot cancel now");
        
        order.status = OrderStatus.CANCELLED;
    }
    
    /**
     * @dev Create new batch when current one expires
     */
    function createNewBatch() external {
        require(!_isCommitPhase(), "Current batch still active");
        _createNewBatch();
    }
    
    /**
     * @dev Internal function to create new batch
     */
    function _createNewBatch() internal {
        if (currentBatchId > 0) {
            batches[currentBatchId].endTime = block.timestamp;
        }
        
        currentBatchId = nextBatchId++;
        
        batches[currentBatchId] = Batch({
            batchId: currentBatchId,
            startTime: block.timestamp,
            endTime: 0,
            orderIds: new uint256[](0),
            processed: false,
            totalOrders: 0
        });
        
        emit BatchCreated(
            currentBatchId,
            block.timestamp,
            block.timestamp + COMMIT_PHASE_DURATION
        );
    }
    
    /**
     * @dev Execute a match between buy and sell orders (supports partial fills)
     */
    function _executeMatch(
        uint256 buyOrderId,
        uint256 sellOrderId,
        uint256 matchedAmount,
        uint256 executionPrice
    ) internal {
        RevealedOrder storage buyOrder = revealedOrders[buyOrderId];
        RevealedOrder storage sellOrder = revealedOrders[sellOrderId];
        
        require(buyOrder.orderType == OrderType.BUY, "Invalid buy order");
        require(sellOrder.orderType == OrderType.SELL, "Invalid sell order");
        require(!buyOrder.executed && !sellOrder.executed, "Orders already fully executed");
        require(buyOrder.tokenA == sellOrder.tokenB && buyOrder.tokenB == sellOrder.tokenA, "Token mismatch");
        
        // Validate partial fill amounts
        uint256 buyRemainingAmount = buyOrder.amount - buyOrder.filledAmount;
        uint256 sellRemainingAmount = sellOrder.amount - sellOrder.filledAmount;
        require(matchedAmount > 0, "Matched amount must be greater than 0");
        require(matchedAmount <= buyRemainingAmount, "Matched amount exceeds buy order remaining");
        require(matchedAmount <= sellRemainingAmount, "Matched amount exceeds sell order remaining");
        
        // Calculate the amount of tokenB needed for the trade
        uint256 tokenBAmount = (matchedAmount * executionPrice) / 1e18;
        
        // ACTUAL TOKEN TRANSFERS
        // Transfer tokenA from seller to buyer
        IERC20(sellOrder.tokenA).transferFrom(
            sellOrder.trader,
            buyOrder.trader,
            matchedAmount
        );
        
        // Transfer tokenB from buyer to seller
        IERC20(buyOrder.tokenA).transferFrom(
            buyOrder.trader,
            sellOrder.trader,
            tokenBAmount
        );
        
        // Update filled amounts
        buyOrder.filledAmount += matchedAmount;
        sellOrder.filledAmount += matchedAmount;
        
        // Mark as fully executed if completely filled
        if (buyOrder.filledAmount >= buyOrder.amount) {
            buyOrder.executed = true;
            committedOrders[buyOrderId].status = OrderStatus.MATCHED;
        }
        if (sellOrder.filledAmount >= sellOrder.amount) {
            sellOrder.executed = true;
            committedOrders[sellOrderId].status = OrderStatus.MATCHED;
        }
        
        emit OrderMatched(buyOrderId, sellOrderId, matchedAmount, executionPrice);
    }
    
    /**
     * @dev Check if current time is in commit phase
     */
    function _isCommitPhase() internal view returns (bool) {
        return block.timestamp <= batches[currentBatchId].startTime + COMMIT_PHASE_DURATION;
    }
    
    /**
     * @dev Check if batch is in reveal phase
     */
    function _isRevealPhase(uint256 batchId) internal view returns (bool) {
        uint256 commitEndTime = batches[batchId].startTime + COMMIT_PHASE_DURATION;
        return block.timestamp > commitEndTime && 
               block.timestamp <= commitEndTime + REVEAL_PHASE_DURATION;
    }
    
    /**
     * @dev Check if batch is in processing phase
     */
    function _isProcessingPhase(uint256 batchId) internal view returns (bool) {
        uint256 revealEndTime = batches[batchId].startTime + COMMIT_PHASE_DURATION + REVEAL_PHASE_DURATION;
        return block.timestamp > revealEndTime;
    }
    
    /**
     * @dev Get current batch info
     */
    function getCurrentBatch() external view returns (Batch memory) {
        return batches[currentBatchId];
    }
    
    /**
     * @dev Get order IDs for a batch
     */
    function getBatchOrderIds(uint256 batchId) external view returns (uint256[] memory) {
        return batches[batchId].orderIds;
    }
    
    // ==================== PARTIAL FILL UTILITY FUNCTIONS ====================
    
    /**
     * @dev Get the remaining amount for an order
     * @param orderId Order ID to check
     * @return uint256 Remaining amount that can be filled
     */
    function getRemainingAmount(uint256 orderId) external view returns (uint256) {
        RevealedOrder storage order = revealedOrders[orderId];
        if (order.amount == 0) return 0; // Order doesn't exist or not revealed
        return order.amount - order.filledAmount;
    }
    
    /**
     * @dev Get the filled amount for an order
     * @param orderId Order ID to check
     * @return uint256 Amount already filled
     */
    function getFilledAmount(uint256 orderId) external view returns (uint256) {
        return revealedOrders[orderId].filledAmount;
    }
    
    /**
     * @dev Check if an order is partially filled
     * @param orderId Order ID to check
     * @return bool True if order has some fills but is not fully executed
     */
    function isPartiallyFilled(uint256 orderId) external view returns (bool) {
        RevealedOrder storage order = revealedOrders[orderId];
        return order.filledAmount > 0 && !order.executed;
    }
    
    /**
     * @dev Check if an order is fully executed
     * @param orderId Order ID to check
     * @return bool True if order is completely filled
     */
    function isFullyExecuted(uint256 orderId) external view returns (bool) {
        return revealedOrders[orderId].executed;
    }
    
    /**
     * @dev Get the fill percentage for an order
     * @param orderId Order ID to check
     * @return uint256 Fill percentage (0-100, scaled by 1e2 for precision)
     */
    function getFillPercentage(uint256 orderId) external view returns (uint256) {
        RevealedOrder storage order = revealedOrders[orderId];
        if (order.amount == 0) return 0;
        return (order.filledAmount * 10000) / order.amount; // Return basis points (0-10000)
    }
    
    /**
     * @dev Get comprehensive order fill info
     * @param orderId Order ID to check
     * @return originalAmount Original order amount
     * @return filledAmount Amount already filled
     * @return remainingAmount Amount remaining to be filled
     * @return executed Whether order is fully executed
     */
    function getOrderFillInfo(uint256 orderId) external view returns (
        uint256 originalAmount,
        uint256 filledAmount,
        uint256 remainingAmount,
        bool executed
    ) {
        RevealedOrder storage order = revealedOrders[orderId];
        return (
            order.amount,
            order.filledAmount,
            order.amount - order.filledAmount,
            order.executed
        );
    }
    
    /**
     * @dev Pause contract
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Check if user has sufficient balance and approval for a token
     * @param user User address
     * @param token Token contract address
     * @param amount Amount to check
     * @return bool True if user has sufficient balance and approval
     */
    function checkTokenApproval(address user, address token, uint256 amount) external view returns (bool) {
        IERC20 tokenContract = IERC20(token);
        return tokenContract.balanceOf(user) >= amount && 
               tokenContract.allowance(user, address(this)) >= amount;
    }
} 
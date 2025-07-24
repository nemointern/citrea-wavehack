import { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useWatchContractEvent,
  usePublicClient,
} from "wagmi";
import { keccak256, encodePacked, parseEther, decodeEventLog } from "viem";
import { abi as ORDERBOOK_ABI } from "../../../contracts/out/OrderBook.sol/OrderBook.json";
import { getOrderBookAddress, getAllTokenAddresses } from "../config/addresses";
import { apiService } from "../services/api";

const ORDERBOOK_ADDRESS = getOrderBookAddress();

// Token addresses from centralized config
const TOKEN_ADDRESSES = getAllTokenAddresses();

interface OrderData {
  tokenA: string;
  tokenB: string;
  amount: string;
  price: string;
  orderType: "BUY" | "SELL";
}

// Enhanced order interface with partial fill support
interface OrderWithFillInfo {
  orderId: number | null; // Allow null for pending orders
  realOrderId?: number; // The actual smart contract order ID
  batchId: number;
  tokenA: string;
  tokenB: string;
  amount: string; // Original order amount
  price: string;
  orderType: "BUY" | "SELL";
  status:
    | "COMMITTED"
    | "REVEALED"
    | "MATCHED"
    | "PARTIALLY_FILLED"
    | "FULLY_EXECUTED"
    | "CANCELLED";
  commitHash: string;
  salt: string;
  timestamp: number;
  txHash: string;
  // New partial fill fields
  filledAmount?: string; // Amount already filled
  remainingAmount?: string; // Amount remaining to be filled
  fillPercentage?: number; // Fill percentage (0-100)
  isPartiallyFilled?: boolean; // Quick check for partial fills
  isFullyExecuted?: boolean; // Quick check for full execution
  lastFillUpdate?: number; // Timestamp of last fill status update
}

export function useOrderBook() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [commitmentData, setCommitmentData] = useState<{
    hash: string;
    salt: string;
    orderData: OrderData;
  } | null>(null);

  // Track which order is currently being revealed
  const [revealingOrderIndex, setRevealingOrderIndex] = useState<number | null>(
    null
  );

  // Store user's orders locally with localStorage persistence
  const getStorageKey = () => `citrea-orders-${address}`;

  const loadOrdersFromStorage = (): Array<OrderWithFillInfo> => {
    if (!address || typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(getStorageKey());
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error("Error loading orders from storage:", error);
      return [];
    }
  };

  const [userOrders, setUserOrders] = useState<Array<OrderWithFillInfo>>(
    loadOrdersFromStorage
  );

  // Save orders to localStorage whenever they change
  useEffect(() => {
    if (address && userOrders.length > 0) {
      try {
        localStorage.setItem(getStorageKey(), JSON.stringify(userOrders));
      } catch (error) {
        console.error("Error saving orders to storage:", error);
      }
    }
  }, [userOrders, address]);

  // Load orders from storage when address changes
  useEffect(() => {
    if (address) {
      const stored = loadOrdersFromStorage();
      setUserOrders(stored);
    } else {
      setUserOrders([]);
    }
  }, [address]);

  // Write contracts
  const {
    writeContract: writeCommitOrder,
    data: commitHash,
    isPending: isCommitPending,
    error: commitError,
  } = useWriteContract();

  const {
    writeContract: writeRevealOrder,
    data: revealHash,
    isPending: isRevealPending,
    error: revealError,
  } = useWriteContract();

  // Transaction receipts
  const { isLoading: isCommitConfirming } = useWaitForTransactionReceipt({
    hash: commitHash,
  });

  const { isLoading: isRevealConfirming } = useWaitForTransactionReceipt({
    hash: revealHash,
  });

  // Read current batch
  const { data: currentBatch, refetch: refetchBatch } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ORDERBOOK_ABI,
    functionName: "getCurrentBatch",
  });

  // Manual function to get order ID from transaction receipt
  const getOrderIdFromTransaction = async (
    txHash: string,
    commitHash: string
  ) => {
    if (!publicClient) {
      console.log("No public client available");
      return null;
    }

    try {
      console.log("Fetching transaction receipt for:", txHash);
      console.log("Looking for commitment hash:", commitHash);
      console.log("User address:", address);
      console.log("OrderBook address:", ORDERBOOK_ADDRESS);

      const receipt = await publicClient.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      });

      console.log("Transaction receipt:", receipt);
      console.log("Receipt status:", receipt.status);
      console.log("Number of logs:", receipt.logs.length);

      if (receipt.status !== "success") {
        console.log("Transaction failed, status:", receipt.status);
        return null;
      }

      // Look for OrderCommitted events in the receipt
      for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        console.log(`Log ${i}:`, {
          address: log.address,
          topics: log.topics,
          data: log.data,
        });

        try {
          if (log.address.toLowerCase() === ORDERBOOK_ADDRESS.toLowerCase()) {
            console.log(
              `Log ${i} is from OrderBook contract, attempting to decode...`
            );

            const decoded = decodeEventLog({
              abi: ORDERBOOK_ABI,
              data: log.data,
              topics: log.topics,
            });

            console.log(`Decoded event ${i}:`, decoded);

            if (decoded.eventName === "OrderCommitted") {
              const { orderId, trader, commitment } = decoded.args as any;
              console.log("Found OrderCommitted event:", {
                orderId: orderId?.toString(),
                trader,
                commitment,
                expectedCommitment: commitHash,
                expectedTrader: address,
                traderMatch: trader?.toLowerCase() === address?.toLowerCase(),
                commitmentMatch: commitment === commitHash,
              });

              if (
                trader?.toLowerCase() === address?.toLowerCase() &&
                commitment === commitHash
              ) {
                console.log("Match found! Order ID:", Number(orderId));
                return Number(orderId);
              } else {
                console.log(
                  "No match - either trader or commitment doesn't match"
                );
              }
            } else {
              console.log(
                `Event ${i} is not OrderCommitted, it's:`,
                decoded.eventName
              );
            }
          } else {
            console.log(`Log ${i} is from different contract:`, log.address);
          }
        } catch (decodeError) {
          console.log(`Could not decode log ${i}:`, decodeError);
        }
      }

      console.log("No matching OrderCommitted event found in transaction");
    } catch (error) {
      console.error("Error fetching order ID from transaction:", error);
    }

    return null;
  };

  // Watch for OrderCommitted events to get real order IDs
  useWatchContractEvent({
    address: ORDERBOOK_ADDRESS,
    abi: ORDERBOOK_ABI,
    eventName: "OrderCommitted",
    onLogs(logs) {
      console.log("Event watcher triggered with logs:", logs);
      logs.forEach((log: any) => {
        console.log("Processing log:", log);
        const { orderId, trader, commitment } = log.args || {};

        // Only process events for current user
        if (trader?.toLowerCase() === address?.toLowerCase()) {
          console.log("OrderCommitted event received:", {
            orderId,
            trader,
            commitment,
          });

          // Find and update the order with the real order ID
          setUserOrders((prev) =>
            prev.map((order) => {
              console.log("Checking order:", {
                orderCommitHash: order.commitHash,
                eventCommitment: commitment,
              });
              if (order.commitHash === commitment && !order.realOrderId) {
                console.log("Updating order with real ID:", Number(orderId));
                return {
                  ...order,
                  realOrderId: Number(orderId),
                  orderId: Number(orderId),
                };
              }
              return order;
            })
          );
        }
      });
    },
  });

  // Generate commitment hash
  const generateCommitmentHash = (
    orderData: OrderData,
    salt: string
  ): string => {
    try {
      // Convert values to proper format for smart contract
      const amount = parseEther(orderData.amount);
      const price = parseEther(orderData.price);

      // Convert salt string to uint256 - use a simple hash of the salt string
      const saltHash = keccak256(new TextEncoder().encode(salt));
      const saltBigInt = BigInt(saltHash);

      const orderType = orderData.orderType === "BUY" ? 0 : 1;

      console.log("Generating hash with:", {
        amount: amount.toString(),
        price: price.toString(),
        saltBigInt: saltBigInt.toString(),
        orderType,
        salt,
      });

      // Use encodePacked to match smart contract abi.encodePacked
      const packed = encodePacked(
        ["uint256", "uint256", "uint256", "uint8"],
        [amount, price, saltBigInt, orderType]
      );

      // Generate keccak256 hash
      const hash = keccak256(packed);
      console.log("Generated commitment hash:", hash);
      return hash;
    } catch (error) {
      console.error("Error generating commitment hash:", error);
      throw new Error(
        `Failed to generate commitment hash: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  // Generate random salt
  const generateSalt = (): string => {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  };

  // Commit order function
  const commitOrder = async (orderData: OrderData) => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    try {
      const salt = generateSalt();
      const commitmentHash = generateCommitmentHash(orderData, salt);

      // Store commitment data for later reveal
      setCommitmentData({
        hash: commitmentHash,
        salt,
        orderData,
      });

      // Call smart contract
      writeCommitOrder({
        address: ORDERBOOK_ADDRESS,
        abi: ORDERBOOK_ABI,
        functionName: "commitOrder",
        args: [commitmentHash as `0x${string}`],
      });

      return { commitmentHash, salt };
    } catch (error) {
      console.error("Error committing order:", error);
      throw error;
    }
  };

  // Reveal order function - now takes the order from our local state
  const revealOrder = async (orderIndex: number) => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    const order = userOrders[orderIndex];
    if (!order) {
      throw new Error("Order not found");
    }

    if (!order.realOrderId) {
      throw new Error(
        "Order ID not yet available. Please wait for the commit transaction to be processed."
      );
    }

    try {
      const tokenAAddress =
        TOKEN_ADDRESSES[order.tokenA as keyof typeof TOKEN_ADDRESSES];
      const tokenBAddress =
        TOKEN_ADDRESSES[order.tokenB as keyof typeof TOKEN_ADDRESSES];

      if (!tokenAAddress || !tokenBAddress) {
        throw new Error("Invalid token addresses");
      }

      const amount = parseEther(order.amount);
      const price = parseEther(order.price);
      // Use same salt conversion as in commitment hash generation
      const saltHash = keccak256(new TextEncoder().encode(order.salt));
      const saltBigInt = BigInt(saltHash);
      const orderType = order.orderType === "BUY" ? 0 : 1;

      console.log("Revealing order with real ID:", order.realOrderId);

      // Track which order is being revealed
      setRevealingOrderIndex(orderIndex);

      // Call smart contract
      writeRevealOrder({
        address: ORDERBOOK_ADDRESS,
        abi: ORDERBOOK_ABI,
        functionName: "revealOrder",
        args: [
          BigInt(order.realOrderId),
          tokenAAddress,
          tokenBAddress,
          amount,
          price,
          saltBigInt,
          orderType,
        ],
      });
    } catch (error) {
      console.error("Error revealing order:", error);
      setRevealingOrderIndex(null); // Clear on error
      throw error;
    }
  };

  // Update order status when reveal transaction is confirmed
  useEffect(() => {
    if (revealHash && !isRevealConfirming && revealingOrderIndex !== null) {
      console.log("Reveal transaction confirmed, updating order status");
      // Update the specific order that was revealed
      setUserOrders((prev) =>
        prev.map((order, index) =>
          index === revealingOrderIndex
            ? { ...order, status: "REVEALED" as const }
            : order
        )
      );
      // Clear the tracking
      setRevealingOrderIndex(null);
    }
  }, [revealHash, isRevealConfirming, revealingOrderIndex]);

  // Clear orders function (useful for testing)
  const clearOrders = () => {
    if (address) {
      localStorage.removeItem(getStorageKey());
      setUserOrders([]);
    }
  };

  // Enhanced effect to handle transaction confirmation and order ID fetching
  useEffect(() => {
    if (commitHash && commitmentData && !isCommitConfirming) {
      // Transaction is confirmed, add order to local state
      const currentBatchData = currentBatch as { batchId?: bigint };
      const newOrder = {
        orderId: null, // Will be updated when we receive the event
        realOrderId: undefined,
        batchId: currentBatchData?.batchId
          ? Number(currentBatchData.batchId)
          : 7, // Current batch
        tokenA: commitmentData.orderData.tokenA,
        tokenB: commitmentData.orderData.tokenB,
        amount: commitmentData.orderData.amount,
        price: commitmentData.orderData.price,
        orderType: commitmentData.orderData.orderType,
        status: "COMMITTED" as const,
        commitHash: commitmentData.hash,
        salt: commitmentData.salt,
        timestamp: Date.now(),
        txHash: commitHash,
      };

      // Only add if not already present (prevent duplicates)
      setUserOrders((prev) => {
        const exists = prev.some((order) => order.txHash === commitHash);
        if (exists) return prev;
        return [newOrder, ...prev];
      });

      // Try to manually fetch the order ID from transaction receipt
      setTimeout(async () => {
        console.log("Attempting manual order ID fetch...");
        const orderId = await getOrderIdFromTransaction(
          commitHash,
          commitmentData.hash
        );
        if (orderId) {
          setUserOrders((prev) =>
            prev.map((order) => {
              if (order.txHash === commitHash && !order.realOrderId) {
                console.log("Manually updating order with real ID:", orderId);
                return {
                  ...order,
                  realOrderId: orderId,
                  orderId: orderId,
                };
              }
              return order;
            })
          );
        }
      }, 3000); // Wait 3 seconds for transaction to be fully processed

      console.log("Added new order to local state:", newOrder);
    }
  }, [
    commitHash,
    commitmentData,
    isCommitConfirming,
    currentBatch,
    publicClient,
    address,
  ]);

  // Alternative: Get next order ID from contract (simpler approach)
  const getNextOrderId = async () => {
    if (!publicClient) return null;

    try {
      console.log("Reading nextOrderId from contract...");
      const nextOrderId = await publicClient.readContract({
        address: ORDERBOOK_ADDRESS,
        abi: ORDERBOOK_ABI,
        functionName: "nextOrderId",
      });

      console.log("Next order ID from contract:", Number(nextOrderId));
      return Number(nextOrderId);
    } catch (error) {
      console.error("Error reading nextOrderId:", error);
      return null;
    }
  };

  // Enhanced manual refresh with fallback approaches
  const refreshOrderId = async (txHash: string) => {
    console.log("=== Starting Order ID Refresh ===");
    console.log("TX Hash:", txHash);

    // Find the order we're trying to refresh
    const orderToRefresh = userOrders.find((order) => order.txHash === txHash);
    if (!orderToRefresh) {
      console.log("Order not found in user orders");
      return null;
    }

    console.log("Order found:", orderToRefresh);
    console.log("Order commitment hash:", orderToRefresh.commitHash);

    // Try approach 1: Transaction receipt
    console.log("Approach 1: Reading transaction receipt...");
    let orderId = await getOrderIdFromTransaction(
      txHash,
      orderToRefresh.commitHash
    );

    if (orderId) {
      console.log("Success with approach 1!");
      setUserOrders((prev) =>
        prev.map((order) => {
          if (order.txHash === txHash && !order.realOrderId) {
            console.log("Updating order with real ID:", orderId);
            return {
              ...order,
              realOrderId: orderId,
              orderId: orderId,
            };
          }
          return order;
        })
      );
      return orderId;
    }

    // Try approach 2: Estimate based on current nextOrderId
    console.log("Approach 2: Estimating from contract state...");
    const nextId = await getNextOrderId();
    if (nextId && nextId > 0) {
      // Your order is likely the previous one
      const estimatedId = nextId - 1;
      console.log("Estimated order ID:", estimatedId);

      // Update the order with estimated ID
      setUserOrders((prev) =>
        prev.map((order) => {
          if (order.txHash === txHash && !order.realOrderId) {
            console.log("Using estimated order ID:", estimatedId);
            return {
              ...order,
              realOrderId: estimatedId,
              orderId: estimatedId,
            };
          }
          return order;
        })
      );
      return estimatedId;
    }

    console.log("All approaches failed");
    return null;
  };

  // ==================== PARTIAL FILL UTILITY FUNCTIONS ====================

  /**
   * Get the remaining amount for an order
   */
  const getRemainingAmount = async (
    orderId: number
  ): Promise<string | null> => {
    if (!publicClient || !orderId) return null;

    try {
      const result = (await publicClient.readContract({
        address: ORDERBOOK_ADDRESS,
        abi: ORDERBOOK_ABI,
        functionName: "getRemainingAmount",
        args: [BigInt(orderId)],
      })) as bigint;

      return result.toString();
    } catch (error) {
      console.error("Error getting remaining amount:", error);
      return null;
    }
  };

  /**
   * Get the filled amount for an order
   */
  const getFilledAmount = async (orderId: number): Promise<string | null> => {
    if (!publicClient || !orderId) return null;

    try {
      const result = (await publicClient.readContract({
        address: ORDERBOOK_ADDRESS,
        abi: ORDERBOOK_ABI,
        functionName: "getFilledAmount",
        args: [BigInt(orderId)],
      })) as bigint;

      return result.toString();
    } catch (error) {
      console.error("Error getting filled amount:", error);
      return null;
    }
  };

  /**
   * Check if an order is partially filled
   */
  const isPartiallyFilled = async (orderId: number): Promise<boolean> => {
    if (!publicClient || !orderId) return false;

    try {
      const result = (await publicClient.readContract({
        address: ORDERBOOK_ADDRESS,
        abi: ORDERBOOK_ABI,
        functionName: "isPartiallyFilled",
        args: [BigInt(orderId)],
      })) as boolean;

      return result;
    } catch (error) {
      console.error("Error checking if partially filled:", error);
      return false;
    }
  };

  /**
   * Check if an order is fully executed
   */
  const isFullyExecuted = async (orderId: number): Promise<boolean> => {
    if (!publicClient || !orderId) return false;

    try {
      const result = (await publicClient.readContract({
        address: ORDERBOOK_ADDRESS,
        abi: ORDERBOOK_ABI,
        functionName: "isFullyExecuted",
        args: [BigInt(orderId)],
      })) as boolean;

      return result;
    } catch (error) {
      console.error("Error checking if fully executed:", error);
      return false;
    }
  };

  /**
   * Get the fill percentage for an order (in basis points)
   */
  const getFillPercentage = async (orderId: number): Promise<number> => {
    if (!publicClient || !orderId) return 0;

    try {
      const result = (await publicClient.readContract({
        address: ORDERBOOK_ADDRESS,
        abi: ORDERBOOK_ABI,
        functionName: "getFillPercentage",
        args: [BigInt(orderId)],
      })) as bigint;

      // Convert from basis points (0-10000) to percentage (0-100)
      return Number(result) / 100;
    } catch (error) {
      console.error("Error getting fill percentage:", error);
      return 0;
    }
  };

  /**
   * Get comprehensive order fill information
   */
  const getOrderFillInfo = async (
    orderId: number
  ): Promise<{
    originalAmount: string;
    filledAmount: string;
    remainingAmount: string;
    executed: boolean;
  } | null> => {
    if (!publicClient || !orderId) return null;

    try {
      const result = (await publicClient.readContract({
        address: ORDERBOOK_ADDRESS,
        abi: ORDERBOOK_ABI,
        functionName: "getOrderFillInfo",
        args: [BigInt(orderId)],
      })) as [bigint, bigint, bigint, boolean];

      return {
        originalAmount: result[0].toString(),
        filledAmount: result[1].toString(),
        remainingAmount: result[2].toString(),
        executed: result[3],
      };
    } catch (error) {
      console.error("Error getting order fill info:", error);
      return null;
    }
  };

  /**
   * Update order with latest fill information
   */
  const updateOrderFillInfo = async (
    order: OrderWithFillInfo
  ): Promise<OrderWithFillInfo> => {
    if (!order.realOrderId) return order;

    try {
      const fillInfo = await getOrderFillInfo(order.realOrderId);
      if (!fillInfo) return order;

      const fillPercentage = await getFillPercentage(order.realOrderId);
      const isPartial = await isPartiallyFilled(order.realOrderId);
      const isFullyDone = await isFullyExecuted(order.realOrderId);

      // Determine enhanced status
      let enhancedStatus: OrderWithFillInfo["status"] = order.status;
      if (isFullyDone) {
        enhancedStatus = "FULLY_EXECUTED";
      } else if (isPartial) {
        enhancedStatus = "PARTIALLY_FILLED";
      } else if (order.status === "MATCHED") {
        // Keep as MATCHED if not partial but was matched
        enhancedStatus = "MATCHED";
      }

      return {
        ...order,
        filledAmount: fillInfo.filledAmount,
        remainingAmount: fillInfo.remainingAmount,
        fillPercentage,
        isPartiallyFilled: isPartial,
        isFullyExecuted: isFullyDone,
        status: enhancedStatus,
        lastFillUpdate: Date.now(),
      };
    } catch (error) {
      console.error("Error updating order fill info:", error);
      return order;
    }
  };

  /**
   * Refresh fill information for all revealed orders
   */
  const refreshAllOrderFillInfo = async () => {
    if (!userOrders.length || !publicClient) return;

    console.log("Refreshing fill information for all orders...");

    const updatedOrders = await Promise.all(
      userOrders.map(async (order) => {
        if (
          order.status === "REVEALED" ||
          order.status === "MATCHED" ||
          order.status === "PARTIALLY_FILLED" ||
          order.status === "FULLY_EXECUTED"
        ) {
          return await updateOrderFillInfo(order);
        }
        return order;
      })
    );

    setUserOrders(updatedOrders);
  };

  // Auto-refresh order statuses with partial fill information every 10 seconds
  useEffect(() => {
    if (userOrders.length === 0 || !publicClient) return;

    console.log(
      "Setting up auto-refresh for order statuses with partial fill info..."
    );

    const interval = setInterval(async () => {
      console.log(
        "Auto-refreshing order statuses and fill information from blockchain..."
      );

      // Use the new comprehensive refresh function
      await refreshAllOrderFillInfo();
    }, 10000); // 10 seconds

    return () => {
      console.log("Clearing auto-refresh interval");
      clearInterval(interval);
    };
  }, [userOrders, publicClient, refreshAllOrderFillInfo]);

  // Cancel order function with smart contract support
  const cancelOrder = async (orderIndex: number) => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    if (orderIndex < 0 || orderIndex >= userOrders.length) {
      throw new Error("Invalid order index");
    }

    const order = userOrders[orderIndex];

    // Check if order can be cancelled
    if (
      order.status === "MATCHED" ||
      order.status === "PARTIALLY_FILLED" ||
      order.status === "FULLY_EXECUTED"
    ) {
      throw new Error("Cannot cancel executed or matched orders");
    }

    if (order.status === "CANCELLED") {
      throw new Error("Order is already cancelled");
    }

    try {
      // For now, we'll use the API to cancel orders
      // In the future, this could include smart contract cancellation
      const result = await apiService.cancelOrder(order.orderId || 0, address);

      // Update the order status locally
      const updatedOrders = [...userOrders];
      updatedOrders[orderIndex] = {
        ...order,
        status: "CANCELLED",
        timestamp: Date.now(),
      };

      setUserOrders(updatedOrders);

      console.log(`✅ Order ${order.orderId} cancelled successfully`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to cancel order ${order.orderId}:`, error);
      throw error;
    }
  };

  return {
    // States
    commitmentData,
    currentBatch,
    userOrders,

    // Actions
    commitOrder,
    revealOrder,
    refetchBatch,
    clearOrders,
    refreshOrderId,
    cancelOrder,

    // New Partial Fill Functions
    getRemainingAmount,
    getFilledAmount,
    isPartiallyFilled,
    isFullyExecuted,
    getFillPercentage,
    getOrderFillInfo,
    updateOrderFillInfo,
    refreshAllOrderFillInfo,

    // Transaction states
    isCommitPending: isCommitPending || isCommitConfirming,
    isRevealPending: isRevealPending || isRevealConfirming,
    commitHash,
    revealHash,
    commitError,
    revealError,
  };
}

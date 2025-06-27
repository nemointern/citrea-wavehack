import { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useWatchContractEvent,
} from "wagmi";
import { keccak256, encodePacked, parseEther } from "viem";

const ORDERBOOK_ADDRESS = "0x887102733A08332d572BfF84262ffa80fFDd81fF" as const;
import { abi as ORDERBOOK_ABI } from "../../../contracts/out/OrderBook.sol/OrderBook.json";

// Token addresses
const TOKEN_ADDRESSES = {
  wPEPE: "0x8153c10105315581FaeD05236F18c73A81ff21Db",
  wORDI: "0xdc572f9189F1d771e5C5c55BE1095B187e102481",
  wCTRA: "0x0e62a515FE7b3B07d3577DE0d863034ebd41f7BF",
  nUSD: "0x9B28B690550522608890C3C7e63c0b4A7eBab9AA",
} as const;

interface OrderData {
  tokenA: string;
  tokenB: string;
  amount: string;
  price: string;
  orderType: "BUY" | "SELL";
}

export function useOrderBook() {
  const { address } = useAccount();
  const [commitmentData, setCommitmentData] = useState<{
    hash: string;
    salt: string;
    orderData: OrderData;
  } | null>(null);

  // Store user's orders locally with localStorage persistence
  const getStorageKey = () => `citrea-orders-${address}`;

  const loadOrdersFromStorage = (): Array<{
    orderId: number | null; // Allow null for pending orders
    realOrderId?: number; // The actual smart contract order ID
    batchId: number;
    tokenA: string;
    tokenB: string;
    amount: string;
    price: string;
    orderType: "BUY" | "SELL";
    status: "COMMITTED" | "REVEALED" | "MATCHED";
    commitHash: string;
    salt: string;
    timestamp: number;
    txHash: string;
  }> => {
    if (!address || typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(getStorageKey());
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error("Error loading orders from storage:", error);
      return [];
    }
  };

  const [userOrders, setUserOrders] = useState<
    Array<{
      orderId: number | null;
      realOrderId?: number;
      batchId: number;
      tokenA: string;
      tokenB: string;
      amount: string;
      price: string;
      orderType: "BUY" | "SELL";
      status: "COMMITTED" | "REVEALED" | "MATCHED";
      commitHash: string;
      salt: string;
      timestamp: number;
      txHash: string;
    }>
  >(loadOrdersFromStorage);

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

  // Watch for OrderCommitted events to get real order IDs
  useWatchContractEvent({
    address: ORDERBOOK_ADDRESS,
    abi: ORDERBOOK_ABI,
    eventName: "OrderCommitted",
    onLogs(logs) {
      logs.forEach((log: any) => {
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
      throw error;
    }
  };

  // Update order status when reveal transaction is confirmed
  useEffect(() => {
    if (revealHash && !isRevealConfirming) {
      // Find and update the revealed order status
      setUserOrders((prev) =>
        prev.map((order) =>
          order.txHash === revealHash
            ? { ...order, status: "REVEALED" as const }
            : order
        )
      );
    }
  }, [revealHash, isRevealConfirming]);

  // Clear orders function (useful for testing)
  const clearOrders = () => {
    if (address) {
      localStorage.removeItem(getStorageKey());
      setUserOrders([]);
    }
  };

  // Add order to local state when transaction is confirmed
  useEffect(() => {
    if (commitHash && commitmentData && !isCommitConfirming) {
      // Transaction is confirmed, add order to local state
      const currentBatchData = currentBatch as { batchId?: bigint };
      const newOrder = {
        orderId: null, // Will be updated when we receive the event
        realOrderId: undefined,
        batchId: currentBatchData?.batchId
          ? Number(currentBatchData.batchId)
          : 4, // Default to current batch
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

      console.log("Added new order to local state:", newOrder);
    }
  }, [commitHash, commitmentData, isCommitConfirming, currentBatch]);

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

    // Transaction states
    isCommitPending: isCommitPending || isCommitConfirming,
    isRevealPending: isRevealPending || isRevealConfirming,
    commitHash,
    revealHash,
    commitError,
    revealError,
  };
}

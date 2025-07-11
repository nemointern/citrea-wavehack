import { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { parseEther, maxUint256, formatEther } from "viem";
import { abi as ERC20_ABI } from "../../../backend/src/abis/ERC20.json";
import {
  getOrderBookAddress,
  getAllTokenAddresses,
  type TokenSymbol,
} from "../config/addresses";

const ORDERBOOK_ADDRESS = getOrderBookAddress();

// Token addresses from centralized config
export const TOKEN_ADDRESSES = getAllTokenAddresses();

export type { TokenSymbol };

interface ApprovalState {
  allowance: bigint;
  isApproved: boolean;
  isLoading: boolean;
  balance: bigint;
}

interface ApprovalTransaction {
  hash: string;
  token: TokenSymbol;
  amount: bigint;
  isUnlimited: boolean;
  isPending: boolean;
}

export function useTokenApprovals() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const [approvalStates, setApprovalStates] = useState<
    Record<TokenSymbol, ApprovalState>
  >({
    wPEPE: { allowance: 0n, isApproved: false, isLoading: false, balance: 0n },
    wORDI: { allowance: 0n, isApproved: false, isLoading: false, balance: 0n },
    wCTRA: { allowance: 0n, isApproved: false, isLoading: false, balance: 0n },
    nUSD: { allowance: 0n, isApproved: false, isLoading: false, balance: 0n },
  });

  const [pendingApprovals, setPendingApprovals] = useState<
    ApprovalTransaction[]
  >([]);

  // Write contract for approvals
  const {
    writeContract: writeApproval,
    data: approvalHash,
    isPending: isApprovalPending,
    error: approvalError,
  } = useWriteContract();

  // Wait for approval transaction
  const { isLoading: isApprovalConfirming } = useWaitForTransactionReceipt({
    hash: approvalHash,
  });

  // Function to refresh approval data for a specific token
  const refreshApproval = async (token: TokenSymbol) => {
    if (!address || !publicClient) return;

    setApprovalStates((prev) => ({
      ...prev,
      [token]: { ...prev[token], isLoading: true },
    }));

    try {
      const tokenAddress = TOKEN_ADDRESSES[token];

      // Get allowance
      const allowance = (await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, ORDERBOOK_ADDRESS],
      })) as bigint;

      // Get balance
      const balance = (await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;

      setApprovalStates((prev) => ({
        ...prev,
        [token]: {
          allowance,
          balance,
          isApproved: allowance > 0n,
          isLoading: false,
        },
      }));
    } catch (error) {
      console.error(`Error refreshing approval for ${token}:`, error);
      setApprovalStates((prev) => ({
        ...prev,
        [token]: { ...prev[token], isLoading: false },
      }));
    }
  };

  // Refresh all approvals
  const refreshAllApprovals = async () => {
    if (!address) return;

    const tokens: TokenSymbol[] = ["wPEPE", "wORDI", "wCTRA", "nUSD"];
    await Promise.all(tokens.map((token) => refreshApproval(token)));
  };

  // Check if token has sufficient approval for amount
  const hasApproval = (token: TokenSymbol, amount: string): boolean => {
    const state = approvalStates[token];
    const requiredAmount = parseEther(amount);
    return state.allowance >= requiredAmount;
  };

  // Check if user has sufficient balance
  const hasBalance = (token: TokenSymbol, amount: string): boolean => {
    const state = approvalStates[token];
    const requiredAmount = parseEther(amount);
    return state.balance >= requiredAmount;
  };

  // Approve token for exact amount
  const approveExact = async (token: TokenSymbol, amount: string) => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    const tokenAddress = TOKEN_ADDRESSES[token];
    const approvalAmount = parseEther(amount);

    try {
      // Add to pending approvals
      const transaction: ApprovalTransaction = {
        hash: "", // Will be updated when transaction is sent
        token,
        amount: approvalAmount,
        isUnlimited: false,
        isPending: true,
      };

      setPendingApprovals((prev) => [...prev, transaction]);

      writeApproval({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [ORDERBOOK_ADDRESS, approvalAmount],
      });
    } catch (error) {
      // Remove from pending on error
      setPendingApprovals((prev) =>
        prev.filter(
          (tx) => !(tx.token === token && tx.amount === approvalAmount)
        )
      );
      throw error;
    }
  };

  // Approve token for unlimited amount
  const approveUnlimited = async (token: TokenSymbol) => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    const tokenAddress = TOKEN_ADDRESSES[token];

    try {
      // Add to pending approvals
      const transaction: ApprovalTransaction = {
        hash: "", // Will be updated when transaction is sent
        token,
        amount: maxUint256,
        isUnlimited: true,
        isPending: true,
      };

      setPendingApprovals((prev) => [...prev, transaction]);

      writeApproval({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [ORDERBOOK_ADDRESS, maxUint256],
      });
    } catch (error) {
      // Remove from pending on error
      setPendingApprovals((prev) =>
        prev.filter((tx) => !(tx.token === token && tx.isUnlimited))
      );
      throw error;
    }
  };

  // Revoke approval (set to 0)
  const revokeApproval = async (token: TokenSymbol) => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    const tokenAddress = TOKEN_ADDRESSES[token];

    writeApproval({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ORDERBOOK_ADDRESS, 0n],
    });
  };

  // Get approval status for an order
  const getOrderApprovalStatus = (
    tokenA: TokenSymbol,
    tokenB: TokenSymbol,
    amount: string,
    price: string
  ) => {
    // For a BUY order: user needs tokenB approved (they're buying tokenA with tokenB)
    // For a SELL order: user needs tokenA approved (they're selling tokenA for tokenB)

    const tokenAApproved = hasApproval(tokenA, amount);
    const tokenBAmount = (parseFloat(amount) * parseFloat(price)).toString();
    const tokenBApproved = hasApproval(tokenB, tokenBAmount);

    return {
      tokenA: {
        hasApproval: tokenAApproved,
        hasBalance: hasBalance(tokenA, amount),
        amount: amount,
        allowance: formatEther(approvalStates[tokenA].allowance),
      },
      tokenB: {
        hasApproval: tokenBApproved,
        hasBalance: hasBalance(tokenB, tokenBAmount),
        amount: tokenBAmount,
        allowance: formatEther(approvalStates[tokenB].allowance),
      },
    };
  };

  // Format allowance for display
  const formatAllowance = (token: TokenSymbol): string => {
    const allowance = approvalStates[token].allowance;
    if (allowance === 0n) return "0";
    if (allowance === maxUint256) return "Unlimited";
    return formatEther(allowance);
  };

  // Format balance for display
  const formatBalance = (token: TokenSymbol): string => {
    const balance = approvalStates[token].balance;
    return formatEther(balance);
  };

  // Handle approval transaction confirmation
  useEffect(() => {
    if (approvalHash && !isApprovalConfirming) {
      // Update pending approvals with hash
      setPendingApprovals((prev) =>
        prev.map((tx) =>
          tx.isPending && !tx.hash
            ? { ...tx, hash: approvalHash, isPending: false }
            : tx
        )
      );

      // Refresh all approvals after confirmation
      setTimeout(() => {
        refreshAllApprovals();
      }, 2000); // Wait 2 seconds for blockchain state to update
    }
  }, [approvalHash, isApprovalConfirming]);

  // Load approvals when wallet connects
  useEffect(() => {
    if (address) {
      refreshAllApprovals();
    } else {
      // Reset state when wallet disconnects
      setApprovalStates({
        wPEPE: {
          allowance: 0n,
          isApproved: false,
          isLoading: false,
          balance: 0n,
        },
        wORDI: {
          allowance: 0n,
          isApproved: false,
          isLoading: false,
          balance: 0n,
        },
        wCTRA: {
          allowance: 0n,
          isApproved: false,
          isLoading: false,
          balance: 0n,
        },
        nUSD: {
          allowance: 0n,
          isApproved: false,
          isLoading: false,
          balance: 0n,
        },
      });
      setPendingApprovals([]);
    }
  }, [address]);

  // Auto-refresh approvals every 30 seconds
  useEffect(() => {
    if (!address) return;

    const interval = setInterval(() => {
      refreshAllApprovals();
    }, 30000);

    return () => clearInterval(interval);
  }, [address]);

  return {
    // State
    approvalStates,
    pendingApprovals,

    // Actions
    approveExact,
    approveUnlimited,
    revokeApproval,
    refreshApproval,
    refreshAllApprovals,

    // Helpers
    hasApproval,
    hasBalance,
    getOrderApprovalStatus,
    formatAllowance,
    formatBalance,

    // Transaction state
    isApprovalPending: isApprovalPending || isApprovalConfirming,
    approvalHash,
    approvalError,
  };
}

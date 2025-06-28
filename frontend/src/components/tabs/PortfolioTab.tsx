import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useBalance, usePublicClient } from "wagmi";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { apiService } from "../../services/api";
import { decodeEventLog } from "viem";

// Contract addresses and ABIs
const ORDERBOOK_ADDRESS = "0x887102733A08332d572BfF84262ffa80fFDd81fF" as const;
const BRIDGE_ADDRESS = "0x800D8509C063937487E991D0c71546De8bF9D906" as const;
import { abi as ORDERBOOK_ABI } from "../../../../contracts/out/OrderBook.sol/OrderBook.json";
import { abi as BRIDGE_ABI } from "../../../../contracts/out/CitreaBridge.sol/CitreaBridge.json";

interface Transaction {
  id: string;
  type: "bridge" | "trade" | "commit" | "reveal";
  action: string;
  amount: string;
  hash: string;
  status: "confirmed" | "pending" | "failed";
  time: string;
  blockNumber: number;
}

const PortfolioTab: React.FC = () => {
  // Real wallet address from wagmi
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  // State for onchain transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTxs, setIsLoadingTxs] = useState(false);

  // Real cBTC (native) balance
  const { data: cbtcBalance, isLoading: cbtcLoading } = useBalance({
    address,
  });

  // Helper function to calculate time ago
  const getTimeAgo = (timestamp: number): string => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // Read transactions from blockchain
  const loadTransactions = async () => {
    if (!address || !publicClient) return;

    setIsLoadingTxs(true);
    console.log("🔍 Loading onchain transactions for:", address);

    try {
      // Get recent blocks - Citrea has 1000 block limit
      const latestBlock = await publicClient.getBlockNumber();
      const fromBlock = latestBlock - 999n; // Stay under 1000 block limit

      console.log(
        "🔍 Searching blocks from",
        fromBlock.toString(),
        "to",
        latestBlock.toString(),
        "for address:",
        address
      );

      const txs: Transaction[] = [];

      // Get OrderBook events
      try {
        console.log("🔍 Fetching OrderBook events from", ORDERBOOK_ADDRESS);
        const orderEvents = await publicClient.getLogs({
          address: ORDERBOOK_ADDRESS,
          fromBlock,
          toBlock: "latest",
        });

        console.log("📊 Found", orderEvents.length, "total OrderBook events");

        for (const log of orderEvents) {
          try {
            const decoded = decodeEventLog({
              abi: ORDERBOOK_ABI,
              data: log.data,
              topics: log.topics,
            });

            console.log(
              "🔍 OrderBook event:",
              decoded.eventName,
              "args:",
              decoded.args
            );

            if (decoded.args && "trader" in decoded.args) {
              const trader = decoded.args.trader as string;
              console.log(
                "👤 Event trader:",
                trader.toLowerCase(),
                "vs user:",
                address.toLowerCase()
              );

              if (trader.toLowerCase() === address.toLowerCase()) {
                console.log("✅ Found matching OrderBook transaction!");
                const block = await publicClient.getBlock({
                  blockHash: log.blockHash,
                });
                const timeAgo = getTimeAgo(Number(block.timestamp));

                if (decoded.eventName === "OrderCommitted") {
                  const args = decoded.args as Record<string, unknown>;
                  txs.push({
                    id: log.transactionHash + log.logIndex,
                    type: "commit",
                    action: "Order Committed",
                    amount: `Batch #${args.batchId || "Unknown"}`,
                    hash: log.transactionHash,
                    status: "confirmed",
                    time: timeAgo,
                    blockNumber: Number(log.blockNumber),
                  });
                }

                if (decoded.eventName === "OrderRevealed") {
                  const args = decoded.args as Record<string, unknown>;
                  const side = args.side === 0 ? "Buy" : "Sell";
                  txs.push({
                    id: log.transactionHash + log.logIndex,
                    type: "reveal",
                    action: "Order Revealed",
                    amount: `${side} Order - Batch #${
                      args.batchId || "Unknown"
                    }`,
                    hash: log.transactionHash,
                    status: "confirmed",
                    time: timeAgo,
                    blockNumber: Number(log.blockNumber),
                  });
                }
              }
            }
          } catch (decodeError) {
            console.log("⚠️ Could not decode OrderBook event:", decodeError);
          }
        }
      } catch (error) {
        console.error("❌ Error fetching OrderBook events:", error);
      }

      // Get Bridge events
      try {
        console.log("🔍 Fetching Bridge events from", BRIDGE_ADDRESS);
        const bridgeEvents = await publicClient.getLogs({
          address: BRIDGE_ADDRESS,
          fromBlock,
          toBlock: "latest",
        });

        console.log("📊 Found", bridgeEvents.length, "total Bridge events");

        for (const log of bridgeEvents) {
          try {
            const decoded = decodeEventLog({
              abi: BRIDGE_ABI,
              data: log.data,
              topics: log.topics,
            });

            console.log(
              "🔍 Bridge event:",
              decoded.eventName,
              "args:",
              decoded.args
            );

            if (decoded.args && "user" in decoded.args) {
              const user = decoded.args.user as string;
              console.log(
                "👤 Event user:",
                user.toLowerCase(),
                "vs user:",
                address.toLowerCase()
              );

              if (user.toLowerCase() === address.toLowerCase()) {
                console.log("✅ Found matching Bridge transaction!");
                const block = await publicClient.getBlock({
                  blockHash: log.blockHash,
                });
                const timeAgo = getTimeAgo(Number(block.timestamp));

                let amount = "Bridge Activity";
                const args = decoded.args as Record<string, unknown>;
                if (args.amount) {
                  amount = `${Number(args.amount) / 1e18} tokens`;
                }

                txs.push({
                  id: log.transactionHash + log.logIndex,
                  type: "bridge",
                  action: decoded.eventName || "Bridge Transaction",
                  amount: amount,
                  hash: log.transactionHash,
                  status: "confirmed",
                  time: timeAgo,
                  blockNumber: Number(log.blockNumber),
                });
              }
            }
          } catch (decodeError) {
            console.log("⚠️ Could not decode Bridge event:", decodeError);
          }
        }
      } catch (error) {
        console.error("❌ Error fetching Bridge events:", error);
      }

      // Sort by block number (newest first)
      txs.sort((a, b) => b.blockNumber - a.blockNumber);

      console.log("✅ Total transactions found:", txs.length);
      console.log("📋 Transactions:", txs);
      setTransactions(txs);
    } catch (error) {
      console.error("❌ Error loading transactions:", error);
    } finally {
      setIsLoadingTxs(false);
    }
  };

  // Load transactions when address changes
  useEffect(() => {
    if (address && publicClient) {
      loadTransactions();
    }
  }, [address, publicClient]);

  // Real balance queries (only when wallet is connected)
  const { data: nusdBalance, isLoading: nusdLoading } = useQuery({
    queryKey: ["balance", address, "nUSD"],
    queryFn: () => apiService.getTokenBalance(address!, "nUSD"),
    refetchInterval: 30000,
    enabled: !!address && isConnected,
  });

  const { data: ctraBalance, isLoading: ctraLoading } = useQuery({
    queryKey: ["balance", address, "wCTRA"],
    queryFn: () => apiService.getTokenBalance(address!, "wCTRA"),
    refetchInterval: 30000,
    enabled: !!address && isConnected,
  });

  // Format balances for display
  const formatBalance = (balance: string | undefined, decimals = 18) => {
    if (!balance) return "0.00";
    const val = parseFloat(balance) / Math.pow(10, decimals);
    return val.toLocaleString();
  };

  const balances = [
    {
      token: "cBTC",
      amount: cbtcLoading
        ? "..."
        : cbtcBalance
        ? parseFloat(cbtcBalance.formatted).toFixed(4)
        : "0.0000",
      value: cbtcBalance
        ? `$${(parseFloat(cbtcBalance.formatted) * 45000).toFixed(2)}` // Mock BTC price
        : "$0.00",
      symbol: cbtcBalance?.symbol || "cBTC",
    },
    {
      token: "nUSD",
      amount: nusdLoading ? "..." : formatBalance(nusdBalance?.balance),
      value: nusdBalance ? `$${formatBalance(nusdBalance.balance)}` : "$0.00",
    },
    {
      token: "wCTRA",
      amount: ctraLoading ? "..." : formatBalance(ctraBalance?.balance),
      value: "$0.00",
    },
  ];

  // Calculate total portfolio value including real cBTC
  const totalValue = balances.reduce(
    (sum, balance) =>
      sum + parseFloat(balance.value.replace("$", "").replace(",", "")),
    0
  );

  // If wallet not connected, show connection prompt
  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-pool-text mb-2">
            Portfolio Overview
          </h2>
          <p className="text-pool-muted">
            Connect your wallet to view your portfolio
          </p>
        </div>

        <div className="glass-card p-12 text-center">
          <Wallet className="w-16 h-16 text-citrea-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-pool-text mb-2">
            Wallet Not Connected
          </h3>
          <p className="text-pool-muted mb-6">
            Please connect your wallet to view your token balances and
            transaction history.
          </p>
          <p className="text-sm text-pool-muted">
            Use the "Connect Wallet" button in the header to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Portfolio Summary */}
      <div className="glass-card p-4 glow-orange">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Wallet className="w-8 h-8 text-citrea-500" />
            <div>
              <h3 className="text-lg font-semibold text-pool-text">
                Total Portfolio Value
              </h3>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-pool-text">
              ${totalValue.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Token Balances */}
      <div>
        <h3 className="text-xl font-semibold text-pool-text mb-4">
          Token Balances
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {balances.map((balance, index) => (
            <div
              key={index}
              className={`glass-card p-4 ${
                balance.token === "cBTC" ? "glow-orange" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-8 h-8 ${
                      balance.token === "cBTC"
                        ? "bg-orange-500"
                        : "bg-citrea-500"
                    } rounded-full flex items-center justify-center`}
                  >
                    <span className="text-xs font-bold text-white">
                      {balance.token === "cBTC" ? "₿" : balance.token.charAt(0)}
                    </span>
                  </div>
                  <span className="font-medium text-pool-text">
                    {balance.token}
                  </span>
                  {balance.token === "cBTC" && (
                    <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded">
                      Native
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-lg font-semibold text-pool-text">
                  {balance.amount}{" "}
                  {balance.token === "cBTC" ? balance.symbol || "cBTC" : ""}
                </p>
                <p className="text-sm text-pool-muted">{balance.value}</p>
                {balance.token === "cBTC" &&
                  cbtcBalance &&
                  parseFloat(cbtcBalance.formatted) > 0}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-pool-text">
            Recent Transactions ({transactions.length})
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={loadTransactions}
              disabled={isLoadingTxs}
              className="flex items-center space-x-2 px-3 py-2 bg-citrea-500/10 hover:bg-citrea-500/20 text-citrea-400 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoadingTxs ? "animate-spin" : ""}`}
              />
              <span>{isLoadingTxs ? "Loading..." : "Refresh"}</span>
            </button>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          {isLoadingTxs ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 text-citrea-500 mx-auto mb-4 animate-spin" />
              <p className="text-pool-muted">Loading onchain transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-pool-muted">No transactions found</p>
              <p className="text-sm text-pool-muted mt-2">
                Make some bridge or dark pool transactions to see them here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-pool-border">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-4 hover:bg-pool-border/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {/* Icon */}
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          tx.type === "bridge"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-citrea-500/20 text-citrea-400"
                        }`}
                      >
                        {tx.type === "bridge" ? (
                          <ArrowDownLeft className="w-5 h-5" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5" />
                        )}
                      </div>

                      {/* Details */}
                      <div>
                        <p className="font-medium text-pool-text">
                          {tx.action}
                        </p>
                        <p className="text-sm text-pool-muted">{tx.amount}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      {/* Status */}
                      <div className="text-right">
                        <p className="text-sm text-pool-muted">{tx.time}</p>
                        <div
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            tx.status === "confirmed"
                              ? "bg-green-400/10 text-green-400"
                              : "bg-yellow-400/10 text-yellow-400"
                          }`}
                        >
                          {tx.status}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-2">
                        <a
                          href={`https://explorer.testnet.citrea.xyz/tx/${tx.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-pool-border rounded transition-colors"
                          title="View on explorer"
                        >
                          <ExternalLink className="w-4 h-4 text-pool-muted" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PortfolioTab;

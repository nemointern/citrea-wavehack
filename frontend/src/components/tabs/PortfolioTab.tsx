import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useBalance } from "wagmi";
import {
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  Copy,
} from "lucide-react";
import { apiService } from "../../services/api";

const PortfolioTab: React.FC = () => {
  // Real wallet address from wagmi
  const { address, isConnected } = useAccount();

  // Real cBTC (native) balance
  const { data: cbtcBalance, isLoading: cbtcLoading } = useBalance({
    address,
  });

  // Real balance queries (only when wallet is connected)
  const { data: pepeBalance, isLoading: pepeLoading } = useQuery({
    queryKey: ["balance", address, "wPEPE"],
    queryFn: () => apiService.getTokenBalance(address!, "wPEPE"),
    refetchInterval: 30000,
    enabled: !!address && isConnected,
  });

  const { data: ordiBalance, isLoading: ordiLoading } = useQuery({
    queryKey: ["balance", address, "wORDI"],
    queryFn: () => apiService.getTokenBalance(address!, "wORDI"),
    refetchInterval: 30000,
    enabled: !!address && isConnected,
  });

  const { data: nusdBalance, isLoading: nusdLoading } = useQuery({
    queryKey: ["balance", address, "nUSD"],
    queryFn: () => apiService.getTokenBalance(address!, "nUSD"),
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
      change: "+2.1%",
      symbol: cbtcBalance?.symbol || "cBTC",
    },
    {
      token: "wPEPE",
      amount: pepeLoading ? "..." : formatBalance(pepeBalance?.balance),
      value: "$0.00",
      change: "+0.0%",
    },
    {
      token: "wORDI",
      amount: ordiLoading ? "..." : formatBalance(ordiBalance?.balance),
      value: "$0.00",
      change: "+0.0%",
    },
    {
      token: "nUSD",
      amount: nusdLoading ? "..." : formatBalance(nusdBalance?.balance),
      value: nusdBalance ? `$${formatBalance(nusdBalance.balance)}` : "$0.00",
      change: "0.0%",
    },
  ];

  const transactions = [
    {
      id: 1,
      type: "bridge",
      action: "Bridge In",
      amount: "+1,000 wPEPE",
      hash: "0xabc123...",
      status: "confirmed",
      time: "2 hours ago",
    },
    {
      id: 2,
      type: "trade",
      action: "Dark Pool Trade",
      amount: "-100 wPEPE → +24.5 nUSD",
      hash: "0xdef456...",
      status: "confirmed",
      time: "1 hour ago",
    },
    {
      id: 3,
      type: "bridge",
      action: "Bridge In",
      amount: "+500 wORDI",
      hash: "0xghi789...",
      status: "pending",
      time: "30 min ago",
    },
  ];

  // Calculate total portfolio value including real cBTC
  const totalValue = balances.reduce(
    (sum, balance) =>
      sum + parseFloat(balance.value.replace("$", "").replace(",", "")),
    0
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

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
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-pool-text mb-2">
          Portfolio Overview
        </h2>
        <p className="text-pool-muted">
          Your token balances and transaction history
        </p>
        {address && (
          <p className="text-sm text-pool-muted mt-2">
            Connected: {address.slice(0, 6)}...{address.slice(-4)}
          </p>
        )}
      </div>

      {/* Portfolio Summary */}
      <div className="glass-card p-6 glow-orange">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Wallet className="w-8 h-8 text-citrea-500" />
            <div>
              <h3 className="text-lg font-semibold text-pool-text">
                Total Portfolio Value
              </h3>
              <p className="text-sm text-pool-muted">Across all tokens</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-pool-text">
              ${totalValue.toLocaleString()}
            </p>
            <div className="flex items-center space-x-1 text-green-400">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">+5.8%</span>
            </div>
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
                <span
                  className={`text-xs font-medium ${
                    balance.change.startsWith("+")
                      ? "text-green-400"
                      : balance.change.startsWith("-")
                      ? "text-red-400"
                      : "text-pool-muted"
                  }`}
                >
                  {balance.change}
                </span>
              </div>
              <div>
                <p className="text-lg font-semibold text-pool-text">
                  {balance.amount}{" "}
                  {balance.token === "cBTC" ? balance.symbol || "cBTC" : ""}
                </p>
                <p className="text-sm text-pool-muted">{balance.value}</p>
                {balance.token === "cBTC" &&
                  cbtcBalance &&
                  parseFloat(cbtcBalance.formatted) > 0 && (
                    <p className="text-xs text-green-400 mt-1">
                      ✓ Live balance
                    </p>
                  )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-pool-text">
            Recent Transactions
          </h3>
          <button className="text-citrea-500 hover:text-citrea-400 text-sm font-medium">
            View All
          </button>
        </div>

        <div className="glass-card overflow-hidden">
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
                      <p className="font-medium text-pool-text">{tx.action}</p>
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
                      <button
                        onClick={() => copyToClipboard(tx.hash)}
                        className="p-1 hover:bg-pool-border rounded transition-colors"
                        title="Copy transaction hash"
                      >
                        <Copy className="w-4 h-4 text-pool-muted" />
                      </button>
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
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button className="glass-card p-6 hover:bg-pool-border/50 transition-colors text-center">
          <ArrowDownLeft className="w-8 h-8 text-citrea-500 mx-auto mb-2" />
          <h4 className="font-semibold text-pool-text mb-1">
            Bridge More Tokens
          </h4>
          <p className="text-sm text-pool-muted">Transfer BRC20 from Bitcoin</p>
        </button>

        <button className="glass-card p-6 hover:bg-pool-border/50 transition-colors text-center">
          <TrendingUp className="w-8 h-8 text-citrea-500 mx-auto mb-2" />
          <h4 className="font-semibold text-pool-text mb-1">
            Trade in Dark Pool
          </h4>
          <p className="text-sm text-pool-muted">MEV-protected trading</p>
        </button>

        <button className="glass-card p-6 hover:bg-pool-border/50 transition-colors text-center">
          <ArrowUpRight className="w-8 h-8 text-citrea-500 mx-auto mb-2" />
          <h4 className="font-semibold text-pool-text mb-1">Bridge Back</h4>
          <p className="text-sm text-pool-muted">Return tokens to Bitcoin</p>
        </button>
      </div>
    </div>
  );
};

export default PortfolioTab;

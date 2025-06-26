import React from "react";
import {
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  Copy,
} from "lucide-react";

const PortfolioTab: React.FC = () => {
  // Mock data
  const balances = [
    { token: "wPEPE", amount: "1,000.00", value: "$245.30", change: "+12.5%" },
    { token: "wORDI", amount: "500.00", value: "$1,250.00", change: "+8.2%" },
    { token: "nUSD", amount: "2,450.30", value: "$2,450.30", change: "0.0%" },
    { token: "cBTC", amount: "0.748", value: "$31,240.00", change: "+2.1%" },
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

  const totalValue = balances.reduce(
    (sum, balance) =>
      sum + parseFloat(balance.value.replace("$", "").replace(",", "")),
    0
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

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
            <div key={index} className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-citrea-500 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-white">
                      {balance.token.charAt(0)}
                    </span>
                  </div>
                  <span className="font-medium text-pool-text">
                    {balance.token}
                  </span>
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
                  {balance.amount}
                </p>
                <p className="text-sm text-pool-muted">{balance.value}</p>
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

import React from "react";
import {
  Activity,
  Globe,
  Zap,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

const MonitorTab: React.FC = () => {
  // Mock data
  const btcStatus = {
    connected: true,
    currentBlock: 4547250,
    monitoredAddresses: 3,
    pendingTransfers: 1,
    lastUpdate: "2 seconds ago",
  };

  const citreaStatus = {
    connected: true,
    chainId: 5115,
    gasPrice: "0.001 cBTC",
    blockTime: "2.1s",
    contracts: {
      bridge: { status: "healthy", address: "0x036A...01220" },
      orderBook: { status: "healthy", address: "0x887...81fF" },
      wPEPE: { status: "healthy", address: "0x8153...21Db" },
      wORDI: { status: "healthy", address: "0xdc57...2481" },
    },
  };

  const recentActivity = [
    {
      id: 1,
      type: "btc_block",
      message: "New Bitcoin block processed: 4547250",
      time: "30 seconds ago",
      status: "success",
    },
    {
      id: 2,
      type: "dark_pool",
      message: "Dark pool batch #42 executed: 12 orders matched",
      time: "2 minutes ago",
      status: "success",
    },
    {
      id: 3,
      type: "bridge",
      message: "BRC20 transfer detected: 1000 PEPE",
      time: "5 minutes ago",
      status: "pending",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-pool-text mb-2">
          Network Monitor
        </h2>
        <p className="text-pool-muted">
          Live monitoring of Bitcoin and Citrea networks
        </p>
      </div>

      {/* Network Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bitcoin Network */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-xl font-bold text-white">₿</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-pool-text">
                  Bitcoin Testnet
                </h3>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-400">Connected</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-pool-muted">Last Update</p>
              <p className="text-sm text-pool-text font-medium">
                {btcStatus.lastUpdate}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-pool-card border border-pool-border rounded-lg p-4">
                <p className="text-sm text-pool-muted mb-1">Current Block</p>
                <p className="text-lg font-bold text-pool-text font-mono">
                  {btcStatus.currentBlock.toLocaleString()}
                </p>
              </div>
              <div className="bg-pool-card border border-pool-border rounded-lg p-4">
                <p className="text-sm text-pool-muted mb-1">
                  Monitored Addresses
                </p>
                <p className="text-lg font-bold text-pool-text">
                  {btcStatus.monitoredAddresses}
                </p>
              </div>
            </div>

            <div className="bg-pool-card border border-pool-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-pool-muted">
                  Pending Transfers
                </span>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-400">
                    {btcStatus.pendingTransfers} pending
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Citrea Network */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-citrea-500 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-pool-text">
                  Citrea Testnet
                </h3>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-400">Connected</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-pool-muted">Chain ID</p>
              <p className="text-sm text-pool-text font-medium">
                {citreaStatus.chainId}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-pool-card border border-pool-border rounded-lg p-4">
                <p className="text-sm text-pool-muted mb-1">Gas Price</p>
                <p className="text-lg font-bold text-pool-text">
                  {citreaStatus.gasPrice}
                </p>
              </div>
              <div className="bg-pool-card border border-pool-border rounded-lg p-4">
                <p className="text-sm text-pool-muted mb-1">Block Time</p>
                <p className="text-lg font-bold text-pool-text">
                  {citreaStatus.blockTime}
                </p>
              </div>
            </div>

            {/* Contract Status */}
            <div>
              <h4 className="text-sm font-medium text-pool-text mb-2">
                Smart Contracts
              </h4>
              <div className="space-y-2">
                {Object.entries(citreaStatus.contracts).map(
                  ([name, contract]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-pool-muted capitalize">{name}</span>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-green-400">Healthy</span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Activity Feed */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-pool-text">
            Real-time Activity
          </h3>
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-citrea-500" />
            <span className="text-sm text-citrea-500">Live</span>
          </div>
        </div>

        <div className="space-y-4">
          {recentActivity.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center space-x-4 p-4 bg-pool-card border border-pool-border rounded-lg"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  activity.status === "success"
                    ? "bg-green-400/20 text-green-400"
                    : activity.status === "pending"
                    ? "bg-yellow-400/20 text-yellow-400"
                    : "bg-red-400/20 text-red-400"
                }`}
              >
                {activity.status === "success" ? (
                  <CheckCircle className="w-5 h-5" />
                ) : activity.status === "pending" ? (
                  <Clock className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1">
                <p className="text-sm text-pool-text">{activity.message}</p>
                <p className="text-xs text-pool-muted">{activity.time}</p>
              </div>

              <div
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  activity.status === "success"
                    ? "bg-green-400/10 text-green-400"
                    : activity.status === "pending"
                    ? "bg-yellow-400/10 text-yellow-400"
                    : "bg-red-400/10 text-red-400"
                }`}
              >
                {activity.status}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <button className="btn-secondary">View Full Log</button>
        </div>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 text-center">
          <Globe className="w-8 h-8 text-citrea-500 mx-auto mb-2" />
          <h4 className="font-semibold text-pool-text mb-1">Network Uptime</h4>
          <p className="text-2xl font-bold text-pool-text">99.9%</p>
        </div>

        <div className="glass-card p-4 text-center">
          <Users className="w-8 h-8 text-citrea-500 mx-auto mb-2" />
          <h4 className="font-semibold text-pool-text mb-1">Active Users</h4>
          <p className="text-2xl font-bold text-pool-text">247</p>
        </div>

        <div className="glass-card p-4 text-center">
          <Activity className="w-8 h-8 text-citrea-500 mx-auto mb-2" />
          <h4 className="font-semibold text-pool-text mb-1">
            Transactions/24h
          </h4>
          <p className="text-2xl font-bold text-pool-text">1,234</p>
        </div>

        <div className="glass-card p-4 text-center">
          <Zap className="w-8 h-8 text-citrea-500 mx-auto mb-2" />
          <h4 className="font-semibold text-pool-text mb-1">Avg. Block Time</h4>
          <p className="text-2xl font-bold text-pool-text">2.1s</p>
        </div>
      </div>
    </div>
  );
};

export default MonitorTab;

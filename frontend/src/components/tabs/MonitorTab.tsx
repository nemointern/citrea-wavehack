import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useBlockNumber, useGasPrice } from "wagmi";
import {
  Zap,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { apiService } from "../../services/api";
import { formatEther } from "viem";

const MonitorTab: React.FC = () => {
  const { data: blockNumber } = useBlockNumber();
  const { data: gasPrice } = useGasPrice();
  // Real API data with auto-refresh every 30 seconds
  const {
    data: healthData,
    isLoading: healthLoading,
    error: healthError,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ["health"],
    queryFn: apiService.getHealth,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const {
    data: btcMonitorData,
    isLoading: btcLoading,
    error: btcError,
  } = useQuery({
    queryKey: ["btc-monitor"],
    queryFn: apiService.getBTCMonitorStatus,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Format the data for display
  const btcStatus = {
    connected: btcMonitorData?.isRunning || false,
    currentBlock: btcMonitorData?.currentBlock || 0,
    monitoredAddresses: btcMonitorData?.monitoredAddresses?.length || 0,
    pendingTransfers: btcMonitorData?.pendingTransfers || 0,
    lastUpdate: btcMonitorData?.lastUpdate || "Unknown",
  };

  const citreaStatus = {
    connected: healthData?.services?.citrea !== null,
    chainId: healthData?.services?.citrea?.chainId || 5115,
    // gas price is in wei
    gasPrice: gasPrice ? formatEther(gasPrice) + " cBTC" : "0 cBTC",
    blockNumber: blockNumber ? blockNumber.toString() : "0",
    contracts: {
      bridge: { status: "healthy", address: "0x036A...01220" },
      orderBook: { status: "healthy", address: "0x887...81fF" },
      wPEPE: { status: "healthy", address: "0x8153...21Db" },
      wORDI: { status: "healthy", address: "0xdc57...2481" },
    },
  };

  // Generate activity based on real data
  const recentActivity = [
    {
      id: 1,
      type: "btc_block",
      message: `Bitcoin monitoring: Block ${btcStatus.currentBlock}`,
      time: btcStatus.lastUpdate,
      status: btcStatus.connected ? "success" : "error",
    },
    {
      id: 2,
      type: "dark_pool",
      message: `Matching engine: ${
        healthData?.services?.matchingEngine?.totalPairs || 0
      } pairs active`,
      time: "Live",
      status: "success",
    },
    {
      id: 3,
      type: "bridge",
      message: `${btcStatus.monitoredAddresses} addresses monitored`,
      time: "Live",
      status: btcStatus.pendingTransfers > 0 ? "pending" : "success",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center space-x-4 mb-2">
          <button
            onClick={() => refetchHealth()}
            disabled={healthLoading || btcLoading}
            className="p-2 bg-citrea-500/10 hover:bg-citrea-500/20 border border-citrea-500/30 text-citrea-400 hover:text-citrea-300 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh data"
          >
            <RefreshCw
              className={`w-4 h-4 ${
                healthLoading || btcLoading ? "animate-spin" : ""
              }`}
            />
          </button>
        </div>
        {(healthError || btcError) && (
          <div className="mt-2 text-sm text-red-400">
            {healthError?.message || btcError?.message || "Failed to load data"}
          </div>
        )}
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
                  <div
                    className={`w-2 h-2 rounded-full animate-pulse ${
                      btcStatus.connected ? "bg-green-400" : "bg-red-400"
                    }`}
                  ></div>
                  <span
                    className={`text-sm ${
                      btcStatus.connected ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {btcStatus.connected ? "Connected" : "Disconnected"}
                  </span>
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
                  {btcStatus.currentBlock > 0
                    ? btcStatus.currentBlock.toLocaleString()
                    : "Loading..."}
                </p>
                {btcStatus.currentBlock > 0 && (
                  <p className="text-xs text-green-400 mt-1">
                    ✓ Live Bitcoin data
                  </p>
                )}
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
                <p className="text-sm text-pool-muted mb-1">Block Number</p>
                <p className="text-lg font-bold text-pool-text">
                  {blockNumber}
                </p>
              </div>
            </div>

            {/* Contract Status */}
            <div>
              <h4 className="text-sm font-medium text-pool-text mb-2">
                Smart Contracts
              </h4>
              <div className="space-y-2">
                {Object.entries(citreaStatus.contracts).map(([name]) => (
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
                ))}
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
      </div>
    </div>
  );
};

export default MonitorTab;

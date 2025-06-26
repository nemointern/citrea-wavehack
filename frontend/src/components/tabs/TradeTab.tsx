import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  Shield,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  ArrowUpDown,
} from "lucide-react";
import { apiService } from "../../services/api";

const TradeTab: React.FC = () => {
  const [orderType, setOrderType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [tokenA, setTokenA] = useState("wPEPE");
  const [tokenB, setTokenB] = useState("nUSD");

  // Real batch data with auto-refresh every 5 seconds
  const { data: currentBatchData, isLoading: batchLoading } = useQuery({
    queryKey: ["current-batch"],
    queryFn: apiService.getCurrentBatch,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: matchingStatsData } = useQuery({
    queryKey: ["matching-stats"],
    queryFn: apiService.getMatchingStats,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Use real data or fallback to reasonable defaults
  const currentBatch = {
    id: currentBatchData?.batchId || 1,
    phase:
      (currentBatchData?.phase?.toUpperCase() as
        | "COMMIT"
        | "REVEAL"
        | "EXECUTE") || "COMMIT",
    timeRemaining: currentBatchData?.timeRemaining || 300,
    ordersCommitted:
      currentBatchData?.ordersCommitted || currentBatchData?.totalOrders || 0,
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSwapTokens = () => {
    const temp = tokenA;
    setTokenA(tokenB);
    setTokenB(temp);
    setOrderType(orderType === "buy" ? "sell" : "buy");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-pool-text mb-2">
          Dark Pool Trading
        </h2>
        <p className="text-pool-muted">
          MEV-Protected Trading with Commit-Reveal Pattern
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Batch Status */}
        <div className="lg:col-span-1">
          <div className="glass-card p-6 glow-orange">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-pool-text">
                Current Batch
              </h3>
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-citrea-500" />
                <span className="text-sm text-citrea-500 font-medium">
                  #{currentBatch.id}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Phase */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-pool-muted">Phase</span>
                  <span className="text-sm font-medium text-citrea-400">
                    {currentBatch.phase}
                  </span>
                </div>
                <div className="w-full bg-pool-border rounded-full h-2">
                  <div
                    className="bg-citrea-500 h-2 rounded-full transition-all duration-1000"
                    style={{
                      width: currentBatch.phase === "COMMIT" ? "60%" : "90%",
                    }}
                  ></div>
                </div>
              </div>

              {/* Timer */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-pool-muted">Time Remaining</span>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-citrea-500" />
                  <span className="font-mono text-lg font-bold text-pool-text">
                    {formatTime(currentBatch.timeRemaining)}
                  </span>
                </div>
              </div>

              {/* Orders */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-pool-muted">
                  Orders Committed
                </span>
                <span className="text-lg font-bold text-pool-text">
                  {batchLoading ? "..." : currentBatch.ordersCommitted}
                </span>
              </div>

              {/* Matching Stats */}
              {matchingStatsData && (
                <div className="text-xs text-pool-muted bg-pool-card border border-pool-border rounded p-2">
                  <div className="flex justify-between">
                    <span>Total Orders:</span>
                    <span>{matchingStatsData.totalOrders || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Matches:</span>
                    <span>{matchingStatsData.totalMatches || 0}</span>
                  </div>
                  <div className="text-xs text-green-400 mt-1">
                    ✓ Live matching engine
                  </div>
                </div>
              )}

              {/* Demo mode indicator */}
              {currentBatchData?.message && (
                <div className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded p-2">
                  ⚠️ {currentBatchData.message}
                </div>
              )}

              {/* MEV Protection indicator */}
              <div className="bg-green-400/10 border border-green-400/20 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-green-400 font-medium">
                    MEV Protection Active
                  </span>
                </div>
                <p className="text-xs text-pool-muted mt-1">
                  Your order is hidden until reveal phase
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Order Form */}
        <div className="lg:col-span-2">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-pool-text">
                Create Order
              </h3>
              <div className="flex items-center space-x-2">
                <EyeOff className="w-5 h-5 text-citrea-500" />
                <span className="text-sm text-citrea-500">Private Order</span>
              </div>
            </div>

            <div className="space-y-6">
              {/* Order Type */}
              <div className="flex space-x-2">
                <button
                  onClick={() => setOrderType("buy")}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                    orderType === "buy"
                      ? "bg-green-500 text-white"
                      : "bg-pool-card border border-pool-border text-pool-muted hover:text-pool-text"
                  }`}
                >
                  <TrendingUp className="w-4 h-4 inline mr-2" />
                  Buy
                </button>
                <button
                  onClick={() => setOrderType("sell")}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                    orderType === "sell"
                      ? "bg-red-500 text-white"
                      : "bg-pool-card border border-pool-border text-pool-muted hover:text-pool-text"
                  }`}
                >
                  <TrendingDown className="w-4 h-4 inline mr-2" />
                  Sell
                </button>
              </div>

              {/* Token Pair */}
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-pool-text mb-2">
                      From
                    </label>
                    <select
                      value={tokenA}
                      onChange={(e) => setTokenA(e.target.value)}
                      className="input-field w-full"
                    >
                      <option value="wPEPE">wPEPE</option>
                      <option value="wORDI">wORDI</option>
                      <option value="nUSD">nUSD</option>
                    </select>
                  </div>

                  <button
                    onClick={handleSwapTokens}
                    className="mt-8 p-2 rounded-lg border border-pool-border hover:bg-pool-border transition-colors"
                  >
                    <ArrowUpDown className="w-4 h-4 text-pool-muted" />
                  </button>

                  <div className="flex-1">
                    <label className="block text-sm font-medium text-pool-text mb-2">
                      To
                    </label>
                    <select
                      value={tokenB}
                      onChange={(e) => setTokenB(e.target.value)}
                      className="input-field w-full"
                    >
                      <option value="nUSD">nUSD</option>
                      <option value="wPEPE">wPEPE</option>
                      <option value="wORDI">wORDI</option>
                    </select>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-pool-text mb-2">
                    Amount
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="input-field w-full pr-16"
                    />
                    <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-pool-muted text-sm">
                      {tokenA}
                    </span>
                  </div>
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-pool-text mb-2">
                    Price per {tokenA}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.0001"
                      className="input-field w-full pr-16"
                    />
                    <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-pool-muted text-sm">
                      {tokenB}
                    </span>
                  </div>
                </div>

                {/* Order Summary */}
                {amount && price && (
                  <div className="bg-pool-card border border-pool-border rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-pool-muted">Total</span>
                      <span className="text-pool-text font-medium">
                        {(parseFloat(amount) * parseFloat(price)).toFixed(4)}{" "}
                        {tokenB}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-pool-muted">Order Type</span>
                      <span className="text-pool-text capitalize">
                        {orderType}
                      </span>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  className="btn-citrea w-full"
                  disabled={
                    !amount || !price || currentBatch.phase !== "COMMIT"
                  }
                >
                  {currentBatch.phase === "COMMIT" ? (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Commit Order (Hidden)
                    </>
                  ) : (
                    "Commit Phase Ended"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-4 text-center">
          <Shield className="w-8 h-8 text-citrea-500 mx-auto mb-2" />
          <h4 className="font-semibold text-pool-text mb-1">MEV Protection</h4>
          <p className="text-sm text-pool-muted">
            Orders are hidden until reveal phase
          </p>
        </div>
        <div className="glass-card p-4 text-center">
          <Clock className="w-8 h-8 text-citrea-500 mx-auto mb-2" />
          <h4 className="font-semibold text-pool-text mb-1">Batch Execution</h4>
          <p className="text-sm text-pool-muted">
            All orders execute at fair prices
          </p>
        </div>
        <div className="glass-card p-4 text-center">
          <Eye className="w-8 h-8 text-citrea-500 mx-auto mb-2" />
          <h4 className="font-semibold text-pool-text mb-1">Private Trading</h4>
          <p className="text-sm text-pool-muted">
            No front-running or sandwich attacks
          </p>
        </div>
      </div>
    </div>
  );
};

export default TradeTab;

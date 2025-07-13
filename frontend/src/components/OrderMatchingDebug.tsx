import React, { useState, useEffect } from "react";
import { Play, RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { API_BASE_URL } from "../config/api";

interface CurrentBatch {
  batchId: number;
  phase: string;
  timeRemaining: number;
  ordersCommitted?: number;
}

interface MatchingStats {
  totalOrders: number;
  totalMatches: number;
  totalPairs: number;
}

interface TestOrder {
  orderId: number;
  trader: string;
  tokenA: string;
  tokenB: string;
  amount: string;
  price: string;
  orderType: string;
  batchId: number;
  timestamp: number;
}

interface MatchResult {
  buyOrderId: number;
  sellOrderId: number;
  matchedAmount: string;
  executionPrice: string;
}

export const OrderMatchingDebug: React.FC = () => {
  const [currentBatch, setCurrentBatch] = useState<CurrentBatch | null>(null);
  const [matchingStats, setMatchingStats] = useState<MatchingStats | null>(
    null
  );
  const [testResults, setTestResults] = useState<{
    orders: TestOrder[];
    matches: MatchResult[];
    error?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch current status
  const fetchStatus = async () => {
    try {
      const [batchRes, statsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/darkpool/batch/current`),
        fetch(`${API_BASE_URL}/api/darkpool/matching/stats`),
      ]);

      const batch = await batchRes.json();
      const stats = await statsRes.json();

      setCurrentBatch(batch);
      setMatchingStats(stats);
    } catch (error) {
      console.error("Failed to fetch status:", error);
    }
  };

  // Test order matching with sample orders
  const testMatching = async () => {
    setIsLoading(true);
    setTestResults(null);

    try {
      // Create sample orders that should match
      const sampleOrders = [
        {
          orderId: 1,
          trader: "0x1234567890123456789012345678901234567890",
          tokenA: "nUSD",
          tokenB: "wPEPE",
          amount: "100000000000000000000", // 100 * 1e18
          price: "10000000000000000", // 0.01 * 1e18
          orderType: "BUY",
          batchId: 999,
          timestamp: Date.now(),
        },
        {
          orderId: 2,
          trader: "0x9876543210987654321098765432109876543210",
          tokenA: "nUSD",
          tokenB: "wPEPE",
          amount: "100000000000000000000", // 100 * 1e18
          price: "10000000000000000", // 0.01 * 1e18
          orderType: "SELL",
          batchId: 999,
          timestamp: Date.now(),
        },
      ];

      const response = await fetch(
        `${API_BASE_URL}/api/darkpool/batch/process`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            batchId: 999,
            orders: sampleOrders,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to process batch");
      }

      setTestResults({
        orders: sampleOrders,
        matches: result.matches || [],
        error: result.error,
      });
    } catch (error: unknown) {
      setTestResults({
        orders: [],
        matches: [],
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh status
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const getPhaseColor = (phase: string) => {
    switch (phase?.toLowerCase()) {
      case "commit":
        return "text-blue-400 bg-blue-400/10 border-blue-400/20";
      case "reveal":
        return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
      case "execute":
        return "text-green-400 bg-green-400/10 border-green-400/20";
      default:
        return "text-pool-muted bg-pool-border/10 border-pool-border/20";
    }
  };

  const getPhaseIcon = (phase: string) => {
    switch (phase?.toLowerCase()) {
      case "commit":
        return <Clock className="w-4 h-4" />;
      case "reveal":
        return <RefreshCw className="w-4 h-4" />;
      case "execute":
        return <Play className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="glass-card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-pool-text">
          🔍 Order Matching Debugger
        </h3>
        <button
          onClick={fetchStatus}
          className="btn-secondary px-4 py-2 text-sm"
          disabled={isLoading}
        >
          <RefreshCw
            className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Batch Status */}
        <div className="space-y-4">
          <h4 className="font-semibold text-pool-text">📊 Current Batch</h4>
          {currentBatch ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-pool-muted">Batch ID:</span>
                <span className="font-mono text-pool-text">
                  #{currentBatch.batchId}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-pool-muted">Phase:</span>
                <div
                  className={`flex items-center space-x-2 px-3 py-1 rounded-lg border text-sm ${getPhaseColor(
                    currentBatch.phase
                  )}`}
                >
                  {getPhaseIcon(currentBatch.phase)}
                  <span className="capitalize">{currentBatch.phase}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-pool-muted">Time Remaining:</span>
                <span className="font-mono text-pool-text">
                  {currentBatch.timeRemaining}s
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-pool-muted">Orders:</span>
                <span className="font-mono text-pool-text">
                  {currentBatch.ordersCommitted || 0}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-pool-muted">Loading...</div>
          )}
        </div>

        {/* Matching Stats */}
        <div className="space-y-4">
          <h4 className="font-semibold text-pool-text">🔧 Matching Engine</h4>
          {matchingStats ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-pool-muted">Total Orders:</span>
                <span className="font-mono text-pool-text">
                  {matchingStats.totalOrders}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-pool-muted">Total Matches:</span>
                <span className="font-mono text-green-400">
                  {matchingStats.totalMatches}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-pool-muted">Token Pairs:</span>
                <span className="font-mono text-pool-text">
                  {matchingStats.totalPairs}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-pool-muted">Success Rate:</span>
                <span className="font-mono text-pool-text">
                  {matchingStats.totalOrders > 0
                    ? `${(
                        (matchingStats.totalMatches /
                          matchingStats.totalOrders) *
                        100
                      ).toFixed(1)}%`
                    : "N/A"}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-pool-muted">Loading...</div>
          )}
        </div>
      </div>

      {/* Test Matching Button */}
      <div className="border-t border-pool-border pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-semibold text-pool-text">
              🧪 Test Order Matching
            </h4>
            <p className="text-sm text-pool-muted">
              Test the matching engine with sample BUY and SELL orders
            </p>
          </div>
          <button
            onClick={testMatching}
            disabled={isLoading}
            className="btn-citrea px-6 py-3"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Test
              </>
            )}
          </button>
        </div>

        {/* Test Results */}
        {testResults && (
          <div className="space-y-4">
            {testResults.error ? (
              <div className="flex items-center space-x-2 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <div>
                  <div className="font-medium text-red-400">Test Failed</div>
                  <div className="text-sm text-red-300">
                    {testResults.error}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Test Summary */}
                <div className="flex items-center space-x-2 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <div>
                    <div className="font-medium text-green-400">
                      Test Completed
                    </div>
                    <div className="text-sm text-green-300">
                      {testResults.matches.length} matches found from{" "}
                      {testResults.orders.length} orders
                    </div>
                  </div>
                </div>

                {/* Match Details */}
                {testResults.matches.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="font-medium text-pool-text">
                      Matches Found:
                    </h5>
                    {testResults.matches.map((match, i) => (
                      <div
                        key={i}
                        className="border border-pool-border rounded-lg p-4"
                      >
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-pool-muted">Buy Order</div>
                            <div className="font-mono text-pool-text">
                              #{match.buyOrderId}
                            </div>
                          </div>
                          <div>
                            <div className="text-pool-muted">Sell Order</div>
                            <div className="font-mono text-pool-text">
                              #{match.sellOrderId}
                            </div>
                          </div>
                          <div>
                            <div className="text-pool-muted">Amount</div>
                            <div className="font-mono text-pool-text">
                              {(parseFloat(match.matchedAmount) / 1e18).toFixed(
                                2
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-pool-muted">Price</div>
                            <div className="font-mono text-pool-text">
                              {(
                                parseFloat(match.executionPrice) / 1e18
                              ).toFixed(4)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {testResults.matches.length === 0 && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="text-yellow-400 font-medium mb-2">
                      No Matches Found
                    </div>
                    <div className="text-sm text-yellow-300 space-y-1">
                      <div>Possible reasons:</div>
                      <div>• Orders are for different token pairs</div>
                      <div>• Buy price is lower than sell price</div>
                      <div>• Orders are outside price tolerance range</div>
                      <div>• Matching algorithm configuration issue</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderMatchingDebug;

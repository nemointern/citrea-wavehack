import React from "react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Users,
  ArrowUpDown,
} from "lucide-react";

interface OrderBookLevel {
  price: string;
  amount: string;
  total: string;
  orders: number;
}

interface OrderBookDepthProps {
  pair: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: {
    absolute: string;
    percentage: string;
  } | null;
  stats: {
    totalBids: number;
    totalAsks: number;
    totalBidVolume: string;
    totalAskVolume: string;
  };
  lastUpdate: string;
  isLoading?: boolean;
  compact?: boolean;
  onPairChange?: (newPair: string) => void;
  availablePairs?: string[];
}

const OrderBookDepth: React.FC<OrderBookDepthProps> = ({
  pair,
  bids,
  asks,
  spread,
  stats,
  lastUpdate,
  isLoading = false,
  compact = false,
  onPairChange,
  availablePairs = ["wPEPE-nUSD", "wCTRA-nUSD", "wPEPE-wCTRA"],
}) => {
  const formatNumber = (value: string, decimals: number = 6) => {
    const num = parseFloat(value);
    if (num === 0) return "0";
    if (num < 0.000001) return num.toExponential(2);
    return num.toFixed(decimals);
  };

  const formatVolume = (value: string) => {
    const num = parseFloat(value);
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const getMaxTotal = () => {
    const maxBidTotal =
      bids.length > 0 ? Math.max(...bids.map((b) => parseFloat(b.total))) : 0;
    const maxAskTotal =
      asks.length > 0 ? Math.max(...asks.map((a) => parseFloat(a.total))) : 0;
    return Math.max(maxBidTotal, maxAskTotal);
  };

  const maxTotal = getMaxTotal();

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-pool-border rounded"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-pool-border rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-citrea-500" />
            <h3 className="text-lg font-semibold text-pool-text">Order Book</h3>
          </div>
          {onPairChange ? (
            <select
              value={pair}
              onChange={(e) => onPairChange(e.target.value)}
              className="px-2 py-1 bg-citrea-500/10 border border-citrea-500/30 rounded text-xs text-citrea-400 font-medium focus:outline-none focus:border-citrea-500"
            >
              {availablePairs.map((p) => (
                <option
                  key={p}
                  value={p}
                  className="bg-pool-card text-pool-text"
                >
                  {p}
                </option>
              ))}
            </select>
          ) : (
            <div className="px-2 py-1 bg-citrea-500/10 border border-citrea-500/30 rounded text-xs text-citrea-400 font-medium">
              {pair}
            </div>
          )}
        </div>
        <div className="text-xs text-pool-muted">
          Last update: {new Date(lastUpdate).toLocaleTimeString()}
        </div>
      </div>

      {/* Stats Summary */}
      {!compact && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-400 font-medium">Bids</span>
              </div>
              <span className="text-xs text-pool-muted">
                {stats.totalBids} orders
              </span>
            </div>
            <div className="text-sm text-pool-text font-medium">
              {formatVolume(stats.totalBidVolume)}
            </div>
          </div>
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400 font-medium">Asks</span>
              </div>
              <span className="text-xs text-pool-muted">
                {stats.totalAsks} orders
              </span>
            </div>
            <div className="text-sm text-pool-text font-medium">
              {formatVolume(stats.totalAskVolume)}
            </div>
          </div>
        </div>
      )}

      {/* Spread */}
      {spread && (
        <div className="bg-citrea-500/5 border border-citrea-500/20 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ArrowUpDown className="w-4 h-4 text-citrea-400" />
              <span className="text-sm text-citrea-400 font-medium">
                Spread
              </span>
            </div>
            <div className="text-right">
              <div className="text-sm text-pool-text font-medium">
                {formatNumber(spread.absolute, 8)}
              </div>
              <div className="text-xs text-pool-muted">
                {spread.percentage}%
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Order Book Headers */}
        <div className="grid grid-cols-4 gap-2 text-xs text-pool-muted font-medium">
          <div>Price</div>
          <div className="text-right">Amount</div>
          <div className="text-right">Total</div>
          <div className="text-right">Orders</div>
        </div>

        {/* Asks (Sell Orders) - Lowest price first */}
        <div className="space-y-1">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400 font-medium">Asks</span>
          </div>
          {asks.length === 0 ? (
            <div className="text-center py-4 text-pool-muted text-sm">
              No sell orders
            </div>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {asks
                .slice()
                .reverse()
                .map((ask, index) => {
                  const fillPercentage =
                    maxTotal > 0 ? (parseFloat(ask.total) / maxTotal) * 100 : 0;
                  return (
                    <div
                      key={`ask-${index}`}
                      className="relative grid grid-cols-4 gap-2 text-xs py-1 px-2 rounded hover:bg-red-500/5 transition-colors duration-200"
                    >
                      {/* Background fill */}
                      <div
                        className="absolute left-0 top-0 h-full bg-red-500/10 rounded"
                        style={{ width: `${fillPercentage}%` }}
                      ></div>

                      {/* Content */}
                      <div className="relative text-red-400 font-medium">
                        {formatNumber(ask.price, 6)}
                      </div>
                      <div className="relative text-right text-pool-text">
                        {formatVolume(ask.amount)}
                      </div>
                      <div className="relative text-right text-pool-muted">
                        {formatVolume(ask.total)}
                      </div>
                      <div className="relative text-right text-pool-muted flex items-center justify-end space-x-1">
                        <Users className="w-3 h-3" />
                        <span>{ask.orders}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Market Price / Spread */}
        {spread && (
          <div className="py-2 border-t border-b border-pool-border">
            <div className="text-center">
              <div className="text-xs text-pool-muted">Market Spread</div>
              <div className="text-sm text-citrea-400 font-medium">
                {formatNumber(spread.absolute, 8)} ({spread.percentage}%)
              </div>
            </div>
          </div>
        )}

        {/* Bids (Buy Orders) - Highest price first */}
        <div className="space-y-1">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-400 font-medium">Bids</span>
          </div>
          {bids.length === 0 ? (
            <div className="text-center py-4 text-pool-muted text-sm">
              No buy orders
            </div>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {bids.map((bid, index) => {
                const fillPercentage =
                  maxTotal > 0 ? (parseFloat(bid.total) / maxTotal) * 100 : 0;
                return (
                  <div
                    key={`bid-${index}`}
                    className="relative grid grid-cols-4 gap-2 text-xs py-1 px-2 rounded hover:bg-green-500/5 transition-colors duration-200"
                  >
                    {/* Background fill */}
                    <div
                      className="absolute left-0 top-0 h-full bg-green-500/10 rounded"
                      style={{ width: `${fillPercentage}%` }}
                    ></div>

                    {/* Content */}
                    <div className="relative text-green-400 font-medium">
                      {formatNumber(bid.price, 6)}
                    </div>
                    <div className="relative text-right text-pool-text">
                      {formatVolume(bid.amount)}
                    </div>
                    <div className="relative text-right text-pool-muted">
                      {formatVolume(bid.total)}
                    </div>
                    <div className="relative text-right text-pool-muted flex items-center justify-end space-x-1">
                      <Users className="w-3 h-3" />
                      <span>{bid.orders}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Empty State */}
      {bids.length === 0 && asks.length === 0 && (
        <div className="text-center py-8">
          <Activity className="w-8 h-8 text-pool-muted mx-auto mb-3" />
          <div className="text-sm text-pool-muted mb-2">
            No orders revealed yet
          </div>
          <div className="text-xs text-pool-muted">
            Orders will appear here once traders reveal them during the REVEAL
            phase
          </div>
        </div>
      )}

      {/* Real-time indicator */}
      <div className="flex items-center justify-center mt-4 pt-4 border-t border-pool-border">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-xs text-pool-muted">Real-time data</span>
        </div>
      </div>
    </div>
  );
};

export default OrderBookDepth;

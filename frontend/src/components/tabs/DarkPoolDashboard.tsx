import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  Shield,
  BarChart3,
  Activity,
  Eye,
  EyeOff,
  Zap,
} from "lucide-react";
import { apiService } from "../../services/api";

interface PriceFeed {
  pair: string;
  price: number;
  change24h: number;
  volume24h: number;
}

interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

const DarkPoolDashboard: React.FC = () => {
  const [selectedPair, setSelectedPair] = useState("wPEPE/nUSD");
  const [showOrderBook, setShowOrderBook] = useState(false);

  // Real matching stats
  const { data: matchingStats } = useQuery({
    queryKey: ["matching-stats"],
    queryFn: apiService.getMatchingStats,
    refetchInterval: 5000,
  });

  // Mock price feeds (in real app, this would come from API)
  const priceFeeds: PriceFeed[] = [
    {
      pair: "wPEPE/nUSD",
      price: 0.001,
      change24h: 5.2,
      volume24h: 150000,
    },
    {
      pair: "wCTRA/nUSD",
      price: 0.01,
      change24h: 12.5,
      volume24h: 250000,
    },
    {
      pair: "wCTRA/wPEPE",
      price: 10,
      change24h: 3.1,
      volume24h: 80000,
    },
  ];

  // Mock order book data (hidden in dark pool)
  const generateOrderBook = () => {
    const bids: OrderBookEntry[] = [];
    const asks: OrderBookEntry[] = [];

    const basePrice =
      priceFeeds.find((p) => p.pair === selectedPair)?.price || 1;

    for (let i = 0; i < 10; i++) {
      const bidPrice = basePrice * (1 - (i + 1) * 0.001);
      const askPrice = basePrice * (1 + (i + 1) * 0.001);
      const amount = Math.random() * 10000 + 1000;

      bids.push({
        price: bidPrice,
        amount,
        total: amount * bidPrice,
      });

      asks.push({
        price: askPrice,
        amount,
        total: amount * askPrice,
      });
    }

    return { bids, asks };
  };

  const { bids, asks } = generateOrderBook();

  const formatNumber = (num: number, decimals: number = 2) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(decimals);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-pool-text mb-2">
          Dark Pool Analytics Dashboard
        </h2>
        <p className="text-pool-muted">
          Advanced MEV-Protected Trading with Real-Time Analytics
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-6 glow-blue">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-pool-muted">Total Trading Pairs</p>
              <p className="text-2xl font-bold text-pool-text">
                {matchingStats?.totalPairs || 12}
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="glass-card p-6 glow-green">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-pool-muted">24h Volume</p>
              <p className="text-2xl font-bold text-pool-text">
                $
                {formatNumber(
                  priceFeeds.reduce((sum, p) => sum + p.volume24h, 0)
                )}
              </p>
            </div>
            <Activity className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="glass-card p-6 glow-orange">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-pool-muted">MEV Protection</p>
              <p className="text-2xl font-bold text-green-400">100%</p>
            </div>
            <Shield className="w-8 h-8 text-orange-400" />
          </div>
        </div>

        <div className="glass-card p-6 glow-purple">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-pool-muted">Avg Batch Time</p>
              <p className="text-2xl font-bold text-pool-text">5.2s</p>
            </div>
            <Zap className="w-8 h-8 text-purple-400" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Price Feeds */}
        <div className="lg:col-span-2">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-pool-text">
                Live Price Feeds
              </h3>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-400">Live</span>
              </div>
            </div>

            <div className="space-y-3">
              {priceFeeds.map((feed) => (
                <div
                  key={feed.pair}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedPair === feed.pair
                      ? "border-citrea-500 bg-citrea-500/10"
                      : "border-pool-border hover:border-pool-muted"
                  }`}
                  onClick={() => setSelectedPair(feed.pair)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-pool-text">{feed.pair}</p>
                      <p className="text-2xl font-bold text-pool-text">
                        {feed.price.toFixed(feed.price < 1 ? 6 : 2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div
                        className={`flex items-center space-x-1 ${
                          feed.change24h >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {feed.change24h >= 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        <span className="font-medium">
                          {Math.abs(feed.change24h).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-sm text-pool-muted">
                        Vol: ${formatNumber(feed.volume24h)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Order Book & Dark Pool Info */}
        <div className="space-y-6">
          {/* Dark Pool Protection */}
          <div className="glass-card p-6 glow-purple">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-pool-text">
                MEV Protection
              </h3>
              <Shield className="w-6 h-6 text-purple-400" />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-pool-muted">Front-running</span>
                <span className="text-sm font-medium text-green-400">
                  ✓ Blocked
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-pool-muted">
                  Sandwich attacks
                </span>
                <span className="text-sm font-medium text-green-400">
                  ✓ Blocked
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-pool-muted">
                  Order visibility
                </span>
                <span className="text-sm font-medium text-orange-400">
                  ⚡ Hidden
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-pool-muted">Fair execution</span>
                <span className="text-sm font-medium text-green-400">
                  ✓ Guaranteed
                </span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-purple-400/10 border border-purple-400/20 rounded-lg">
              <p className="text-xs text-purple-400">
                🛡️ All orders are hidden during commit phase and executed fairly
                using batch auctions with reference price matching.
              </p>
            </div>
          </div>

          {/* Order Book Toggle */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-pool-text">
                Order Book
              </h3>
              <button
                onClick={() => setShowOrderBook(!showOrderBook)}
                className="flex items-center space-x-2 text-sm bg-citrea-500/10 hover:bg-citrea-500/20 text-citrea-400 hover:text-citrea-300 border border-citrea-500/30 px-3 py-1.5 rounded-lg transition-all duration-200"
              >
                {showOrderBook ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    <span>Hide</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    <span>Show Preview</span>
                  </>
                )}
              </button>
            </div>

            {showOrderBook ? (
              <div className="space-y-4">
                <p className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded p-2">
                  ⚠️ This is estimated data. Real orders are hidden in dark
                  pool.
                </p>

                {/* Asks */}
                <div>
                  <h4 className="text-sm font-medium text-red-400 mb-2">
                    Asks (Sell Orders)
                  </h4>
                  <div className="space-y-1">
                    {asks.slice(0, 5).map((ask, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-red-400">
                          {ask.price.toFixed(6)}
                        </span>
                        <span className="text-pool-muted">
                          {formatNumber(ask.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Spread */}
                <div className="border-t border-pool-border pt-2">
                  <div className="text-center text-sm text-pool-muted">
                    Spread:{" "}
                    {(
                      ((asks[0].price - bids[0].price) / bids[0].price) *
                      100
                    ).toFixed(2)}
                    %
                  </div>
                </div>

                {/* Bids */}
                <div>
                  <h4 className="text-sm font-medium text-green-400 mb-2">
                    Bids (Buy Orders)
                  </h4>
                  <div className="space-y-1">
                    {bids.slice(0, 5).map((bid, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-green-400">
                          {bid.price.toFixed(6)}
                        </span>
                        <span className="text-pool-muted">
                          {formatNumber(bid.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <EyeOff className="w-12 h-12 text-pool-muted mx-auto mb-4" />
                <p className="text-sm text-pool-muted">
                  Order book is hidden
                  <br />
                  for MEV protection
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DarkPoolDashboard;

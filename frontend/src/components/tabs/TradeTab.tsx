import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  Clock,
  Shield,
  TrendingUp,
  TrendingDown,
  EyeOff,
  ArrowUpDown,
  Eye,
  X,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { apiService } from "../../services/api";
import { useOrderBook } from "../../hooks/useOrderBook";

interface OrderFormData {
  tokenA: string;
  tokenB: string;
  amount: string;
  price: string;
  orderType: "BUY" | "SELL";
}

const TradeTab: React.FC = () => {
  const { address } = useAccount();

  // Wallet-based order book hook
  const {
    commitOrder,
    revealOrder,
    commitmentData,
    userOrders: walletOrders,
    isCommitPending,
    isRevealPending,
    commitHash,
    commitError,
    refreshOrderId,
  } = useOrderBook();

  // Form state
  const [orderForm, setOrderForm] = useState<OrderFormData>({
    tokenA: "wPEPE",
    tokenB: "nUSD",
    amount: "",
    price: "",
    orderType: "BUY",
  });

  const [showMyOrders, setShowMyOrders] = useState(false);
  const [selectedOrderForReveal, setSelectedOrderForReveal] = useState<
    number | null
  >(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Real-time data queries
  const { data: currentBatchData, isLoading: batchLoading } = useQuery({
    queryKey: ["current-batch"],
    queryFn: apiService.getCurrentBatch,
    refetchInterval: 5000,
  });

  const cancelOrderMutation = useMutation({
    mutationFn: apiService.cancelOrder,
    onSuccess: () => {
      setNotification({
        type: "success",
        message: "Order cancelled successfully!",
      });
    },
    onError: (error: Error) => {
      setNotification({
        type: "error",
        message: `Failed to cancel order: ${error.message}`,
      });
    },
  });

  // Auto-hide notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const currentBatch = {
    id: currentBatchData?.batchId || 1,
    phase:
      (currentBatchData?.phase?.toUpperCase() as
        | "COMMIT"
        | "REVEAL"
        | "EXECUTE") || "COMMIT",
    timeRemaining: currentBatchData?.timeRemaining || 300,
    ordersCommitted: currentBatchData?.ordersCommitted || 0,
  };

  // Use wallet orders (from smart contract) - API orders are no longer needed
  const userOrders = walletOrders;

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSwapTokens = () => {
    setOrderForm({
      ...orderForm,
      tokenA: orderForm.tokenB,
      tokenB: orderForm.tokenA,
      orderType: orderForm.orderType === "BUY" ? "SELL" : "BUY",
    });
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) {
      setNotification({
        type: "error",
        message: "Please connect your wallet to submit orders",
      });
      return;
    }

    if (!orderForm.amount || !orderForm.price) {
      setNotification({
        type: "error",
        message: "Please fill in amount and price",
      });
      return;
    }

    if (currentBatch.phase !== "COMMIT") {
      setNotification({
        type: "error",
        message: "Orders can only be submitted during COMMIT phase",
      });
      return;
    }

    try {
      // Call smart contract directly with user's wallet
      const result = await commitOrder(orderForm);

      setNotification({
        type: "success",
        message: `Order committed! Please save your salt: ${result.salt}`,
      });

      // Reset form
      setOrderForm({ ...orderForm, amount: "", price: "" });
    } catch (error: unknown) {
      setNotification({
        type: "error",
        message: `Failed to commit order: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  };

  const handleRevealOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedOrderForReveal === null) {
      setNotification({
        type: "error",
        message: "Please select an order to reveal",
      });
      return;
    }

    try {
      // selectedOrderForReveal is already the array index, use it directly
      const order = userOrders[selectedOrderForReveal];

      if (!order) {
        setNotification({
          type: "error",
          message: "Order not found",
        });
        return;
      }

      console.log("Revealing order:", order);

      // Call smart contract directly with user's wallet using order index
      await revealOrder(selectedOrderForReveal as number);

      setNotification({
        type: "success",
        message: "Order revealed successfully!",
      });

      setSelectedOrderForReveal(null);
    } catch (error: any) {
      setNotification({
        type: "error",
        message: `Failed to reveal order: ${error.message}`,
      });
    }
  };

  const getOrderStatusIcon = (status: string) => {
    switch (status) {
      case "COMMITTED":
        return <EyeOff className="w-4 h-4" />;
      case "REVEALED":
        return <Eye className="w-4 h-4" />;
      case "MATCHED":
        return <CheckCircle className="w-4 h-4" />;
      case "FAILED":
        return <X className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg border backdrop-blur-md ${
            notification.type === "success"
              ? "bg-green-500/10 border-green-500/20 text-green-400"
              : notification.type === "error"
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-blue-500/10 border-blue-500/20 text-blue-400"
          }`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === "success" && (
              <CheckCircle className="w-5 h-5" />
            )}
            {notification.type === "error" && (
              <AlertTriangle className="w-5 h-5" />
            )}
            {notification.type === "info" && <Clock className="w-5 h-5" />}
            <span className="text-sm font-medium">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 text-pool-muted hover:text-pool-text"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
        <div className="lg:col-span-1 space-y-6">
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
                      width:
                        currentBatch.phase === "COMMIT"
                          ? "33%"
                          : currentBatch.phase === "REVEAL"
                          ? "66%"
                          : "100%",
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

              {/* MEV Protection */}
              <div className="bg-green-400/10 border border-green-400/20 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-green-400 font-medium">
                    MEV Protection Active
                  </span>
                </div>
                <p className="text-xs text-pool-muted mt-1">
                  Orders are hidden until reveal phase
                </p>
              </div>
            </div>
          </div>

          {/* My Orders Toggle */}
          {address && (
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-pool-text">
                  My Orders
                </h3>
                <button
                  onClick={() => setShowMyOrders(!showMyOrders)}
                  className="text-sm text-citrea-500 hover:text-citrea-400"
                >
                  {showMyOrders ? "Hide" : "Show"} ({userOrders.length})
                </button>
              </div>

              {/* Order Status Summary */}
              {userOrders.length > 0 && (
                <div className="mb-4 p-3 bg-pool-card/50 border border-pool-border rounded-lg">
                  <div className="text-xs text-pool-muted mb-2">
                    Order Status Summary:
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <div className="flex items-center space-x-1">
                      <EyeOff className="w-3 h-3 text-yellow-400" />
                      <span className="text-yellow-400">
                        {
                          userOrders.filter(
                            (order) => order.status === "COMMITTED"
                          ).length
                        }{" "}
                        Committed
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Eye className="w-3 h-3 text-blue-400" />
                      <span className="text-blue-400">
                        {
                          userOrders.filter(
                            (order) => order.status === "REVEALED"
                          ).length
                        }{" "}
                        Revealed
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      <span className="text-green-400">
                        {
                          userOrders.filter(
                            (order) => order.status === "MATCHED"
                          ).length
                        }{" "}
                        Matched
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {showMyOrders && (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {userOrders.length === 0 ? (
                    <p className="text-sm text-pool-muted text-center py-4">
                      No orders yet
                    </p>
                  ) : (
                    userOrders.map((order, index) => (
                      <div
                        key={order.txHash || `order-${index}`}
                        className={`border rounded-lg p-3 ${
                          order.status === "COMMITTED"
                            ? "bg-yellow-500/5 border-yellow-500/20"
                            : order.status === "REVEALED"
                            ? "bg-blue-500/5 border-blue-500/20"
                            : order.status === "MATCHED"
                            ? "bg-green-500/5 border-green-500/20"
                            : "bg-pool-card border-pool-border"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-pool-text">
                              Order #{order.orderId || "Pending"}
                            </span>
                            {!order.realOrderId && order.txHash && (
                              <button
                                onClick={async () => {
                                  console.log(
                                    "Refreshing order ID for:",
                                    order.txHash
                                  );
                                  try {
                                    const result = await refreshOrderId(
                                      order.txHash
                                    );
                                    console.log("Refresh result:", result);
                                    if (result) {
                                      setNotification({
                                        type: "success",
                                        message: `Order ID updated: #${result}`,
                                      });
                                    } else {
                                      setNotification({
                                        type: "error",
                                        message:
                                          "Could not fetch order ID. Check console for details.",
                                      });
                                    }
                                  } catch (error) {
                                    console.error(
                                      "Error refreshing order ID:",
                                      error
                                    );
                                    setNotification({
                                      type: "error",
                                      message: "Failed to refresh order ID",
                                    });
                                  }
                                }}
                                className="text-xs text-citrea-500 hover:text-citrea-400 px-1 py-0.5 rounded border border-citrea-500/30"
                                title="Fetch order ID from blockchain"
                              >
                                Refresh ID
                              </button>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            {/* Enhanced Status Badge */}
                            <div
                              className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium ${
                                order.status === "COMMITTED"
                                  ? "bg-yellow-500/20 text-yellow-400"
                                  : order.status === "REVEALED"
                                  ? "bg-blue-500/20 text-blue-400"
                                  : order.status === "MATCHED"
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-pool-border text-pool-muted"
                              }`}
                            >
                              {getOrderStatusIcon(order.status)}
                              <span>{order.status}</span>
                            </div>
                          </div>
                        </div>

                        {/* Order Details */}
                        <div className="text-xs text-pool-muted mb-2">
                          {order.orderType} {order.amount} {order.tokenA} @{" "}
                          {order.price} {order.tokenB}
                        </div>

                        {/* Batch and Status Info */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-3">
                            <span className="text-pool-muted">
                              Batch #{order.batchId}
                              {Number(order.batchId) ===
                                Number(currentBatch.id) && (
                                <span className="ml-1 text-citrea-500">
                                  (Current)
                                </span>
                              )}
                            </span>
                            {order.status === "COMMITTED" && (
                              <span className="text-yellow-400">
                                {Number(order.batchId) ===
                                Number(currentBatch.id)
                                  ? currentBatch.phase === "COMMIT"
                                    ? "⏳ Waiting for reveal phase"
                                    : currentBatch.phase === "REVEAL"
                                    ? "🔄 Can reveal now"
                                    : "⏰ Reveal phase ended"
                                  : "❌ Reveal phase ended"}
                              </span>
                            )}
                            {order.status === "REVEALED" && (
                              <span className="text-blue-400">
                                ✅ Ready for matching
                              </span>
                            )}
                            {order.status === "MATCHED" && (
                              <span className="text-green-400">
                                🎉 Successfully matched
                              </span>
                            )}
                          </div>
                          <div className="flex space-x-1">
                            {order.status === "COMMITTED" &&
                              currentBatch.phase === "REVEAL" &&
                              Number(order.batchId) ===
                                Number(currentBatch.id) && (
                                <button
                                  onClick={() =>
                                    setSelectedOrderForReveal(index)
                                  }
                                  className="text-xs text-blue-400 hover:text-blue-300"
                                  disabled={!order.realOrderId}
                                  title={
                                    !order.realOrderId
                                      ? "Waiting for order ID from blockchain..."
                                      : "Reveal your order"
                                  }
                                >
                                  {!order.realOrderId ? "Pending..." : "Reveal"}
                                </button>
                              )}
                            {order.status === "COMMITTED" && (
                              <button
                                onClick={() =>
                                  Number(order.batchId) ===
                                    Number(currentBatch.id) &&
                                  cancelOrderMutation.mutate(order.orderId || 0)
                                }
                                className={`text-xs transition-colors ${
                                  Number(order.batchId) ===
                                  Number(currentBatch.id)
                                    ? "text-red-400 hover:text-red-300"
                                    : "text-gray-500 cursor-not-allowed"
                                }`}
                                disabled={
                                  cancelOrderMutation.isPending ||
                                  Number(order.batchId) !==
                                    Number(currentBatch.id)
                                }
                                title={
                                  Number(order.batchId) !==
                                  Number(currentBatch.id || 0)
                                    ? "Cannot cancel orders from previous batches"
                                    : "Cancel order"
                                }
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
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

            <form onSubmit={handleSubmitOrder} className="space-y-6">
              {/* Order Type */}
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() =>
                    setOrderForm({ ...orderForm, orderType: "BUY" })
                  }
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                    orderForm.orderType === "BUY"
                      ? "bg-green-500 text-white"
                      : "bg-pool-card border border-pool-border text-pool-muted hover:text-pool-text"
                  }`}
                >
                  <TrendingUp className="w-4 h-4 inline mr-2" />
                  Buy
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setOrderForm({ ...orderForm, orderType: "SELL" })
                  }
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                    orderForm.orderType === "SELL"
                      ? "bg-red-500 text-white"
                      : "bg-pool-card border border-pool-border text-pool-muted hover:text-pool-text"
                  }`}
                >
                  <TrendingDown className="w-4 h-4 inline mr-2" />
                  Sell
                </button>
              </div>

              {/* Token Pair */}
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-pool-text mb-2">
                    From
                  </label>
                  <select
                    value={orderForm.tokenA}
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, tokenA: e.target.value })
                    }
                    className="input-field w-full"
                  >
                    <option value="wPEPE">wPEPE</option>
                    <option value="wORDI">wORDI</option>
                    <option value="wCTRA">wCTRA</option>
                    <option value="nUSD">nUSD</option>
                  </select>
                </div>

                <button
                  type="button"
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
                    value={orderForm.tokenB}
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, tokenB: e.target.value })
                    }
                    className="input-field w-full"
                  >
                    <option value="nUSD">nUSD</option>
                    <option value="wPEPE">wPEPE</option>
                    <option value="wORDI">wORDI</option>
                    <option value="wCTRA">wCTRA</option>
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
                    step="any"
                    value={orderForm.amount}
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, amount: e.target.value })
                    }
                    placeholder="0.00"
                    className="input-field w-full pr-16"
                    required
                  />
                  <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-pool-muted text-sm">
                    {orderForm.tokenA}
                  </span>
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-pool-text mb-2">
                  Price per {orderForm.tokenA}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={orderForm.price}
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, price: e.target.value })
                    }
                    placeholder="0.0001"
                    className="input-field w-full pr-16"
                    required
                  />
                  <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-pool-muted text-sm">
                    {orderForm.tokenB}
                  </span>
                </div>
              </div>

              {/* Order Summary */}
              {orderForm.amount && orderForm.price && (
                <div className="bg-pool-card border border-pool-border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-pool-muted">Total</span>
                    <span className="text-pool-text font-medium">
                      {(
                        parseFloat(orderForm.amount) *
                        parseFloat(orderForm.price)
                      ).toFixed(6)}{" "}
                      {orderForm.tokenB}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-pool-muted">Order Type</span>
                    <span className="text-pool-text capitalize">
                      {orderForm.orderType}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-pool-muted">Batch</span>
                    <span className="text-pool-text">#{currentBatch.id}</span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="btn-citrea w-full"
                disabled={
                  !orderForm.amount ||
                  !orderForm.price ||
                  currentBatch.phase !== "COMMIT" ||
                  isCommitPending ||
                  !address
                }
              >
                {isCommitPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing Transaction...
                  </>
                ) : !address ? (
                  "Connect Wallet to Trade"
                ) : currentBatch.phase === "COMMIT" ? (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Commit Order (Hidden)
                  </>
                ) : (
                  `${currentBatch.phase} Phase - Orders Locked`
                )}
              </button>

              {/* Transaction Status */}
              {commitHash && (
                <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-400">
                      Transaction Submitted
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(commitHash)
                        }
                        className="text-green-400 hover:text-green-300"
                        title="Copy transaction hash"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={`https://explorer.testnet.citrea.xyz/tx/${commitHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-400 hover:text-green-300"
                        title="View on explorer"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                  <p className="text-xs text-pool-muted mt-1">
                    TX: {commitHash.slice(0, 10)}...{commitHash.slice(-8)}
                  </p>
                </div>
              )}

              {/* Commitment Data */}
              {commitmentData && (
                <div className="mt-4 p-3 bg-citrea-500/10 border border-citrea-500/20 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-citrea-400">
                      Save Your Salt!
                    </span>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(commitmentData.salt)
                      }
                      className="text-citrea-400 hover:text-citrea-300"
                      title="Copy salt"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-pool-muted font-mono">
                    Salt: {commitmentData.salt}
                  </p>
                  <p className="text-xs text-yellow-400 mt-1">
                    ⚠️ You need this salt to reveal your order!
                  </p>
                </div>
              )}

              {/* Errors */}
              {commitError && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-400">
                    Error: {commitError.message}
                  </p>
                </div>
              )}

              {!address && (
                <p className="text-sm text-yellow-400 text-center">
                  ⚠️ Connect your wallet to submit orders
                </p>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Reveal Order Modal */}
      {selectedOrderForReveal !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-pool-text">
                Reveal Order #
                {userOrders[selectedOrderForReveal]?.realOrderId ||
                  userOrders[selectedOrderForReveal]?.orderId ||
                  "Pending"}
              </h3>
              <button
                onClick={() => setSelectedOrderForReveal(null)}
                className="text-pool-muted hover:text-pool-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRevealOrder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-pool-text mb-2">
                  Salt (saved from order submission)
                </label>
                <input
                  type="text"
                  value={userOrders[selectedOrderForReveal]?.salt || ""}
                  readOnly
                  className="input-field w-full bg-pool-card/50"
                />
                <p className="text-xs text-green-400 mt-1">
                  ✓ Salt automatically loaded from your order
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-pool-text mb-2">
                  Amount
                </label>
                <input
                  type="text"
                  value={userOrders[selectedOrderForReveal]?.amount || ""}
                  readOnly
                  className="input-field w-full bg-pool-card/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-pool-text mb-2">
                  Price
                </label>
                <input
                  type="text"
                  value={userOrders[selectedOrderForReveal]?.price || ""}
                  readOnly
                  className="input-field w-full bg-pool-card/50"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForReveal(null)}
                  className="flex-1 px-4 py-2 border border-pool-border text-pool-text rounded-lg hover:bg-pool-border transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-citrea"
                  disabled={isRevealPending}
                >
                  {isRevealPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing Transaction...
                    </>
                  ) : (
                    "Reveal Order"
                  )}
                </button>
              </div>
            </form>

            <div className="mt-4 p-3 bg-green-400/10 border border-green-400/20 rounded-lg">
              <p className="text-xs text-green-400">
                ✓ All order details are automatically filled from your saved
                order data.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeTab;

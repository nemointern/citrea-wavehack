import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { API_BASE_URL } from "../../config/api";
import {
  ArrowRight,
  Copy,
  QrCode,
  CheckCircle,
  Clock,
  AlertCircle,
  Wallet,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
interface BridgeRequest {
  id: string;
  userId: string;
  fromAddress: string;
  toAddress: string;
  ticker: string;
  amount: string;
  status: "pending" | "deposited" | "minting" | "completed" | "failed";
  txHash?: string;
  citreaTxHash?: string;
  createdAt: number;
  updatedAt: number;
  error?: string;
}

const BridgeTab: React.FC = () => {
  const [selectedToken, setSelectedToken] = useState<"CTRA" | "PEPE" | "ORDI">(
    "CTRA"
  );
  const [currentRequest, setCurrentRequest] = useState<{
    bridgeRequestId: string;
    depositAddress: string;
    instructions: string;
  } | null>(null);
  const [step, setStep] = useState<"select" | "deposit" | "monitor">("select");
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
    txHash?: string;
  } | null>(null);
  const queryClient = useQueryClient();

  // Real wallet connection
  const { address: walletAddress, isConnected } = useAccount();

  // Get bridge statistics
  const { data: bridgeStats } = useQuery({
    queryKey: ["bridge-stats"],
    queryFn: () =>
      fetch(`${API_BASE_URL}/api/bridge/stats`).then((r) => r.json()),
    refetchInterval: 5000,
  });

  // Get bridge status
  const { data: bridgeStatus } = useQuery({
    queryKey: ["bridge-status"],
    queryFn: () =>
      fetch(`${API_BASE_URL}/api/bridge/status`).then((r) => r.json()),
    refetchInterval: 3000,
  });

  // Get user's bridge requests
  const { data: userRequests, refetch: refetchRequests } = useQuery({
    queryKey: ["user-bridge-requests", walletAddress],
    queryFn: () =>
      walletAddress
        ? fetch(
            `${API_BASE_URL}/api/bridge/user/${walletAddress}/requests`
          ).then((r) => r.json())
        : Promise.resolve({ requests: [] }),
    enabled: !!walletAddress,
    refetchInterval: 5000,
  });

  // Mutation for creating bridge request
  const createBridgeMutation = useMutation({
    mutationFn: async (data: {
      userId: string;
      ticker: string;
      toAddress: string;
    }) => {
      const response = await fetch(`${API_BASE_URL}/api/bridge/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentRequest(data);
      setStep("deposit");
      queryClient.invalidateQueries({ queryKey: ["bridge-stats"] });
      queryClient.invalidateQueries({ queryKey: ["user-bridge-requests"] });
    },
  });

  // Mutation for triggering mock deposit (dev/demo only)
  const triggerMockDepositMutation = useMutation({
    mutationFn: async (data: { bridgeRequestId: string; amount?: string }) => {
      const response = await fetch(
        `${API_BASE_URL}/api/bridge/mock/trigger-deposit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to trigger mock deposit");
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Refresh user requests to show updated status
      refetchRequests();
      queryClient.invalidateQueries({ queryKey: ["bridge-stats"] });

      // Auto-switch to monitor step to watch progress
      setTimeout(() => {
        setStep("monitor");
      }, 2000);

      // Poll for completion and show transaction hash
      const pollForCompletion = async () => {
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/bridge/request/${data.bridgeRequestId}`
          );
          if (response.ok) {
            const request = await response.json();
            if (request.status === "completed" && request.citreaTxHash) {
              setNotification({
                type: "success",
                message: `✅ Bridge completed! ${request.amount} w${request.ticker} minted successfully.`,
                txHash: request.citreaTxHash,
              });
            } else if (request.status === "failed") {
              setNotification({
                type: "error",
                message: `❌ Bridge failed: ${
                  request.error || "Unknown error"
                }`,
              });
            } else {
              // Still processing, poll again
              setTimeout(pollForCompletion, 3000);
            }
          }
        } catch (error) {
          console.error("Error polling bridge status:", error);
        }
      };

      // Start polling after a short delay
      setTimeout(pollForCompletion, 5000);
    },
    onError: (error) => {
      setNotification({
        type: "error",
        message: `❌ Failed to trigger mock deposit: ${error.message}`,
      });
    },
  });

  // Auto-hide notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000); // Hide after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleCreateBridge = () => {
    if (!walletAddress) return;

    createBridgeMutation.mutate({
      userId: walletAddress,
      ticker: selectedToken,
      toAddress: walletAddress,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-400 bg-green-400/10 border-green-400/20";
      case "minting":
        return "text-blue-400 bg-blue-400/10 border-blue-400/20";
      case "deposited":
        return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
      case "failed":
        return "text-red-400 bg-red-400/10 border-red-400/20";
      default:
        return "text-pool-muted bg-pool-border/10 border-pool-border/20";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      case "minting":
        return <RefreshCw className="w-4 h-4 animate-spin" />;
      case "deposited":
        return <Clock className="w-4 h-4" />;
      case "failed":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-md p-4 rounded-xl border backdrop-blur-sm transition-all duration-300 ${
            notification.type === "success"
              ? "bg-green-500/10 border-green-500/20 text-green-400"
              : notification.type === "error"
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-blue-500/10 border-blue-500/20 text-blue-400"
          }`}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              {notification.type === "success" ? (
                <CheckCircle className="w-5 h-5" />
              ) : notification.type === "error" ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <Clock className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{notification.message}</p>
              {notification.txHash && (
                <a
                  href={`https://explorer.citrea.xyz/tx/${notification.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-xs text-citrea-400 hover:text-citrea-300 mt-1"
                >
                  <span>View Transaction</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <button
              onClick={() => setNotification(null)}
              className="flex-shrink-0 text-current opacity-70 hover:opacity-100"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center">
        {/* Wallet Status */}
        {isConnected && walletAddress ? (
          <div className="mt-6 inline-flex items-center space-x-2 px-6 py-3 bg-green-400/10 border border-green-400/20 rounded-xl">
            <Wallet className="w-5 h-5 text-green-400" />
            <span className="text-green-400 font-medium">
              Bridged tokens will be sent to: {walletAddress.slice(0, 6)}...
              {walletAddress.slice(-4)}
            </span>
          </div>
        ) : (
          <div className="mt-6 inline-flex items-center space-x-2 px-6 py-3 bg-yellow-400/10 border border-yellow-400/20 rounded-xl">
            <Wallet className="w-5 h-5 text-yellow-400" />
            <span className="text-yellow-400 font-medium">
              Connect wallet to start bridging
            </span>
          </div>
        )}

        <div className="mt-4 inline-flex items-center space-x-2 px-6 py-3 bg-blue-400/10 border border-blue-400/20 rounded-xl"></div>
      </div>

      {/* Main Bridge Interface */}
      {step === "select" && (
        <div className="glass-card p-8 max-w-2xl mx-auto">
          <h3 className="text-xl font-bold text-pool-text mb-6 text-center">
            Create Bridge Request
          </h3>

          <div className="space-y-6">
            {/* Token Selection */}
            <div>
              <label className="block text-sm font-medium text-pool-text mb-3">
                Select BRC20 Token
              </label>
              <div className="grid grid-cols-2 gap-4">
                {["CTRA", "PEPE"].map((token) => (
                  <button
                    key={token}
                    onClick={() => setSelectedToken(token as "CTRA" | "PEPE")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedToken === token
                        ? "border-citrea-500 bg-citrea-500/10 text-citrea-300"
                        : "border-pool-border bg-pool-dark/50 text-pool-text hover:border-citrea-500/50"
                    }`}
                  >
                    <div className="text-lg font-bold">{token}</div>
                    <div className="text-sm text-pool-muted">
                      Bridge to w{token}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Bridge Instructions */}
            <div className="bg-citrea-500/5 border border-citrea-500/20 rounded-xl p-6">
              <h4 className="font-semibold text-pool-text mb-3">
                How it works:
              </h4>
              <div className="space-y-2 text-sm text-pool-muted">
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 bg-citrea-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    1
                  </div>
                  <span>Create bridge request and get deposit address</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 bg-citrea-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    2
                  </div>
                  <span>
                    Send {selectedToken} BRC20 tokens to the deposit address
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 bg-citrea-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    3
                  </div>
                  <span>
                    Receive w{selectedToken} tokens on Citrea automatically
                  </span>
                </div>
              </div>
            </div>

            {/* Create Bridge Button */}
            <button
              onClick={handleCreateBridge}
              disabled={!isConnected || createBridgeMutation.isPending}
              className="btn-citrea w-full py-4 text-lg font-semibold"
            >
              {createBridgeMutation.isPending ? (
                <span className="flex items-center justify-center space-x-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Creating Bridge Request...</span>
                </span>
              ) : (
                `Create ${selectedToken} → w${selectedToken} Bridge`
              )}
            </button>

            {createBridgeMutation.error && (
              <div className="flex items-center text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl p-4">
                <AlertCircle className="w-5 h-5 mr-3" />
                <span>Failed to create bridge request</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deposit Step */}
      {step === "deposit" && currentRequest && (
        <div className="glass-card p-8 max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-pool-text mb-2">
              Bridge Request Created!
            </h3>
            <p className="text-pool-muted">
              Request ID:{" "}
              <span className="font-mono text-citrea-300">
                {currentRequest.bridgeRequestId}
              </span>
            </p>
          </div>

          <div className="space-y-6">
            {/* Deposit Address */}
            <div>
              <label className="block text-sm font-medium text-pool-text mb-3">
                Send {selectedToken} BRC20 to this address:
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={currentRequest.depositAddress}
                  readOnly
                  className="input-field flex-1 font-mono text-sm"
                />
                <button
                  onClick={() => copyToClipboard(currentRequest.depositAddress)}
                  className="btn-secondary px-4 py-3"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button className="btn-secondary px-4 py-3">
                  <QrCode className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6">
              <h4 className="font-semibold text-pool-text mb-3">
                Instructions:
              </h4>
              <div className="text-sm text-pool-muted whitespace-pre-line">
                {currentRequest.instructions}
              </div>
            </div>

            {/* Demo Testing Controls */}
            <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-6">
              <h4 className="font-semibold text-pool-text mb-3">
                Demo Testing Controls
              </h4>
              <p className="text-sm text-pool-muted mb-4">
                For testing purposes, you can manually trigger a mock deposit
                instead of waiting for the automatic simulation.
              </p>
              <button
                onClick={() => {
                  triggerMockDepositMutation.mutate({
                    bridgeRequestId: currentRequest.bridgeRequestId,
                    amount: "10.5", // Mock amount for testing
                  });
                }}
                disabled={triggerMockDepositMutation.isPending}
                className={`px-4 py-2 text-sm rounded-lg border transition-all duration-200 disabled:opacity-50 ${
                  triggerMockDepositMutation.isPending
                    ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                    : "bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20"
                }`}
              >
                {triggerMockDepositMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Triggering Deposit...
                  </>
                ) : (
                  <>Trigger Mock Deposit Now</>
                )}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4">
              <button
                onClick={() => setStep("monitor")}
                className="btn-citrea flex-1 py-3"
              >
                Monitor Progress
              </button>
              <button
                onClick={() => {
                  setStep("select");
                  setCurrentRequest(null);
                }}
                className="btn-secondary flex-1 py-3"
              >
                Create Another
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monitor Step */}
      {step === "monitor" && (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-xl font-bold text-pool-text mb-2">
              Monitor Bridge Progress
            </h3>
            <p className="text-pool-muted">
              Track your BRC20 → Citrea bridge transactions
            </p>
          </div>

          {/* User's Bridge Requests */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-lg font-semibold text-pool-text">
                Your Bridge Requests
              </h4>
              <button
                onClick={() => refetchRequests()}
                className="btn-secondary px-4 py-2 text-sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
            </div>

            {userRequests?.requests && userRequests.requests.length > 0 ? (
              <div className="space-y-4">
                {userRequests.requests.map((request: BridgeRequest) => (
                  <div
                    key={request.id}
                    className="border border-pool-border rounded-xl p-5"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="text-lg font-semibold text-pool-text">
                          {request.ticker} → w{request.ticker}
                        </div>
                        <div
                          className={`flex items-center space-x-2 px-3 py-1 rounded-lg border text-sm ${getStatusColor(
                            request.status
                          )}`}
                        >
                          {getStatusIcon(request.status)}
                          <span className="capitalize">{request.status}</span>
                        </div>
                      </div>
                      <div className="text-sm text-pool-muted">
                        {new Date(request.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-pool-muted mb-1">Amount</div>
                        <div className="font-mono text-pool-text">
                          {request.amount || "Waiting for deposit..."}
                        </div>
                      </div>
                      <div>
                        <div className="text-pool-muted mb-1">
                          BTC Transaction
                        </div>
                        <div className="font-mono text-pool-text">
                          {request.txHash ? (
                            <a
                              href={`https://blockstream.info/testnet/tx/${request.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-citrea-400 hover:text-citrea-300 flex items-center space-x-1 transition-colors duration-200"
                            >
                              <span>{request.txHash.slice(0, 8)}...</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            "Pending..."
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-pool-muted mb-1">
                          Citrea Transaction
                        </div>
                        <div className="font-mono text-pool-text">
                          {request.citreaTxHash ? (
                            <a
                              href={`https://explorer.testnet.citrea.xyz/tx/${request.citreaTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-citrea-400 hover:text-citrea-300 flex items-center space-x-1 transition-colors duration-200"
                            >
                              <span>{request.citreaTxHash.slice(0, 8)}...</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            "Pending..."
                          )}
                        </div>
                      </div>
                    </div>

                    {request.error && (
                      <div className="mt-3 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg p-3">
                        Error: {request.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-pool-muted">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No bridge requests yet</p>
                <button
                  onClick={() => setStep("select")}
                  className="btn-citrea px-6 py-2"
                >
                  Create Your First Bridge
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Real-time Bridge Stats */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-citrea-500">
            {bridgeStats?.totalRequests || 0}
          </div>
          <div className="text-sm text-pool-muted">Total Bridges</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-green-400">
            {bridgeStats?.completed || 0}
          </div>
          <div className="text-sm text-pool-muted">Completed</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-yellow-400">
            {bridgeStatus?.pendingRequests || 0}
          </div>
          <div className="text-sm text-pool-muted">Pending</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-pool-text">
            {bridgeStatus?.isProcessing ? (
              <span className="flex items-center">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2" />
                Live
              </span>
            ) : (
              "Offline"
            )}
          </div>
          <div className="text-sm text-pool-muted">Bridge Status</div>
        </div>
      </div>
      {/* Flow Visualization */}
      <div className="flex items-center justify-center space-x-6 py-8">
        <div className="flex flex-col items-center space-y-2">
          <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold">₿</span>
          </div>
          <div className="text-sm text-pool-muted">BRC20</div>
          <div className="text-xs text-pool-muted">Bitcoin</div>
        </div>

        <ArrowRight className="w-8 h-8 text-citrea-500" />

        <div className="flex flex-col items-center space-y-2">
          <div className="w-12 h-12 bg-citrea-gradient rounded-full flex items-center justify-center">
            <span className="text-white font-bold">⚡</span>
          </div>
          <div className="text-sm text-pool-muted">wBRC20</div>
          <div className="text-xs text-pool-muted">Citrea</div>
        </div>
      </div>

      {/* Back to Selection */}
      {step !== "select" && (
        <div className="text-center">
          <button
            onClick={() => {
              setStep("select");
              setCurrentRequest(null);
            }}
            className="btn-secondary px-8 py-3"
          >
            Start New Bridge
          </button>
        </div>
      )}
    </div>
  );
};

export default BridgeTab;

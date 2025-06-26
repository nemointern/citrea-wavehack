import React, { useState } from "react";
import {
  ArrowRight,
  Copy,
  QrCode,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";

const BridgeTab: React.FC = () => {
  const [btcAddress, setBtcAddress] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);

  // Mock bridge address
  const bridgeAddress = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";

  const handleRegister = () => {
    if (btcAddress.trim()) {
      setIsRegistered(true);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-pool-text mb-2">
          Bridge BRC20 to Citrea
        </h2>
        <p className="text-pool-muted">
          Send your BRC20 tokens to Bitcoin and receive wrapped ERC20 tokens on
          Citrea
        </p>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1: Register */}
        <div className="glass-card p-6">
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 bg-citrea-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">
              1
            </div>
            <h3 className="text-lg font-semibold text-pool-text">
              Register Bitcoin Address
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-pool-text mb-2">
                Your Bitcoin Address
              </label>
              <input
                type="text"
                value={btcAddress}
                onChange={(e) => setBtcAddress(e.target.value)}
                placeholder="bc1q..."
                className="input-field w-full"
                disabled={isRegistered}
              />
            </div>

            {!isRegistered ? (
              <button
                onClick={handleRegister}
                className="btn-citrea w-full"
                disabled={!btcAddress.trim()}
              >
                Register for Monitoring
              </button>
            ) : (
              <div className="flex items-center text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg p-3">
                <CheckCircle className="w-5 h-5 mr-2" />
                <span className="text-sm">Address registered successfully</span>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Send BRC20 */}
        <div className="glass-card p-6">
          <div className="flex items-center mb-4">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-3 ${
                isRegistered
                  ? "bg-citrea-500 text-white"
                  : "bg-pool-border text-pool-muted"
              }`}
            >
              2
            </div>
            <h3 className="text-lg font-semibold text-pool-text">
              Send BRC20 to Bridge
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-pool-text mb-2">
                Bridge Address
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={bridgeAddress}
                  readOnly
                  className="input-field flex-1 font-mono text-sm"
                />
                <button
                  onClick={() => copyToClipboard(bridgeAddress)}
                  className="btn-secondary p-3"
                  disabled={!isRegistered}
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button className="btn-secondary p-3" disabled={!isRegistered}>
                  <QrCode className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div
              className={`p-4 rounded-lg border ${
                isRegistered
                  ? "bg-citrea-500/10 border-citrea-500/20 text-citrea-300"
                  : "bg-pool-border/10 border-pool-border text-pool-muted"
              }`}
            >
              <p className="text-sm">
                Send PEPE or ORDI tokens to this address from your Bitcoin
                wallet
              </p>
            </div>
          </div>
        </div>

        {/* Step 3: Monitor */}
        <div className="glass-card p-6">
          <div className="flex items-center mb-4">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-3 ${
                isRegistered
                  ? "bg-citrea-500 text-white"
                  : "bg-pool-border text-pool-muted"
              }`}
            >
              3
            </div>
            <h3 className="text-lg font-semibold text-pool-text">
              Monitor Status
            </h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-pool-muted">Last checked block:</span>
              <span className="font-mono text-pool-text">4547250</span>
            </div>

            <div className="flex items-center text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-3">
              <Clock className="w-5 h-5 mr-2" />
              <span className="text-sm">Watching for transactions...</span>
            </div>

            {/* Recent transfers placeholder */}
            <div>
              <h4 className="text-sm font-medium text-pool-text mb-2">
                Recent Transfers
              </h4>
              <div className="text-center py-8 text-pool-muted">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No transfers detected yet</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Flow indicator */}
      <div className="flex items-center justify-center space-x-4 py-8">
        <div className="flex items-center space-x-2 text-pool-muted">
          <span className="font-mono text-sm">BRC20</span>
          <span className="text-orange-400">₿</span>
        </div>
        <ArrowRight className="w-6 h-6 text-citrea-500" />
        <div className="flex items-center space-x-2 text-pool-muted">
          <span className="font-mono text-sm">wBRC20</span>
          <span className="text-citrea-500">⚡</span>
        </div>
      </div>
    </div>
  );
};

export default BridgeTab;

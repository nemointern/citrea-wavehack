import React from "react";
import { Wallet, Zap, Globe, Copy, ExternalLink } from "lucide-react";

const Header: React.FC = () => {
  // Mock wallet data - we'll connect this to wagmi later
  const isConnected = true;
  const address = "0x4f0B5579136F88135572010276c2a4A884729E7b";
  const balance = "0.748";

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <header className="border-b border-pool-border bg-pool-bg/90 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-citrea-500 to-citrea-600 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-pool-text">Citrea Wave</h1>
              <p className="text-sm text-pool-muted">Dark Pool Bridge</p>
            </div>
          </div>

          {/* Network status */}
          <div className="hidden md:flex items-center space-x-6">
            {/* Citrea Network */}
            <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-pool-card border border-pool-border">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <Globe className="w-4 h-4 text-pool-muted" />
              <span className="text-sm text-pool-text">Citrea Testnet</span>
            </div>

            {/* Bitcoin Network */}
            <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-pool-card border border-pool-border">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-mono text-pool-text">₿</span>
              <span className="text-sm text-pool-text">Bitcoin Testnet</span>
            </div>
          </div>

          {/* Wallet */}
          <div className="flex items-center space-x-4">
            {isConnected ? (
              <div className="flex items-center space-x-3">
                {/* Balance */}
                <div className="text-right">
                  <p className="text-sm font-medium text-pool-text">
                    {balance} cBTC
                  </p>
                  <p className="text-xs text-pool-muted">Balance</p>
                </div>

                {/* Address */}
                <div className="flex items-center space-x-2 px-4 py-2 bg-pool-card border border-pool-border rounded-lg">
                  <Wallet className="w-4 h-4 text-citrea-500" />
                  <span className="font-mono text-sm text-pool-text">
                    {truncateAddress(address)}
                  </span>
                  <button
                    onClick={() => copyToClipboard(address)}
                    className="p-1 hover:bg-pool-border rounded transition-colors"
                  >
                    <Copy className="w-3 h-3 text-pool-muted" />
                  </button>
                  <a
                    href={`https://explorer.testnet.citrea.xyz/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-pool-border rounded transition-colors"
                  >
                    <ExternalLink className="w-3 h-3 text-pool-muted" />
                  </a>
                </div>
              </div>
            ) : (
              <button className="btn-citrea">
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

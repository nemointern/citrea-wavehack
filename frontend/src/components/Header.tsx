"use client";

import type React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance, useDisconnect } from "wagmi";
import { Wallet, ExternalLink, LogOut } from "lucide-react";

const Header: React.FC = () => {
  // Real wallet data from wagmi
  const { address, isConnected } = useAccount();
  const { data: balanceData } = useBalance({
    address,
  });
  const { disconnect } = useDisconnect();

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <header className="border-b border-pool-border bg-pool-dark/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Enhanced Logo */}
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-xl font-bold text-gradient">Nocturne</h1>
            </div>
          </div>

          {/* Enhanced Wallet Section */}
          <div className="flex items-center space-x-4">
            {isConnected && address ? (
              <div className="flex items-center space-x-4">
                {/* Balance Display */}
                <div className="glass-card px-4 py-2 text-right">
                  <p className="text-sm font-semibold text-pool-text">
                    {balanceData
                      ? `${Number.parseFloat(balanceData.formatted).toFixed(4)}`
                      : "0.0000"}
                  </p>
                  <p className="text-xs text-pool-muted">
                    {balanceData?.symbol || "cBTC"}
                  </p>
                </div>

                {/* Wallet Address */}
                <div className="glass-card px-4 py-2 flex items-center space-x-3 glow-citrea">
                  <div className="w-8 h-8 bg-citrea-gradient rounded-lg flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-mono text-sm font-semibold text-pool-text">
                      {truncateAddress(address)}
                    </p>
                    <p className="text-xs text-green-400">Connected</p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center space-x-1">
                    <a
                      href={`https://explorer.testnet.citrea.xyz/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 hover:bg-pool-border rounded-lg transition-colors"
                      title="View on explorer"
                    >
                      <ExternalLink className="w-3 h-3 text-pool-muted" />
                    </a>
                    <button
                      onClick={() => disconnect()}
                      className="p-1.5 hover:bg-pool-border rounded-lg transition-colors text-red-400"
                      title="Disconnect"
                    >
                      <LogOut className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                {/* RainbowKit Connect Button - Always visible */}
                <div className="connect-button-wrapper">
                  <ConnectButton.Custom>
                    {({
                      account,
                      chain,
                      openAccountModal,
                      openChainModal,
                      openConnectModal,
                      authenticationStatus,
                      mounted,
                    }) => {
                      const ready =
                        mounted && authenticationStatus !== "loading";
                      const connected =
                        ready &&
                        account &&
                        chain &&
                        (!authenticationStatus ||
                          authenticationStatus === "authenticated");

                      return (
                        <div
                          {...(!ready && {
                            "aria-hidden": true,
                            style: {
                              opacity: 0,
                              pointerEvents: "none",
                              userSelect: "none",
                            },
                          })}
                        >
                          {(() => {
                            if (!connected) {
                              return (
                                <button
                                  onClick={openConnectModal}
                                  type="button"
                                  className="glass-card px-6 py-3 flex items-center space-x-2 glow-citrea hover:glow-citrea-strong transition-all duration-200"
                                >
                                  <Wallet className="w-4 h-4 text-pool-text" />
                                  <span className="font-semibold text-pool-text">
                                    Connect Wallet
                                  </span>
                                </button>
                              );
                            }

                            if (chain.unsupported) {
                              return (
                                <button
                                  onClick={openChainModal}
                                  type="button"
                                  className="glass-card px-6 py-3 flex items-center space-x-2 bg-red-500/20 border-red-500/30 hover:bg-red-500/30 transition-all"
                                >
                                  <span className="text-red-400 font-semibold">
                                    Wrong network
                                  </span>
                                </button>
                              );
                            }

                            return (
                              <div style={{ display: "flex", gap: 12 }}>
                                <button
                                  onClick={openChainModal}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                  }}
                                  type="button"
                                  className="glass-card px-3 py-2 flex items-center space-x-2"
                                >
                                  {chain.hasIcon && (
                                    <div
                                      style={{
                                        background: chain.iconBackground,
                                        width: 12,
                                        height: 12,
                                        borderRadius: 999,
                                        overflow: "hidden",
                                        marginRight: 4,
                                      }}
                                    >
                                      {chain.iconUrl && (
                                        <img
                                          alt={chain.name ?? "Chain icon"}
                                          src={
                                            chain.iconUrl || "/placeholder.svg"
                                          }
                                          style={{ width: 12, height: 12 }}
                                        />
                                      )}
                                    </div>
                                  )}
                                  <span className="text-sm text-pool-text">
                                    {chain.name}
                                  </span>
                                </button>

                                <button
                                  onClick={openAccountModal}
                                  type="button"
                                  className="glass-card px-4 py-2 flex items-center space-x-2 glow-citrea"
                                >
                                  <span className="font-mono text-sm text-pool-text">
                                    {account.displayName}
                                  </span>
                                  <span className="text-xs text-pool-muted">
                                    {account.displayBalance
                                      ? ` (${account.displayBalance})`
                                      : ""}
                                  </span>
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    }}
                  </ConnectButton.Custom>
                </div>

                {/* Fallback: Standard RainbowKit button if custom doesn't work */}
                <div className="hidden">
                  <ConnectButton />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

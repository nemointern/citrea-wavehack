"use client";

import type React from "react";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useBlockNumber } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { Monitor, Wallet, GitBranch, Shield, BarChart3 } from "lucide-react";
import { config } from "./config/wagmi";

// Import RainbowKit styles
import "@rainbow-me/rainbowkit/styles.css";

// Import components
import Header from "./components/Header";
import BridgeTab from "./components/tabs/BridgeTab";
import TradeTab from "./components/tabs/TradeTab";
import PortfolioTab from "./components/tabs/PortfolioTab";
import MonitorTab from "./components/tabs/MonitorTab";
import DarkPoolDashboard from "./components/tabs/DarkPoolDashboard";

// Create query client
const queryClient = new QueryClient();

type TabId = "bridge" | "trade" | "analytics" | "portfolio" | "monitor";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
  description: string;
}

const tabs: Tab[] = [
  {
    id: "bridge",
    label: "Bridge",
    icon: GitBranch,
    component: BridgeTab,
    description: "Cross-chain asset transfer",
  },
  {
    id: "trade",
    label: "Dark Pool",
    icon: Shield,
    component: TradeTab,
    description: "MEV-protected trading",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    component: DarkPoolDashboard,
    description: "Advanced trading analytics",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    icon: Wallet,
    component: PortfolioTab,
    description: "Asset management",
  },
  {
    id: "monitor",
    label: "Monitor",
    icon: Monitor,
    component: MonitorTab,
    description: "Network status",
  },
];

function App() {
  const [activeTab, setActiveTab] = useState<TabId>("bridge");
  const { data: blockNumber } = useBlockNumber();
  const ActiveComponent =
    tabs.find((tab) => tab.id === activeTab)?.component || BridgeTab;

  return (
    <div className="min-h-screen bg-pool-bg">
      {/* Enhanced Background */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-pool-bg via-pool-dark to-pool-bg" />

        {/* Animated glow effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-citrea-500/5 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-citrea-secondary/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(239, 143, 54, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(239, 143, 54, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10">
        {/* Header */}
        <Header />

        {/* Hero Section */}
        <div className="container mx-auto px-6 py-12 max-w-7xl">
          <div className="text-center mb-12 animate-fade-in">
            {/* Main Title */}
            <h1 className="text-5xl font-extrabold text-gradient mb-4">
              Citrea Dark Pool
            </h1>
            <p className="text-xl text-pool-muted mb-2 font-medium">
              BRC20 Bridge + MEV-Protected Trading
            </p>
          </div>

          {/* Enhanced Tab Navigation */}
          <div className="flex justify-center mb-12">
            <div className="dark-pool-card p-2 inline-flex space-x-1 rounded-2xl">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      group relative flex flex-col items-center space-y-1 px-6 py-4 rounded-xl font-medium transition-all duration-300
                      ${
                        isActive
                          ? "bg-citrea-gradient text-white shadow-lg"
                          : "text-pool-muted hover:text-pool-text hover:bg-pool-border/50"
                      }
                    `}
                  >
                    <Icon
                      className={`w-5 h-5 ${
                        isActive
                          ? "animate-pulse"
                          : "group-hover:scale-110 transition-transform"
                      }`}
                    />
                    <span className="text-sm font-semibold">{tab.label}</span>
                    <span
                      className={`text-xs transition-opacity ${
                        isActive ? "opacity-80" : "opacity-60"
                      }`}
                    >
                      {tab.description}
                    </span>

                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab content with enhanced animation */}
          <div className="animate-slide-up">
            <ActiveComponent />
          </div>
        </div>

        {/* Enhanced Footer */}
        <footer className="border-t border-pool-border mt-20 py-12 bg-pool-dark/50">
          <div className="container mx-auto px-8">
            {/* Bottom bar */}
            <div className="border-t border-pool-border pt-8 flex items-center justify-between">
              <p className="text-sm text-pool-dim">
                Built for Citrea Wave Hackathon
              </p>
              <div className="flex items-center space-x-4 text-pool-dim">
                <span className="text-xs">Chain ID: 5115</span>
                <span className="text-xs">•</span>
                <span className="text-xs">Block Number: {blockNumber}</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// Main export with enhanced providers
export default function AppWithProviders() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#EF8F36",
            accentColorForeground: "white",
            borderRadius: "medium",
            fontStack: "system",
          })}
        >
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

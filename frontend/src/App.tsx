import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Monitor,
  Wallet,
  GitBranch,
  Globe,
} from "lucide-react";

// Import components (we'll create these)
import Header from "./components/Header";
import BridgeTab from "./components/tabs/BridgeTab";
import TradeTab from "./components/tabs/TradeTab";
import PortfolioTab from "./components/tabs/PortfolioTab";
import MonitorTab from "./components/tabs/MonitorTab";

// Create query client
const queryClient = new QueryClient();

type TabId = "bridge" | "trade" | "portfolio" | "monitor";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
}

const tabs: Tab[] = [
  {
    id: "bridge",
    label: "Bridge",
    icon: GitBranch,
    component: BridgeTab,
  },
  {
    id: "trade",
    label: "Dark Pool",
    icon: BarChart3,
    component: TradeTab,
  },
  {
    id: "portfolio",
    label: "Portfolio",
    icon: Wallet,
    component: PortfolioTab,
  },
  {
    id: "monitor",
    label: "Monitor",
    icon: Monitor,
    component: MonitorTab,
  },
];

function App() {
  const [activeTab, setActiveTab] = useState<TabId>("bridge");

  const ActiveComponent =
    tabs.find((tab) => tab.id === activeTab)?.component || BridgeTab;

  return (
    <div className="min-h-screen bg-pool-bg">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-pool-bg via-pool-bg to-citrea-900/5 pointer-events-none" />

      {/* Main content */}
      <div className="relative z-10">
        {/* Header */}
        <Header />

        {/* Main container */}
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          {/* App title */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gradient mb-2">
              Citrea Wave Bridge
            </h1>
            <p className="text-pool-muted text-lg">
              BRC20 → Citrea Bridge + Private Dark Pool Trading
            </p>
          </div>

          {/* Tab navigation */}
          <div className="flex justify-center mb-8">
            <div className="glass-card p-2 inline-flex space-x-2 rounded-xl">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all duration-200
                      ${
                        isActive
                          ? "bg-citrea-500 text-white shadow-lg shadow-citrea-500/25"
                          : "text-pool-muted hover:text-pool-text hover:bg-pool-border"
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab content */}
          <div className="animate-fade-in">
            <ActiveComponent />
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-pool-border mt-16 py-8">
          <div className="container mx-auto px-6 text-center">
            <div className="flex items-center justify-center space-x-6 text-pool-muted">
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4" />
                <span>Citrea Testnet</span>
              </div>
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span>Bitcoin Testnet</span>
              </div>
            </div>
            <p className="text-pool-muted text-sm mt-4">
              Built for Citrea Wave Hackathon • MEV-Protected Dark Pool Trading
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

// Main export with providers
export default function AppWithProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

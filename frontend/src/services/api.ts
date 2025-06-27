// API service for backend communication
const API_BASE_URL = "http://localhost:3001/api";

// Types
export interface BTCMonitorStatus {
  isRunning: boolean;
  currentBlock: number;
  lastProcessedBlock: number;
  monitoredAddresses: string[];
  lastUpdate: string;
  pendingTransfers?: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  services: {
    btcMonitor: BTCMonitorStatus;
    matchingEngine: {
      totalPairs: number;
      totalOrders?: number;
      totalMatches?: number;
    };
    citrea: {
      chainId: number;
      gasPrice?: string;
      blockTime?: string;
    } | null;
  };
}

export interface TokenInfo {
  ticker: string;
  tokenAddress: string;
}

export interface WalletBalance {
  address: string;
  token: string;
  balance: string;
  message?: string;
}

export interface CurrentBatch {
  batchId: number;
  phase: "COMMIT" | "REVEAL" | "EXECUTE" | "commit" | "reveal" | "execute";
  timeRemaining: number;
  ordersCommitted?: number;
  totalOrders?: number;
  startTime?: number;
  endTime?: number;
  orderIds?: string[];
  processed?: boolean;
  message?: string;
}

export interface MatchingStats {
  totalPairs: number;
  totalOrders: number;
  totalMatches: number;
  averageMatchingTime?: number;
  lastBatchId?: number;
}

// API functions
export const apiService = {
  // Health and monitoring
  async getHealth(): Promise<HealthResponse> {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) throw new Error("Failed to fetch health status");
    return response.json();
  },

  async getBTCMonitorStatus(): Promise<BTCMonitorStatus> {
    const response = await fetch(`${API_BASE_URL}/btc/monitor/status`);
    if (!response.ok) throw new Error("Failed to fetch BTC monitor status");
    return response.json();
  },

  // Bridge operations
  async getTokenInfo(ticker: string): Promise<TokenInfo> {
    const response = await fetch(`${API_BASE_URL}/bridge/token/${ticker}`);
    if (!response.ok)
      throw new Error(`Failed to fetch token info for ${ticker}`);
    return response.json();
  },

  async registerAddress(
    address: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/btc/monitor/address`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    if (!response.ok) throw new Error("Failed to register address");
    return response.json();
  },

  // Dark pool operations
  async getCurrentBatch(): Promise<CurrentBatch> {
    const response = await fetch(`${API_BASE_URL}/darkpool/batch/current`);
    if (!response.ok) throw new Error("Failed to fetch current batch");
    return response.json();
  },

  async getMatchingStats(): Promise<MatchingStats> {
    const response = await fetch(`${API_BASE_URL}/darkpool/matching/stats`);
    if (!response.ok) throw new Error("Failed to fetch matching stats");
    return response.json();
  },

  // Order management
  async submitOrder(order: {
    tokenA: string;
    tokenB: string;
    amount: string;
    price: string;
    orderType: "BUY" | "SELL";
    userAddress?: string;
  }): Promise<{
    orderId: number;
    batchId: number;
    commitHash: string;
    salt: string;
    success: boolean;
    message: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/darkpool/order/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.message || `Failed to submit order: ${response.statusText}`
      );
    }

    return response.json();
  },

  async getUserOrders(userAddress: string): Promise<{
    orders: Array<{
      orderId: number;
      batchId: number;
      tokenA: string;
      tokenB: string;
      amount: string;
      price: string;
      orderType: "BUY" | "SELL";
      status: "COMMITTED" | "REVEALED" | "MATCHED" | "FAILED";
      commitHash?: string;
      timestamp: number;
      trader: string;
    }>;
    count: number;
  }> {
    const response = await fetch(
      `${API_BASE_URL}/darkpool/orders/user/${userAddress}`
    );
    if (!response.ok) throw new Error("Failed to fetch user orders");
    return response.json();
  },

  async revealOrder(revealData: {
    orderId: number;
    salt: string;
    amount: string;
    price: string;
  }): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/darkpool/order/reveal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(revealData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.message || `Failed to reveal order: ${response.statusText}`
      );
    }

    return response.json();
  },

  async cancelOrder(
    orderId: number
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/darkpool/order/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.message || `Failed to cancel order: ${response.statusText}`
      );
    }

    return response.json();
  },

  // Wallet operations
  async getTokenBalance(
    address: string,
    token: string
  ): Promise<WalletBalance> {
    const response = await fetch(
      `${API_BASE_URL}/wallet/${address}/balance/${token}`
    );
    if (!response.ok) throw new Error(`Failed to fetch ${token} balance`);
    return response.json();
  },

  // Test contracts
  async testContracts(): Promise<{
    success: boolean;
    results: Record<string, unknown>;
    timestamp: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/test/contracts`);
    if (!response.ok) throw new Error("Failed to test contracts");
    return response.json();
  },
};

import { EventEmitter } from "events";
import { CitreaService } from "./citreaService.js";
import { parseUnits } from "viem";

interface MockBridgeRequest {
  id: string;
  userId: string;
  fromAddress: string; // Bitcoin address (simulated)
  toAddress: string; // Citrea address
  ticker: string;
  amount: string;
  status: "pending" | "deposited" | "minting" | "completed" | "failed";
  txHash?: string; // Simulated Bitcoin transaction hash
  citreaTxHash?: string; // Citrea transaction hash
  createdAt: number;
  updatedAt: number;
  error?: string;
  depositDetectedAt?: number;
  mockData?: {
    shouldAutoDeposit: boolean;
    depositDelay: number; // ms
    shouldFail: boolean;
  };
}

interface MockBridgeStats {
  totalRequests: number;
  completed: number;
  pending: number;
  failed: number;
  totalVolume: Record<string, string>; // ticker -> total amount
}

/**
 * Mock Bridge Service - Simulates bridge functionality without external APIs
 * This allows testing the bridge UI and flow without needing real BTC/BRC20 APIs
 */
export class MockBridgeService extends EventEmitter {
  private citreaService: CitreaService;
  private bridgeRequests: Map<string, MockBridgeRequest>;
  private processing: boolean;
  private processInterval: NodeJS.Timeout | null;
  private depositAddresses: Map<
    string,
    { userId: string; ticker: string; citreaAddress: string }
  >;

  // Mock data for testing
  private mockTokenPrices: Record<string, number> = {
    CTRA: 0.1,
    PEPE: 0.000001,
    ORDI: 45.0,
  };

  // Tokens that are likely supported on the real smart contract
  private supportedTokensForRealMinting: Set<string> = new Set(["CTRA"]);

  constructor(citreaService: CitreaService) {
    super();
    this.citreaService = citreaService;
    this.bridgeRequests = new Map();
    this.processing = false;
    this.processInterval = null;
    this.depositAddresses = new Map();
  }

  /**
   * Generate a mock Bitcoin address for testing
   */
  private generateMockBitcoinAddress(): string {
    // Generate a testnet-style address for demo purposes
    const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let result = "tb1q";
    for (let i = 0; i < 38; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate a mock Bitcoin transaction hash
   */
  private generateMockTxHash(): string {
    const chars = "0123456789abcdef";
    let result = "";
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Create a new mock bridge request
   */
  async createBridgeRequest(
    userId: string,
    ticker: string,
    toAddress: string,
    options: {
      autoDeposit?: boolean;
      depositDelay?: number;
      shouldFail?: boolean;
    } = {}
  ): Promise<{
    bridgeRequestId: string;
    depositAddress: string;
    instructions: string;
  }> {
    try {
      // Generate unique bridge request ID
      const bridgeRequestId = `mock_bridge_${userId.slice(
        -6
      )}_${ticker}_${Date.now()}`;

      // Generate mock deposit address
      const depositAddress = this.generateMockBitcoinAddress();

      // Store address mapping
      this.depositAddresses.set(depositAddress, {
        userId,
        ticker: ticker.toUpperCase(),
        citreaAddress: toAddress,
      });

      // Create bridge request record
      const bridgeRequest: MockBridgeRequest = {
        id: bridgeRequestId,
        userId,
        fromAddress: depositAddress,
        toAddress,
        ticker: ticker.toUpperCase(),
        amount: "0", // Will be filled when deposit is detected
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mockData: {
          shouldAutoDeposit: options.autoDeposit ?? true,
          depositDelay: options.depositDelay ?? 30000, // 30 seconds default
          shouldFail: options.shouldFail ?? false,
        },
      };

      this.bridgeRequests.set(bridgeRequestId, bridgeRequest);

      console.log(
        `🌉 [MOCK] Created bridge request ${bridgeRequestId}: ${ticker} -> ${toAddress}`
      );

      // Auto-simulate deposit if enabled
      if (bridgeRequest.mockData?.shouldAutoDeposit) {
        setTimeout(() => {
          this.simulateDeposit(bridgeRequestId);
        }, bridgeRequest.mockData.depositDelay);
      }

      return {
        bridgeRequestId,
        depositAddress,
        instructions: `[DEMO MODE] Send your ${ticker} BRC20 tokens to: ${depositAddress}
                      This is a simulated deposit address for testing.
                      A mock deposit will be automatically detected in ${Math.round(
                        (bridgeRequest.mockData?.depositDelay || 30000) / 1000
                      )} seconds.
                      Tokens will be automatically bridged to Citrea as w${ticker}.`,
      };
    } catch (error) {
      console.error("❌ [MOCK] Error creating bridge request:", error);
      throw error;
    }
  }

  /**
   * Simulate a deposit being detected
   */
  private async simulateDeposit(bridgeRequestId: string) {
    const request = this.bridgeRequests.get(bridgeRequestId);
    if (!request || request.status !== "pending") {
      return;
    }

    console.log(
      `💰 [MOCK] Simulating deposit for bridge request ${bridgeRequestId}`
    );

    // Generate mock deposit amount (random between 1-100 tokens)
    const mockAmount = (Math.random() * 99 + 1).toFixed(8);
    const mockTxHash = this.generateMockTxHash();

    // Update request with deposit info
    const updatedRequest: MockBridgeRequest = {
      ...request,
      amount: mockAmount,
      status: "deposited",
      txHash: mockTxHash,
      updatedAt: Date.now(),
      depositDetectedAt: Date.now(),
    };

    this.bridgeRequests.set(bridgeRequestId, updatedRequest);

    console.log(
      `✅ [MOCK] Deposit detected: ${mockAmount} ${
        request.ticker
      } (tx: ${mockTxHash.slice(0, 8)}...)`
    );

    // Emit deposit event
    this.emit("deposit-detected", {
      bridgeRequestId,
      ticker: request.ticker,
      amount: mockAmount,
      txHash: mockTxHash,
      fromAddress: request.fromAddress,
      toAddress: request.toAddress,
    });

    // Start minting process after a short delay
    setTimeout(() => {
      this.processMinting(bridgeRequestId);
    }, 5000); // 5 second delay for minting
  }

  /**
   * Process minting for a bridge request
   */
  private async processMinting(bridgeRequestId: string) {
    const request = this.bridgeRequests.get(bridgeRequestId);
    if (!request || request.status !== "deposited") {
      return;
    }

    console.log(`⚡ [MOCK] Starting minting process for ${bridgeRequestId}`);

    // Update status to minting
    const updatedRequest: MockBridgeRequest = {
      ...request,
      status: "minting",
      updatedAt: Date.now(),
    };
    this.bridgeRequests.set(bridgeRequestId, updatedRequest);

    try {
      // Check if we should simulate failure
      if (request.mockData?.shouldFail) {
        throw new Error("Simulated minting failure for testing");
      }

      // Simulate minting delay
      await new Promise((resolve) => setTimeout(resolve, 8000)); // 8 second minting

      // Try to mint tokens on Citrea (this is real if citreaService is available)
      let citreaTxHash: string | undefined;
      const shouldAttemptRealMinting = this.supportedTokensForRealMinting.has(
        request.ticker
      );

      try {
        if (this.citreaService && shouldAttemptRealMinting) {
          // Only attempt real minting for supported tokens
          const btcTxHash = request.txHash || this.generateMockTxHash();
          citreaTxHash = await this.citreaService.processBridgeMint(
            request.toAddress as any, // Address type
            request.ticker,
            request.amount,
            btcTxHash
          );
          console.log(`🎯 [MOCK] Real minting completed: ${citreaTxHash}`);
        } else {
          // Generate mock Citrea tx hash for unsupported tokens or when no citrea service
          citreaTxHash = `0x${this.generateMockTxHash()}`;
          const reason = !this.citreaService
            ? "No Citrea service available"
            : `Token ${request.ticker} not in supported list for real minting`;
          console.log(
            `🎯 [MOCK] Simulated minting completed: ${citreaTxHash} (${reason})`
          );
        }
      } catch (mintError) {
        console.error(
          `❌ [MOCK] Real minting failed for ${request.ticker}:`,
          mintError
        );
        // Fall back to mock tx hash for demo
        citreaTxHash = `0x${this.generateMockTxHash()}`;
        console.log(`🎯 [MOCK] Using fallback mock tx hash: ${citreaTxHash}`);
      }

      // Update request as completed
      const completedRequest: MockBridgeRequest = {
        ...request,
        status: "completed",
        citreaTxHash,
        updatedAt: Date.now(),
      };
      this.bridgeRequests.set(bridgeRequestId, completedRequest);

      console.log(
        `✅ [MOCK] Bridge completed: ${request.amount} w${request.ticker} minted to ${request.toAddress}`
      );

      // Emit completion event
      this.emit("bridge-completed", {
        bridgeRequestId,
        ticker: request.ticker,
        amount: request.amount,
        toAddress: request.toAddress,
        citreaTxHash,
      });
    } catch (error) {
      console.error(`❌ [MOCK] Minting failed for ${bridgeRequestId}:`, error);

      const failedRequest: MockBridgeRequest = {
        ...request,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown minting error",
        updatedAt: Date.now(),
      };
      this.bridgeRequests.set(bridgeRequestId, failedRequest);

      this.emit("bridge-failed", {
        bridgeRequestId,
        error: failedRequest.error,
      });
    }
  }

  /**
   * Get bridge request by ID
   */
  getBridgeRequest(id: string): MockBridgeRequest | undefined {
    return this.bridgeRequests.get(id);
  }

  /**
   * Get all bridge requests for a user
   */
  getUserBridgeRequests(userId: string): MockBridgeRequest[] {
    return Array.from(this.bridgeRequests.values())
      .filter((request) => request.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get bridge statistics (compatible with real bridge service)
   */
  getBridgeStats(): MockBridgeStats {
    return this.getStats();
  }

  /**
   * Get bridge statistics
   */
  getStats(): MockBridgeStats {
    const requests = Array.from(this.bridgeRequests.values());
    const stats: MockBridgeStats = {
      totalRequests: requests.length,
      completed: requests.filter((r) => r.status === "completed").length,
      pending: requests.filter((r) =>
        ["pending", "deposited", "minting"].includes(r.status)
      ).length,
      failed: requests.filter((r) => r.status === "failed").length,
      totalVolume: {},
    };

    // Calculate volume by ticker
    requests.forEach((request) => {
      if (request.status === "completed" && request.amount !== "0") {
        if (!stats.totalVolume[request.ticker]) {
          stats.totalVolume[request.ticker] = "0";
        }
        const currentVolume = parseFloat(stats.totalVolume[request.ticker]);
        const requestAmount = parseFloat(request.amount);
        stats.totalVolume[request.ticker] = (
          currentVolume + requestAmount
        ).toString();
      }
    });

    return stats;
  }

  /**
   * Get processing status
   */
  getProcessingStatus() {
    return {
      isProcessing: this.processing,
      totalRequests: this.bridgeRequests.size,
      supportedTokensForRealMinting: Array.from(
        this.supportedTokensForRealMinting
      ),
      recentActivity: Array.from(this.bridgeRequests.values())
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 5)
        .map((request) => ({
          id: request.id,
          status: request.status,
          ticker: request.ticker,
          amount: request.amount,
          updatedAt: request.updatedAt,
          usedRealMinting: this.supportedTokensForRealMinting.has(
            request.ticker
          ),
        })),
    };
  }

  /**
   * Start processing (for compatibility with real bridge service)
   */
  start() {
    if (this.processing) return;

    this.processing = true;
    console.log("🌉 [MOCK] Mock Bridge Service started");

    // Optional: Set up periodic processing for demo purposes
    this.processInterval = setInterval(() => {
      const pendingRequests = Array.from(this.bridgeRequests.values()).filter(
        (r) => r.status === "pending" && !r.mockData?.shouldAutoDeposit
      );

      if (pendingRequests.length > 0) {
        console.log(
          `🌉 [MOCK] ${pendingRequests.length} pending bridge requests`
        );
      }
    }, 30000);
  }

  /**
   * Stop processing
   */
  stop() {
    if (!this.processing) return;

    this.processing = false;
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
    console.log("🌉 [MOCK] Mock Bridge Service stopped");
  }

  /**
   * Configure which tokens should attempt real smart contract minting
   * Other tokens will use pure mock minting
   */
  setSupportedTokensForRealMinting(tokens: string[]) {
    this.supportedTokensForRealMinting = new Set(
      tokens.map((t) => t.toUpperCase())
    );
    console.log(
      `🌉 [MOCK] Configured real minting for tokens: ${Array.from(
        this.supportedTokensForRealMinting
      ).join(", ")}`
    );
  }

  /**
   * Get tokens that will attempt real minting
   */
  getSupportedTokensForRealMinting(): string[] {
    return Array.from(this.supportedTokensForRealMinting);
  }

  /**
   * Manual trigger for testing - simulate deposit for any pending request
   */
  triggerMockDeposit(bridgeRequestId: string, amount?: string) {
    const request = this.bridgeRequests.get(bridgeRequestId);
    if (!request || request.status !== "pending") {
      throw new Error("Request not found or not in pending status");
    }

    // Override amount if provided
    if (amount) {
      request.amount = amount;
    }

    this.simulateDeposit(bridgeRequestId);
    return { success: true, message: "Mock deposit triggered" };
  }
}

export default MockBridgeService;

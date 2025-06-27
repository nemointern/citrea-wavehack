import { EventEmitter } from "events";
import BRC20Service from "./brc20Service.js";
import { CitreaService } from "./citreaService.js";
import { parseUnits } from "viem";

interface BridgeRequest {
  id: string;
  userId: string;
  fromAddress: string; // Bitcoin address
  toAddress: string; // Citrea address
  ticker: string;
  amount: string;
  status: "pending" | "deposited" | "minting" | "completed" | "failed";
  txHash?: string; // Bitcoin transaction hash
  citreaTxHash?: string; // Citrea transaction hash
  createdAt: number;
  updatedAt: number;
  error?: string;
}

interface BridgeStats {
  totalRequests: number;
  completed: number;
  pending: number;
  failed: number;
  totalVolume: Record<string, string>; // ticker -> total amount
}

export class BridgeService extends EventEmitter {
  private brc20Service: BRC20Service;
  private citreaService: CitreaService;
  private bridgeRequests: Map<string, BridgeRequest>;
  private processing: boolean;
  private processInterval: number;

  constructor(brc20Service: BRC20Service, citreaService: CitreaService) {
    super();
    this.brc20Service = brc20Service;
    this.citreaService = citreaService;
    this.bridgeRequests = new Map();
    this.processing = false;
    this.processInterval = 30000; // Check every 30 seconds
  }

  /**
   * Create a new bridge request
   */
  async createBridgeRequest(
    userId: string,
    ticker: string,
    toAddress: string
  ): Promise<{
    bridgeRequestId: string;
    depositAddress: string;
    instructions: string;
  }> {
    try {
      // Generate unique bridge request ID
      const bridgeRequestId = `bridge_${userId}_${ticker}_${Date.now()}`;

      // Create deposit address using BRC20 service
      const depositInfo = this.brc20Service.createDepositAddress(
        userId,
        ticker,
        toAddress
      );

      // Create bridge request record
      const bridgeRequest: BridgeRequest = {
        id: bridgeRequestId,
        userId,
        fromAddress: depositInfo.address,
        toAddress,
        ticker: ticker.toUpperCase(),
        amount: "0", // Will be filled when deposit is detected
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.bridgeRequests.set(bridgeRequestId, bridgeRequest);

      console.log(
        `🌉 Created bridge request ${bridgeRequestId}: ${ticker} -> ${toAddress}`
      );

      return {
        bridgeRequestId,
        depositAddress: depositInfo.address,
        instructions: `Send your ${ticker} BRC20 tokens to: ${
          depositInfo.address
        }. 
                      Reference ID: ${
                        (depositInfo as any).reference || bridgeRequestId
                      }.
                      Tokens will be automatically bridged to Citrea as w${ticker}.`,
      };
    } catch (error) {
      console.error("❌ Error creating bridge request:", error);
      throw error;
    }
  }

  /**
   * Start processing bridge requests
   */
  async startProcessing(): Promise<void> {
    if (this.processing) {
      console.log("⚠️ Bridge processing already started");
      return;
    }

    console.log("🌉 Starting bridge processing service...");
    this.processing = true;
    this.processBridgeRequests();
  }

  /**
   * Stop processing bridge requests
   */
  stopProcessing(): void {
    this.processing = false;
    console.log("🛑 Bridge processing stopped");
  }

  /**
   * Main processing loop
   */
  private async processBridgeRequests(): Promise<void> {
    while (this.processing) {
      try {
        await this.checkForNewDeposits();
        await this.processPendingMints();
        await this.sleep(this.processInterval);
      } catch (error) {
        console.error("❌ Error in bridge processing:", error);
        await this.sleep(this.processInterval);
      }
    }
  }

  /**
   * Check for new BRC20 deposits
   */
  private async checkForNewDeposits(): Promise<void> {
    try {
      console.log("🔍 Checking for new BRC20 deposits...");

      // Get new deposits from BRC20 service
      const newDeposits = await this.brc20Service.checkForNewDeposits();

      for (const deposit of newDeposits) {
        await this.processNewDeposit(deposit);
      }
    } catch (error) {
      console.error("❌ Error checking for deposits:", error);
    }
  }

  /**
   * Process a new deposit
   */
  private async processNewDeposit(deposit: any): Promise<void> {
    try {
      console.log(
        `💰 Processing new deposit: ${deposit.amount} ${deposit.ticker}`
      );

      // Process deposit to find matching user
      const depositInfo = await this.brc20Service.processDeposit(deposit);

      if (!depositInfo || !depositInfo.shouldMint) {
        console.log("⚠️ Deposit does not match any pending bridge request");
        return;
      }

      // Find matching bridge request
      const bridgeRequest = Array.from(this.bridgeRequests.values()).find(
        (req) =>
          req.toAddress === depositInfo.citreaAddress &&
          req.ticker === deposit.ticker &&
          req.status === "pending"
      );

      if (!bridgeRequest) {
        console.log("⚠️ No matching bridge request found");
        return;
      }

      // Update bridge request with deposit info
      bridgeRequest.amount = deposit.amount;
      bridgeRequest.txHash = deposit.txid;
      bridgeRequest.status = "deposited";
      bridgeRequest.updatedAt = Date.now();

      this.bridgeRequests.set(bridgeRequest.id, bridgeRequest);

      console.log(
        `✅ Updated bridge request ${bridgeRequest.id} with deposit info`
      );

      // Emit event for deposit detected
      this.emit("depositDetected", {
        bridgeRequestId: bridgeRequest.id,
        deposit,
      });
    } catch (error) {
      console.error("❌ Error processing new deposit:", error);
    }
  }

  /**
   * Process pending mints (convert deposited to minting to completed)
   */
  private async processPendingMints(): Promise<void> {
    try {
      // Get all requests that are deposited but not yet minting
      const pendingMints = Array.from(this.bridgeRequests.values()).filter(
        (req) => req.status === "deposited"
      );

      for (const request of pendingMints) {
        await this.mintWrappedTokens(request);
      }
    } catch (error) {
      console.error("❌ Error processing pending mints:", error);
    }
  }

  /**
   * Mint wrapped tokens on Citrea
   */
  private async mintWrappedTokens(request: BridgeRequest): Promise<void> {
    try {
      console.log(
        `🏭 Minting ${request.amount} w${request.ticker} for ${request.toAddress}`
      );

      // Update status to minting
      request.status = "minting";
      request.updatedAt = Date.now();
      this.bridgeRequests.set(request.id, request);

      // Get token contract address
      const tokenAddress = await this.citreaService.getWrappedTokenAddress(
        request.ticker
      );
      if (!tokenAddress) {
        throw new Error(`Token w${request.ticker} not found in bridge`);
      }

      // Convert amount to proper decimals (assuming 18 decimals for BRC20)
      const amountToMint = parseUnits(request.amount, 18);

      // Mint tokens (this would call the bridge contract)
      // For now, we'll simulate the minting process
      console.log(
        `💰 Simulating mint of ${amountToMint} w${request.ticker} to ${request.toAddress}`
      );

      // In a real implementation, you would:
      // 1. Call bridge.processDeposit() or similar function
      // 2. Sign the transaction with the bridge operator key
      // 3. Wait for transaction confirmation

      // For demo, we'll mark as completed immediately
      request.status = "completed";
      request.citreaTxHash = `0x${Math.random().toString(16).substring(2, 66)}`; // Mock tx hash
      request.updatedAt = Date.now();
      this.bridgeRequests.set(request.id, request);

      console.log(
        `✅ Successfully minted w${request.ticker} for bridge request ${request.id}`
      );

      // Emit completion event
      this.emit("bridgeCompleted", {
        bridgeRequestId: request.id,
        amount: request.amount,
        ticker: request.ticker,
        citreaTxHash: request.citreaTxHash,
      });
    } catch (error) {
      console.error(
        `❌ Error minting tokens for request ${request.id}:`,
        error
      );

      // Mark request as failed
      request.status = "failed";
      request.error = error.message;
      request.updatedAt = Date.now();
      this.bridgeRequests.set(request.id, request);

      this.emit("bridgeFailed", {
        bridgeRequestId: request.id,
        error: error.message,
      });
    }
  }

  /**
   * Get bridge request by ID
   */
  getBridgeRequest(id: string): BridgeRequest | null {
    return this.bridgeRequests.get(id) || null;
  }

  /**
   * Get all bridge requests for a user
   */
  getUserBridgeRequests(userId: string): BridgeRequest[] {
    return Array.from(this.bridgeRequests.values())
      .filter((req) => req.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get bridge statistics
   */
  getBridgeStats(): BridgeStats {
    const requests = Array.from(this.bridgeRequests.values());

    const stats: BridgeStats = {
      totalRequests: requests.length,
      completed: requests.filter((r) => r.status === "completed").length,
      pending: requests.filter((r) =>
        ["pending", "deposited", "minting"].includes(r.status)
      ).length,
      failed: requests.filter((r) => r.status === "failed").length,
      totalVolume: {},
    };

    // Calculate total volume per token
    requests
      .filter((r) => r.status === "completed")
      .forEach((r) => {
        if (!stats.totalVolume[r.ticker]) {
          stats.totalVolume[r.ticker] = "0";
        }
        stats.totalVolume[r.ticker] = (
          parseFloat(stats.totalVolume[r.ticker]) + parseFloat(r.amount)
        ).toString();
      });

    return stats;
  }

  /**
   * Get processing status
   */
  getProcessingStatus(): {
    isProcessing: boolean;
    lastUpdate: string;
    pendingRequests: number;
    recentActivity: any[];
  } {
    const pending = Array.from(this.bridgeRequests.values()).filter((r) =>
      ["pending", "deposited", "minting"].includes(r.status)
    );

    const recent = Array.from(this.bridgeRequests.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        ticker: r.ticker,
        amount: r.amount,
        status: r.status,
        updatedAt: new Date(r.updatedAt).toISOString(),
      }));

    return {
      isProcessing: this.processing,
      lastUpdate: new Date().toISOString(),
      pendingRequests: pending.length,
      recentActivity: recent,
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default BridgeService;

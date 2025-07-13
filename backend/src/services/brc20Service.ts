import axios from "axios";

interface BRC20Transfer {
  txid: string;
  blockHeight: number;
  from: string;
  to: string;
  ticker: string;
  amount: string;
  timestamp: number;
  inscriptionId: string;
}

interface BRC20TokenInfo {
  ticker: string;
  totalSupply: string;
  decimals: string;
  deployBy: string;
  deployTime: number;
  holders: number;
}

interface DepositAddress {
  address: string;
  userId: string;
  ticker: string;
  citreaAddress: string;
  createdAt: number;
}

export class BRC20Service {
  private apiUrl: string;
  private apiKey: string;
  private hotWalletAddress: string;
  private depositAddresses: Map<string, DepositAddress>;
  private processedTransfers: Set<string>;
  private lastApiCall: number;
  private rateLimitDelay: number;
  private consecutiveErrors: number;

  constructor() {
    this.apiUrl = process.env.BRC20_API_URL || "https://api.unisat.io"; // Main BRC20 API
    this.apiKey = process.env.BRC20_API_KEY || "";
    this.hotWalletAddress =
      process.env.BTC_HOT_WALLET ||
      "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";
    this.depositAddresses = new Map();
    this.processedTransfers = new Set();
    this.lastApiCall = 0;
    this.rateLimitDelay = 3000; // 3 seconds between API calls
    this.consecutiveErrors = 0;
  }

  /**
   * Wait for rate limit delay
   */
  private async waitForRateLimit(): Promise<void> {
    const timeSinceLastCall = Date.now() - this.lastApiCall;
    if (timeSinceLastCall < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastCall;
      await this.sleep(waitTime);
    }
    this.lastApiCall = Date.now();
  }

  /**
   * Make API request with rate limiting and error handling
   */
  private async makeApiRequest(url: string, description: string): Promise<any> {
    await this.waitForRateLimit();

    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      });

      // Reset error count on successful request
      this.consecutiveErrors = 0;
      return response;
    } catch (error: any) {
      this.consecutiveErrors++;

      if (error.response?.status === 429) {
        const backoffTime = Math.min(60000 * this.consecutiveErrors, 300000); // Max 5 minutes
        console.error(
          `⚠️ BRC20 API rate limited (429). Backing off for ${
            backoffTime / 1000
          }s...`
        );
        await this.sleep(backoffTime);
        this.rateLimitDelay = Math.min(this.rateLimitDelay * 2, 15000); // Increase delay up to 15s
        throw error;
      }

      if (error.response?.status === 403) {
        console.error(
          `⚠️ BRC20 API forbidden (403) for ${description}. Skipping...`
        );
        throw error;
      }

      throw error;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create deposit address for user
   */
  createDepositAddress(
    userId: string,
    ticker: string,
    citreaAddress: string
  ): DepositAddress {
    // For demo purposes, we use the same hot wallet address
    // In production, you'd generate unique addresses per user
    const depositAddr: DepositAddress = {
      address: this.hotWalletAddress,
      userId,
      ticker,
      citreaAddress,
      createdAt: Date.now(),
    };

    this.depositAddresses.set(
      `${userId}-${ticker}`,
      depositAddr as DepositAddress
    );

    return depositAddr as any;
  }

  /**
   * Get BRC20 token information with rate limiting
   */
  async getTokenInfo(ticker: string): Promise<BRC20TokenInfo | null> {
    try {
      const response = await this.makeApiRequest(
        `${this.apiUrl}/v1/indexer/brc20/${ticker}/info`,
        `token info for ${ticker}`
      );

      if (response.data.code === 0) {
        return response.data.data;
      }

      return null;
    } catch (error: any) {
      if (error.response?.status === 403 || error.response?.status === 429) {
        console.error(`❌ BRC20 API access restricted for ${ticker}`);
        return null;
      }
      console.error(
        `❌ Failed to get BRC20 info for ${ticker}:`,
        error.message
      );
      return null;
    }
  }

  /**
   * Get BRC20 transfer history for an address with rate limiting
   */
  async getBRC20History(
    address: string,
    ticker?: string
  ): Promise<BRC20Transfer[]> {
    try {
      const url = ticker
        ? `${this.apiUrl}/v1/indexer/address/${address}/brc20/${ticker}/history`
        : `${this.apiUrl}/v1/indexer/address/${address}/brc20/history`;

      const response = await this.makeApiRequest(
        url,
        `BRC20 history for ${address}${ticker ? ` (${ticker})` : ""}`
      );

      if (response.data.code === 0) {
        return response.data.data.map((item: any) => ({
          txid: item.txid,
          blockHeight: item.blockHeight,
          from: item.from,
          to: item.to,
          ticker: item.ticker,
          amount: item.amount,
          timestamp: item.timestamp,
          inscriptionId: item.inscriptionId,
        }));
      }

      return [];
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.error(
          `❌ Failed to get BRC20 history for ${address}:`,
          "Request failed with status code 403"
        );
        return [];
      }
      if (error.response?.status === 429) {
        console.error(
          `❌ Failed to get BRC20 history for ${address}:`,
          "Rate limited"
        );
        return [];
      }
      console.error(
        `❌ Failed to get BRC20 history for ${address}:`,
        error.message
      );
      return [];
    }
  }

  /**
   * Check for new deposits with rate limiting and error handling
   */
  async checkForNewDeposits(): Promise<BRC20Transfer[]> {
    try {
      console.log("🔍 Checking for new BRC20 deposits...");
      console.log(
        `🔍 Checking for new BRC20 deposits to ${this.hotWalletAddress}...`
      );

      // Skip if too many consecutive errors
      if (this.consecutiveErrors > 5) {
        console.log(
          "⚠️ Too many consecutive errors, skipping BRC20 deposit check"
        );
        return [];
      }

      // Get all BRC20 transfers to our hot wallet
      const transfers = await this.getBRC20History(this.hotWalletAddress);

      // Filter for new transfers (not yet processed)
      const newTransfers = transfers.filter(
        (transfer) =>
          transfer.to === this.hotWalletAddress &&
          !this.processedTransfers.has(transfer.txid)
      );

      console.log(`💰 Found ${newTransfers.length} new BRC20 deposits`);

      // Mark transfers as processed
      newTransfers.forEach((transfer) => {
        this.processedTransfers.add(transfer.txid);
      });

      return newTransfers;
    } catch (error: any) {
      if (error.response?.status === 403 || error.response?.status === 429) {
        console.log("💰 Found 0 new BRC20 deposits");
        return [];
      }
      console.error("❌ Error checking for deposits:", error);
      return [];
    }
  }

  /**
   * Process a BRC20 deposit and determine which user it belongs to
   */
  async processDeposit(transfer: BRC20Transfer): Promise<{
    userId: string;
    citreaAddress: string;
    shouldMint: boolean;
  } | null> {
    try {
      // For now, we'll use a simple mapping based on the from address
      // In a production system, you'd use the reference ID system or
      // have users register their Bitcoin addresses

      // Check if we have any pending deposits for this ticker
      const pendingDeposits = Array.from(this.depositAddresses.values()).filter(
        (deposit) => deposit.ticker === transfer.ticker
      );

      if (pendingDeposits.length > 0) {
        // For demo: assign to the first pending deposit
        const deposit = pendingDeposits[0];

        console.log(
          `✅ Matched deposit: ${transfer.amount} ${transfer.ticker} -> ${deposit.citreaAddress}`
        );

        return {
          userId: deposit.userId,
          citreaAddress: deposit.citreaAddress,
          shouldMint: true,
        };
      }

      console.log(
        `⚠️ No matching deposit found for ${transfer.ticker} from ${transfer.from}`
      );
      return null;
    } catch (error) {
      console.error("❌ Error processing deposit:", error);
      return null;
    }
  }

  /**
   * Get deposit statistics
   */
  getDepositStats(): {
    totalDeposits: number;
    processedTransfers: number;
    pendingDeposits: number;
    supportedTokens: string[];
  } {
    return {
      totalDeposits: this.depositAddresses.size,
      processedTransfers: this.processedTransfers.size,
      pendingDeposits: this.depositAddresses.size,
      supportedTokens: ["PEPE", "CTRA"], // Mock tokens + your custom CTRA
    };
  }

  /**
   * Get all deposit addresses for a user
   */
  getUserDeposits(userId: string): DepositAddress[] {
    return Array.from(this.depositAddresses.values()).filter(
      (deposit) => deposit.userId === userId
    );
  }

  /**
   * Mock: Create test BRC20 tokens for development
   */
  async createMockTokens(): Promise<void> {
    console.log("🎭 Creating mock BRC20 tokens for testing...");

    // For demo purposes, we'll simulate having PEPE and your custom CTRA tokens
    const mockTokens = [
      {
        ticker: "PEPE",
        totalSupply: "420690000000000",
        decimals: "18",
        holders: 1337,
      },
      {
        ticker: "CTRA",
        totalSupply: "2100000000",
        decimals: "18",
        holders: 1,
      },
    ];

    mockTokens.forEach((token) => {
      console.log(
        `📄 Mock token: ${token.ticker} (${token.totalSupply} supply, ${token.holders} holders)`
      );
    });
  }
}

export default BRC20Service;

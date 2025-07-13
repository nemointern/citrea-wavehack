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

  constructor() {
    this.apiUrl = "https://open-api-testnet.unisat.io";
    this.apiKey = process.env.UNISAT_API_KEY || "";

    // Single hot wallet address for all deposits
    // For demo: use a testnet address (in production, generate this securely)
    this.hotWalletAddress = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"; // Example testnet address

    this.depositAddresses = new Map();
    this.processedTransfers = new Set();
  }

  /**
   * Create a deposit request for a user
   */
  createDepositAddress(
    userId: string,
    ticker: string,
    citreaAddress: string
  ): DepositAddress {
    // Generate unique reference ID for this deposit
    const referenceId = `${userId}-${ticker}-${Date.now()}`;

    const depositAddress: DepositAddress = {
      address: this.hotWalletAddress, // Same address for all users
      userId,
      ticker: ticker.toUpperCase(),
      citreaAddress,
      createdAt: Date.now(),
    };

    // Store deposit mapping using reference system
    this.depositAddresses.set(referenceId, depositAddress);

    console.log(
      `🏦 Created deposit request for ${userId}: ${ticker} -> ${this.hotWalletAddress}`
    );

    return {
      ...depositAddress,
      // Include reference ID in response for user to include in transfer
      reference: referenceId,
    } as any;
  }

  /**
   * Get BRC20 token information
   */
  async getTokenInfo(ticker: string): Promise<BRC20TokenInfo | null> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/v1/indexer/brc20/${ticker}/info`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      if (response.data.code === 0) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      console.error(
        `❌ Failed to get BRC20 info for ${ticker}:`,
        error.message
      );
      return null;
    }
  }

  /**
   * Get BRC20 transfer history for an address
   */
  async getBRC20History(
    address: string,
    ticker?: string
  ): Promise<BRC20Transfer[]> {
    try {
      const url = ticker
        ? `${this.apiUrl}/v1/indexer/address/${address}/brc20/${ticker}/history`
        : `${this.apiUrl}/v1/indexer/address/${address}/brc20/history`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        params: {
          limit: 50,
          start: 0,
        },
        timeout: 10000,
      });

      if (response.data.code === 0) {
        return response.data.data.detail.map((transfer: any) => ({
          txid: transfer.txid,
          blockHeight: transfer.height,
          from: transfer.from,
          to: transfer.to,
          ticker: transfer.ticker,
          amount: transfer.amount,
          timestamp: transfer.timestamp,
          inscriptionId: transfer.inscriptionId,
        }));
      }

      return [];
    } catch (error) {
      console.error(
        `❌ Failed to get BRC20 history for ${address}:`,
        error.message
      );
      return [];
    }
  }

  /**
   * Check for new deposits to our hot wallet
   */
  async checkForNewDeposits(): Promise<BRC20Transfer[]> {
    try {
      console.log(
        `🔍 Checking for new BRC20 deposits to ${this.hotWalletAddress}...`
      );

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
    } catch (error) {
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

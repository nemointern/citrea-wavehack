import axios from "axios";
import { EventEmitter } from "events";

interface BRC20Transfer {
  txHash: string;
  blockHeight: number;
  fromAddress: string;
  toAddress: string;
  ticker: string;
  amount: string;
  timestamp: number;
  confirmations: number;
}

interface BitcoinTransaction {
  txid: string;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_time?: number;
  };
  vin: Array<{
    txid: string;
    vout: number;
    prevout: {
      scriptpubkey_address?: string;
      value: number;
    };
  }>;
  vout: Array<{
    scriptpubkey_address?: string;
    value: number;
  }>;
}

export class BTCMonitor extends EventEmitter {
  private apiUrl: string;
  private monitoredAddresses: Set<string>;
  private lastProcessedBlock: number;
  private polling: boolean;
  private pollInterval: number;
  private rateLimitDelay: number;
  private lastApiCall: number;
  private consecutiveErrors: number;
  private maxErrorsBeforeBackoff: number;

  constructor() {
    super();
    this.apiUrl = process.env.BTC_RPC || "https://blockstream.info/testnet/api";
    this.monitoredAddresses = new Set();
    this.lastProcessedBlock = 0;
    this.polling = false;
    this.pollInterval = 300000; // 5 minutes (much slower to avoid rate limits)
    this.rateLimitDelay = 2000; // 2 seconds between API calls
    this.lastApiCall = 0;
    this.consecutiveErrors = 0;
    this.maxErrorsBeforeBackoff = 3;
  }

  /**
   * Add an address to monitor
   */
  addAddress(address: string): void {
    this.monitoredAddresses.add(address);
    console.log(`📍 Added monitoring for address: ${address}`);
  }

  /**
   * Remove an address from monitoring
   */
  removeAddress(address: string): void {
    this.monitoredAddresses.delete(address);
    console.log(`📍 Removed monitoring for address: ${address}`);
  }

  /**
   * Start monitoring with rate limiting
   */
  async startMonitoring(): Promise<void> {
    if (this.polling) {
      console.log("⚠️ Monitoring already started");
      return;
    }

    console.log("🚀 Starting BTC monitoring service...");

    try {
      // Get current block height with rate limiting
      const currentBlock = await this.getCurrentBlockHeight();
      if (this.lastProcessedBlock === 0) {
        this.lastProcessedBlock = currentBlock - 6; // Start from 6 blocks ago
      }

      this.polling = true;
      this.pollForNewTransactions();

      console.log(
        `✅ BTC monitoring started from block ${this.lastProcessedBlock}`
      );
    } catch (error) {
      console.error("❌ Failed to start BTC monitoring:", error);
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.polling = false;
    console.log("🛑 BTC monitoring stopped");
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
        timeout: 15000, // 15 second timeout
        headers: {
          "User-Agent": "CitreaDarkPool/1.0.0",
        },
      });

      // Reset error count on successful request
      this.consecutiveErrors = 0;
      return response.data;
    } catch (error: any) {
      this.consecutiveErrors++;

      if (error.response?.status === 429) {
        const backoffTime = Math.min(60000 * this.consecutiveErrors, 300000); // Max 5 minutes
        console.error(
          `⚠️ Rate limited (429). Backing off for ${backoffTime / 1000}s...`
        );
        await this.sleep(backoffTime);
        this.rateLimitDelay = Math.min(this.rateLimitDelay * 2, 10000); // Increase delay up to 10s
        throw error;
      }

      if (error.response?.status === 403) {
        console.error(`⚠️ Forbidden (403) for ${description}. Skipping...`);
        throw error;
      }

      if (this.consecutiveErrors >= this.maxErrorsBeforeBackoff) {
        const backoffTime = Math.min(30000 * this.consecutiveErrors, 300000); // Progressive backoff
        console.error(
          `⚠️ Multiple errors for ${description}. Backing off for ${
            backoffTime / 1000
          }s...`
        );
        await this.sleep(backoffTime);
      }

      throw error;
    }
  }

  /**
   * Get current Bitcoin block height with rate limiting and error handling
   */
  private async getCurrentBlockHeight(): Promise<number> {
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(
          `📡 Fetching current block height (attempt ${
            attempt + 1
          }/${maxRetries})...`
        );

        const data = await this.makeApiRequest(
          `${this.apiUrl}/blocks/tip/height`,
          "block height"
        );

        console.log(`✅ Current block height: ${data}`);
        return data;
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries - 1;

        if (error.response?.status === 429 || error.response?.status === 403) {
          if (isLastAttempt) {
            console.error(
              "🚨 All retry attempts failed for block height fetch due to rate limiting"
            );
            // Return last known block to continue monitoring
            return this.lastProcessedBlock;
          }
        } else if (isLastAttempt) {
          console.error("🚨 All retry attempts failed for block height fetch");
          throw error;
        }

        const delay = 5000 * Math.pow(2, attempt); // Exponential backoff
        console.log(`⏳ Retrying in ${delay / 1000}s...`);
        await this.sleep(delay);
      }
    }

    // Fallback to last known block
    return this.lastProcessedBlock;
  }

  /**
   * Poll for new transactions with better error handling
   */
  private async pollForNewTransactions(): Promise<void> {
    while (this.polling) {
      try {
        await this.checkForNewBlocks();

        // Adaptive polling interval based on error rate
        const adaptiveInterval =
          this.consecutiveErrors > 0
            ? this.pollInterval * (1 + this.consecutiveErrors)
            : this.pollInterval;

        console.log(
          `⏳ Waiting ${adaptiveInterval / 1000}s before next poll...`
        );
        await this.sleep(adaptiveInterval);
      } catch (error) {
        console.error("Error during polling:", error);

        // Longer wait on errors
        const errorBackoff = Math.min(60000 * this.consecutiveErrors, 600000); // Max 10 minutes
        console.log(`⏳ Error backoff: waiting ${errorBackoff / 1000}s...`);
        await this.sleep(errorBackoff);
      }
    }
  }

  /**
   * Check for new blocks with rate limiting
   */
  private async checkForNewBlocks(): Promise<void> {
    let currentBlock;

    try {
      currentBlock = await this.getCurrentBlockHeight();
    } catch (error) {
      console.error("Failed to get current block height, skipping this cycle");
      return;
    }

    if (currentBlock > this.lastProcessedBlock) {
      // Limit block processing to prevent overwhelming API
      const maxBlocksPerCycle = 3;
      const blocksToProcess = Math.min(
        currentBlock - this.lastProcessedBlock,
        maxBlocksPerCycle
      );

      const endBlock = this.lastProcessedBlock + blocksToProcess;

      console.log(
        `🔍 Processing blocks ${
          this.lastProcessedBlock + 1
        } to ${endBlock} (${blocksToProcess} blocks)`
      );

      for (
        let blockHeight = this.lastProcessedBlock + 1;
        blockHeight <= endBlock;
        blockHeight++
      ) {
        try {
          await this.processBlock(blockHeight);
          this.lastProcessedBlock = blockHeight;

          // Add longer delay between blocks to avoid rate limiting
          if (blockHeight < endBlock) {
            console.log("⏳ Waiting 10s before processing next block...");
            await this.sleep(10000);
          }
        } catch (error) {
          console.error(`Failed to process block ${blockHeight}:`, error);
          // Continue with next block instead of stopping
          this.lastProcessedBlock = blockHeight;
        }
      }
    }
  }

  /**
   * Process a specific block with minimal API calls
   */
  private async processBlock(blockHeight: number): Promise<void> {
    try {
      // Only process blocks if we have addresses to monitor
      if (this.monitoredAddresses.size === 0) {
        console.log(
          `📦 Skipping block ${blockHeight} - no addresses monitored`
        );
        return;
      }

      const blockHash = await this.getBlockHash(blockHeight);
      const txids = await this.getBlock(blockHash);

      console.log(
        `📦 Processing block ${blockHeight} with ${txids.length} transactions`
      );

      // Limit transaction processing to prevent overwhelming API
      const maxTxPerBlock = 10;
      const txidsToProcess = txids.slice(0, maxTxPerBlock);

      if (txids.length > maxTxPerBlock) {
        console.log(
          `⚠️ Limiting to first ${maxTxPerBlock} transactions in block ${blockHeight}`
        );
      }

      for (const txid of txidsToProcess) {
        try {
          await this.processTransaction(txid, blockHeight);
          // Small delay between transactions
          await this.sleep(500);
        } catch (error) {
          console.error(`Error processing transaction ${txid}:`, error);
          // Continue with next transaction
        }
      }
    } catch (error) {
      console.error(`Error processing block ${blockHeight}:`, error);
      throw error;
    }
  }

  /**
   * Get block hash with rate limiting
   */
  private async getBlockHash(height: number): Promise<string> {
    try {
      const data = await this.makeApiRequest(
        `${this.apiUrl}/block-height/${height}`,
        `block hash for height ${height}`
      );
      return data;
    } catch (error) {
      throw new Error(
        `Failed to get block hash for height ${height}: ${error.message}`
      );
    }
  }

  /**
   * Get block transactions with rate limiting
   */
  private async getBlock(blockHash: string): Promise<string[]> {
    try {
      const data = await this.makeApiRequest(
        `${this.apiUrl}/block/${blockHash}/txids`,
        `transactions for block ${blockHash}`
      );
      return data;
    } catch (error) {
      throw new Error(`Failed to get block ${blockHash}: ${error.message}`);
    }
  }

  /**
   * Process transaction with rate limiting
   */
  private async processTransaction(
    txid: string,
    blockHeight: number
  ): Promise<void> {
    try {
      const transaction = await this.getTransaction(txid);
      const involvedAddresses = this.getInvolvedAddresses(transaction);

      // Check if any monitored addresses are involved
      const hasMonitoredAddress = involvedAddresses.some((addr) =>
        this.monitoredAddresses.has(addr)
      );

      if (hasMonitoredAddress) {
        console.log(
          `💰 Found transaction involving monitored address: ${txid}`
        );

        // Extract BRC20 transfers
        const transfers = await this.extractBRC20Transfers(
          transaction,
          blockHeight
        );

        if (transfers.length > 0) {
          console.log(
            `📄 Found ${transfers.length} BRC20 transfers in transaction ${txid}`
          );
          this.emit("brc20Transfer", transfers);
        }
      }
    } catch (error) {
      console.error(`Error processing transaction ${txid}:`, error);
      throw error;
    }
  }

  /**
   * Get transaction with rate limiting
   */
  private async getTransaction(txid: string): Promise<BitcoinTransaction> {
    try {
      const data = await this.makeApiRequest(
        `${this.apiUrl}/tx/${txid}`,
        `transaction ${txid}`
      );
      return data;
    } catch (error) {
      throw new Error(`Failed to get transaction ${txid}: ${error.message}`);
    }
  }

  /**
   * Get all addresses involved in a transaction
   */
  private getInvolvedAddresses(transaction: BitcoinTransaction): string[] {
    const addresses: Set<string> = new Set();

    // Input addresses
    transaction.vin.forEach((input) => {
      if (input.prevout?.scriptpubkey_address) {
        addresses.add(input.prevout.scriptpubkey_address);
      }
    });

    // Output addresses
    transaction.vout.forEach((output) => {
      if (output.scriptpubkey_address) {
        addresses.add(output.scriptpubkey_address);
      }
    });

    return Array.from(addresses);
  }

  /**
   * Extract BRC20 transfers from transaction
   * Note: This is a simplified extraction - in reality you'd parse the ordinal inscriptions
   */
  private async extractBRC20Transfers(
    transaction: BitcoinTransaction,
    blockHeight: number
  ): Promise<BRC20Transfer[]> {
    const transfers: BRC20Transfer[] = [];

    // Mock BRC20 transfer detection for hackathon
    // In reality, you'd parse ordinal inscriptions in the transaction

    // For demo purposes, we'll simulate BRC20 transfers based on transaction patterns
    const currentBlock = await this.getCurrentBlockHeight();
    const confirmations = currentBlock - blockHeight + 1;

    // Only process transactions with sufficient confirmations
    if (confirmations >= 6) {
      // Mock transfer detection - you would actually parse inscriptions here
      if (transaction.vout.length >= 2) {
        const fromAddress = transaction.vin[0]?.prevout?.scriptpubkey_address;
        const toAddress = transaction.vout[0]?.scriptpubkey_address;

        if (
          fromAddress &&
          toAddress &&
          this.monitoredAddresses.has(toAddress)
        ) {
          // Simulate finding a BRC20 transfer
          transfers.push({
            txHash: transaction.txid,
            blockHeight,
            fromAddress,
            toAddress,
            ticker: "PEPE", // Mock ticker - would be parsed from inscription
            amount: "1000", // Mock amount - would be parsed from inscription
            timestamp: transaction.status.block_time || Date.now() / 1000,
            confirmations,
          });
        }
      }
    }

    return transfers;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get monitoring status
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    monitoredAddresses: string[];
    lastProcessedBlock: number;
    currentBlock: number;
    lastUpdate: string;
    pendingTransfers?: number;
  }> {
    try {
      const currentBlock = await this.getCurrentBlockHeight();
      return {
        isRunning: this.polling,
        monitoredAddresses: Array.from(this.monitoredAddresses),
        lastProcessedBlock: this.lastProcessedBlock,
        currentBlock,
        lastUpdate: new Date().toISOString(),
        pendingTransfers: 0,
      };
    } catch (error) {
      return {
        isRunning: this.polling,
        monitoredAddresses: Array.from(this.monitoredAddresses),
        lastProcessedBlock: this.lastProcessedBlock,
        currentBlock: this.lastProcessedBlock,
        lastUpdate: "Failed to fetch",
        pendingTransfers: 0,
      };
    }
  }
}

export default BTCMonitor;

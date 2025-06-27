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

  constructor() {
    super();
    this.apiUrl = process.env.BTC_RPC || "https://blockstream.info/testnet/api";
    this.monitoredAddresses = new Set();
    this.lastProcessedBlock = 0;
    this.polling = false;
    this.pollInterval = 60000; // 60 seconds (reduced frequency)
  }

  /**
   * Add Bitcoin address to monitoring list
   */
  addAddress(address: string): void {
    this.monitoredAddresses.add(address);
    console.log(`📍 Added address to monitoring: ${address}`);
  }

  /**
   * Remove Bitcoin address from monitoring
   */
  removeAddress(address: string): void {
    this.monitoredAddresses.delete(address);
    console.log(`🗑️ Removed address from monitoring: ${address}`);
  }

  /**
   * Start monitoring Bitcoin network
   */
  async startMonitoring(): Promise<void> {
    if (this.polling) {
      console.log("⚠️ Monitoring already started");
      return;
    }

    console.log("🚀 Starting BTC monitoring service...");

    try {
      // Get current block height
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
   * Get current Bitcoin block height with retry logic
   */
  private async getCurrentBlockHeight(): Promise<number> {
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(
          `📡 Fetching current block height (attempt ${
            attempt + 1
          }/${maxRetries})...`
        );

        const response = await axios.get(`${this.apiUrl}/blocks/tip/height`, {
          timeout: 10000, // 10 second timeout
          headers: {
            "User-Agent": "CitreaDarkPool/1.0.0",
          },
        });

        console.log(`✅ Current block height: ${response.data}`);
        return response.data;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries - 1;
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff

        console.error(
          `❌ Failed to get current block height (attempt ${
            attempt + 1
          }/${maxRetries}):`,
          error.message
        );

        if (isLastAttempt) {
          console.error("🚨 All retry attempts failed for block height fetch");
          throw error;
        }

        console.log(`⏳ Retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    throw new Error("Failed to get block height after all retries");
  }

  /**
   * Poll for new transactions
   */
  private async pollForNewTransactions(): Promise<void> {
    while (this.polling) {
      try {
        await this.checkForNewBlocks();
        await this.sleep(this.pollInterval);
      } catch (error) {
        console.error("Error during polling:", error);
        await this.sleep(this.pollInterval);
      }
    }
  }

  /**
   * Check for new blocks and transactions
   */
  private async checkForNewBlocks(): Promise<void> {
    const currentBlock = await this.getCurrentBlockHeight();

    if (currentBlock > this.lastProcessedBlock) {
      console.log(
        `🔍 Processing blocks ${this.lastProcessedBlock + 1} to ${currentBlock}`
      );

      for (
        let blockHeight = this.lastProcessedBlock + 1;
        blockHeight <= currentBlock;
        blockHeight++
      ) {
        await this.processBlock(blockHeight);
        // Add 2 second delay between block processing to avoid rate limiting
        if (blockHeight < currentBlock) {
          console.log("⏳ Waiting 2s before processing next block...");
          await this.sleep(2000);
        }
      }

      this.lastProcessedBlock = currentBlock;
    }
  }

  /**
   * Process a specific block
   */
  private async processBlock(blockHeight: number): Promise<void> {
    try {
      const blockHash = await this.getBlockHash(blockHeight);
      const block = await this.getBlock(blockHash);

      console.log(
        `📦 Processing block ${blockHeight} with ${block.length} transactions`
      );

      for (const txid of block) {
        await this.processTransaction(txid, blockHeight);
      }
    } catch (error) {
      console.error(`Error processing block ${blockHeight}:`, error);
    }
  }

  /**
   * Get block hash by height with retry logic
   */
  private async getBlockHash(height: number): Promise<string> {
    const maxRetries = 2;
    const baseDelay = 1500;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.sleep(500); // Brief delay before API call
        const response = await axios.get(
          `${this.apiUrl}/block-height/${height}`,
          {
            timeout: 8000,
            headers: { "User-Agent": "CitreaDarkPool/1.0.0" },
          }
        );
        return response.data;
      } catch (error) {
        if (attempt === maxRetries - 1) throw error;
        await this.sleep(baseDelay * (attempt + 1));
      }
    }
    throw new Error(`Failed to get block hash for height ${height}`);
  }

  /**
   * Get block data
   */
  private async getBlock(blockHash: string): Promise<string[]> {
    const response = await axios.get(`${this.apiUrl}/block/${blockHash}/txids`);
    return response.data;
  }

  /**
   * Process individual transaction
   */
  private async processTransaction(
    txid: string,
    blockHeight: number
  ): Promise<void> {
    try {
      const transaction = await this.getTransaction(txid);

      if (!transaction.status.confirmed) {
        return; // Skip unconfirmed transactions
      }

      // Check if transaction involves any monitored addresses
      const involvedAddresses = this.getInvolvedAddresses(transaction);
      const monitoredInvolved = involvedAddresses.filter((addr) =>
        this.monitoredAddresses.has(addr)
      );

      if (monitoredInvolved.length > 0) {
        console.log(
          `🎯 Found transaction involving monitored addresses: ${txid}`
        );

        // Check for BRC20 transfers in transaction data
        const brc20Transfers = await this.extractBRC20Transfers(
          transaction,
          blockHeight
        );

        for (const transfer of brc20Transfers) {
          this.emit("brc20Transfer", transfer);
        }
      }
    } catch (error) {
      console.error(`Error processing transaction ${txid}:`, error);
    }
  }

  /**
   * Get transaction data
   */
  private async getTransaction(txid: string): Promise<BitcoinTransaction> {
    const response = await axios.get(`${this.apiUrl}/tx/${txid}`);
    return response.data;
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

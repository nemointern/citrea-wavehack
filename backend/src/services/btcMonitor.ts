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
    this.pollInterval = 30000; // 30 seconds
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
   * Get current Bitcoin block height
   */
  private async getCurrentBlockHeight(): Promise<number> {
    try {
      const response = await axios.get(`${this.apiUrl}/blocks/tip/height`);
      return response.data;
    } catch (error) {
      console.error("Failed to get current block height:", error);
      throw error;
    }
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
   * Get block hash by height
   */
  private async getBlockHash(height: number): Promise<string> {
    const response = await axios.get(`${this.apiUrl}/block-height/${height}`);
    return response.data;
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
  getStatus(): {
    isRunning: boolean;
    monitoredAddresses: string[];
    lastProcessedBlock: number;
  } {
    return {
      isRunning: this.polling,
      monitoredAddresses: Array.from(this.monitoredAddresses),
      lastProcessedBlock: this.lastProcessedBlock,
    };
  }
}

export default BTCMonitor;

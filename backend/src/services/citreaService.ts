import {
  createPublicClient,
  createWalletClient,
  http,
  Address,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { citreaTestnet } from "../config/citrea";
import { ContractAddresses } from "../config/contracts";

// Import ABIs
import { abi as BRIDGE_ABI } from "../abis/CitreaBridge.json";
import { abi as ORDERBOOK_ABI } from "../abis/OrderBook.json";
import { abi as WRAPPED_BRC20_ABI } from "../abis/WrappedBRC20.json";
import { abi as ERC20_ABI } from "../abis/ERC20.json";

export class CitreaService {
  private publicClient;
  private walletClient;
  private account;
  private contracts: ContractAddresses;
  private lastProcessedBatch: number = 0;

  constructor(privateKey: string, contracts: ContractAddresses) {
    this.contracts = contracts;

    this.publicClient = createPublicClient({
      chain: citreaTestnet,
      transport: http(),
    });

    this.account = privateKeyToAccount(privateKey as `0x${string}`);

    this.walletClient = createWalletClient({
      account: this.account,
      chain: citreaTestnet,
      transport: http(),
    });

    console.log(`🔗 Connected to Citrea with account: ${this.account.address}`);
  }

  /**
   * Process bridge mint for BRC20 transfer
   */
  async processBridgeMint(
    userAddress: Address,
    ticker: string,
    amount: string,
    btcTxHash: string
  ): Promise<string> {
    try {
      console.log(
        `🌉 Processing bridge mint: ${amount} ${ticker} for ${userAddress}`
      );

      const amountWei = parseUnits(amount, 18);

      const hash = await this.walletClient.writeContract({
        address: this.contracts.bridge,
        abi: BRIDGE_ABI,
        functionName: "processBridgeIn",
        args: [userAddress, ticker, amountWei, btcTxHash],
      });

      console.log(`✅ Bridge mint transaction sent: ${hash}`);
      return hash;
    } catch (error) {
      console.error("❌ Failed to process bridge mint:", error);
      throw error;
    }
  }

  /**
   * Get wrapped token address for a BRC20 ticker
   */
  async getWrappedTokenAddress(ticker: string): Promise<Address> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contracts.bridge,
        abi: BRIDGE_ABI,
        functionName: "getWrappedToken",
        args: [ticker],
      });

      const tokenAddress = result as Address;

      if (tokenAddress === "0x0000000000000000000000000000000000000000") {
        throw new Error(
          `Token ${ticker} not found in bridge. Tokens need to be deployed through bridge.deployWrappedToken().`
        );
      }

      return tokenAddress;
    } catch (error: any) {
      // Handle the case where token is not associated
      console.warn(`Token ${ticker} not found in bridge:`, error.message);

      // Return fallback addresses for testing
      const fallbackAddresses: Record<string, Address> = {
        pepe: this.contracts.tokens.wPEPE,
        ordi: this.contracts.tokens.wORDI,
        ctra: this.contracts.tokens.wCTRA,
      };

      if (fallbackAddresses[ticker.toLowerCase()]) {
        console.log(
          `Using fallback address for ${ticker}:`,
          fallbackAddresses[ticker.toLowerCase()]
        );
        return fallbackAddresses[ticker.toLowerCase()];
      }

      throw new Error(
        `Token ${ticker} not supported and no fallback available`
      );
    }
  }

  /**
   * Check if user is registered for bridge
   */
  async isUserRegistered(userAddress: Address): Promise<boolean> {
    try {
      const isRegistered = await this.publicClient.readContract({
        address: this.contracts.bridge,
        abi: BRIDGE_ABI,
        functionName: "isUserRegistered",
        args: [userAddress],
      });

      return isRegistered;
    } catch (error) {
      console.error(`❌ Failed to check user registration:`, error);
      return false;
    }
  }

  /**
   * Commit order to dark pool (ON-CHAIN)
   */
  async commitOrder(
    commitmentHash: string
  ): Promise<{ orderId: number; txHash: string }> {
    try {
      console.log(`📝 Committing order on-chain: ${commitmentHash}`);

      const hash = await this.walletClient.writeContract({
        address: this.contracts.orderBook,
        abi: ORDERBOOK_ABI,
        functionName: "commitOrder",
        args: [commitmentHash as `0x${string}`],
      });

      console.log(`⏳ Waiting for transaction confirmation...`);
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
      });

      // Parse logs to get order ID from OrderCommitted event
      let orderId = 0;
      if (receipt.logs && receipt.logs.length > 0) {
        // Look for OrderCommitted event (first topic should be the event signature)
        for (const log of receipt.logs) {
          if (log.topics && log.topics.length > 0) {
            // Parse the order ID from the log data (simplified)
            // In the smart contract, orderId is the first indexed parameter
            if (log.topics[1]) {
              orderId = parseInt(log.topics[1], 16);
              break;
            }
          }
        }
      }

      // Fallback to reading nextOrderId from contract
      if (orderId === 0) {
        try {
          const nextId = await this.publicClient.readContract({
            address: this.contracts.orderBook,
            abi: ORDERBOOK_ABI,
            functionName: "nextOrderId",
          });
          orderId = Number(nextId) - 1; // Since it was incremented after our order
        } catch {
          orderId = Date.now() % 100000; // Final fallback
        }
      }

      console.log(`✅ Order committed on-chain: ${hash}, Order ID: ${orderId}`);
      return { orderId, txHash: hash };
    } catch (error) {
      console.error("❌ Failed to commit order on-chain:", error);
      throw error;
    }
  }

  /**
   * Reveal order on dark pool (ON-CHAIN)
   */
  async revealOrder(
    orderId: number,
    tokenA: Address,
    tokenB: Address,
    amount: bigint,
    price: bigint,
    salt: bigint,
    orderType: number
  ): Promise<string> {
    try {
      console.log(`🎭 Revealing order ${orderId} on-chain`);

      const hash = await this.walletClient.writeContract({
        address: this.contracts.orderBook,
        abi: ORDERBOOK_ABI,
        functionName: "revealOrder",
        args: [BigInt(orderId), tokenA, tokenB, amount, price, salt, orderType],
      });

      console.log(`✅ Order revealed on-chain: ${hash}`);
      return hash;
    } catch (error) {
      console.error("❌ Failed to reveal order on-chain:", error);
      throw error;
    }
  }

  /**
   * Get token address by ticker
   */
  getTokenAddress(ticker: string): Address {
    const tokenMap: Record<string, Address> = {
      wPEPE: this.contracts.tokens.wPEPE,
      wORDI: this.contracts.tokens.wORDI,
      wCTRA: this.contracts.tokens.wCTRA,
      nUSD: this.contracts.nUSD,
    };

    const address = tokenMap[ticker];
    if (!address) {
      throw new Error(`Unknown token: ${ticker}`);
    }

    return address;
  }

  /**
   * Get token ticker by address (reverse lookup)
   */
  getTokenTicker(address: Address): string {
    // Handle undefined or null addresses
    if (!address) {
      console.warn(`Invalid token address: ${address}`);
      return "UNKNOWN";
    }

    const addressMap: Record<string, string> = {
      [this.contracts.tokens.wPEPE.toLowerCase()]: "wPEPE",
      [this.contracts.tokens.wORDI.toLowerCase()]: "wORDI",
      [this.contracts.tokens.wCTRA.toLowerCase()]: "wCTRA",
      [this.contracts.nUSD.toLowerCase()]: "nUSD",
    };

    const ticker = addressMap[address.toLowerCase()];
    if (!ticker) {
      console.warn(`Unknown token address: ${address}`);
      return address; // Return address as fallback
    }

    return ticker;
  }

  /**
   * Process dark pool batch
   */
  async processDarkPoolBatch(
    batchId: number,
    buyOrderIds: number[],
    sellOrderIds: number[],
    matchedAmounts: bigint[],
    executionPrices: bigint[]
  ): Promise<string> {
    try {
      console.log(
        `🔄 Processing dark pool batch ${batchId} with ${buyOrderIds.length} matches`
      );

      const hash = await this.walletClient.writeContract({
        address: this.contracts.orderBook,
        abi: ORDERBOOK_ABI,
        functionName: "processBatch",
        args: [
          BigInt(batchId),
          buyOrderIds.map((id) => BigInt(id)),
          sellOrderIds.map((id) => BigInt(id)),
          matchedAmounts,
          executionPrices,
        ],
      });

      console.log(`✅ Dark pool batch transaction sent: ${hash}`);
      return hash;
    } catch (error) {
      console.error("❌ Failed to process dark pool batch:", error);
      throw error;
    }
  }

  /**
   * Process matches for a completed batch
   */
  async processBatchMatches(batchId: number): Promise<void> {
    try {
      console.log(`🎯 Processing matches for batch ${batchId}...`);

      // Get all order IDs from the batch
      const orderIds = (await this.publicClient.readContract({
        address: this.contracts.orderBook,
        abi: ORDERBOOK_ABI,
        functionName: "getBatchOrderIds",
        args: [BigInt(batchId)],
      })) as bigint[];

      console.log(`📋 Found ${orderIds.length} orders in batch ${batchId}`);

      if (orderIds.length === 0) {
        console.log("⚠️ No orders to process in this batch");
        return;
      }

      // Fetch revealed orders
      const revealedOrders = [];
      for (const orderId of orderIds) {
        try {
          const revealedOrder = (await this.publicClient.readContract({
            address: this.contracts.orderBook,
            abi: ORDERBOOK_ABI,
            functionName: "revealedOrders",
            args: [orderId],
          })) as any;

          // Only include orders that were actually revealed (have amount > 0)
          // Use array indexing like in getRevealedOrder function
          if (revealedOrder && revealedOrder[3] && revealedOrder[3] > 0n) {
            revealedOrders.push({
              orderId: Number(orderId),
              trader: revealedOrder[0], // trader
              tokenA: revealedOrder[1], // tokenA
              tokenB: revealedOrder[2], // tokenB
              amount: revealedOrder[3], // amount
              price: revealedOrder[5], // price
              orderType: Number(revealedOrder[7]) === 0 ? "BUY" : "SELL", // orderType
              batchId,
              timestamp: Date.now(),
            });
          }
        } catch (error) {
          console.warn(`⚠️ Could not fetch order ${orderId}:`, error);
        }
      }

      console.log(`✅ Found ${revealedOrders.length} revealed orders to match`);

      if (revealedOrders.length === 0) {
        console.log("⚠️ No revealed orders to process");
        return;
      }

      // Import matching engine (we'll need to get this from the main module)
      // For now, make a direct API call to the batch processing endpoint
      const response = await fetch(
        "http://localhost:3001/api/darkpool/batch/process",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            batchId,
            orders: revealedOrders.map((order) => ({
              ...order,
              amount: order.amount.toString(),
              price: order.price.toString(),
            })),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Batch processing failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(
        `🎉 Batch ${batchId} processed: ${result.totalMatches} matches executed`
      );

      if (result.txHash) {
        console.log(`📈 Matches executed on-chain: ${result.txHash}`);
      }
    } catch (error) {
      console.error(`❌ Failed to process batch ${batchId}:`, error);
      // Don't throw - we want the system to continue with new batch creation
    }
  }

  /**
   * Create a new batch on the OrderBook contract
   */
  async createNewBatch(): Promise<string> {
    try {
      console.log("🆕 Creating new batch on-chain");

      const hash = await this.walletClient.writeContract({
        address: this.contracts.orderBook,
        abi: ORDERBOOK_ABI,
        functionName: "createNewBatch",
      });

      console.log(`✅ New batch created on-chain: ${hash}`);
      return hash;
    } catch (error) {
      console.error("❌ Failed to create new batch:", error);
      throw error;
    }
  }

  /**
   * Get current dark pool batch information
   */
  async getCurrentBatch() {
    try {
      const result = await this.publicClient.readContract({
        address: this.contracts.orderBook,
        abi: ORDERBOOK_ABI,
        functionName: "getCurrentBatch",
      });

      // Calculate real-time phase and remaining time
      const currentTime = Math.floor(Date.now() / 1000);
      const startTime = Number(result.startTime);
      const COMMIT_PHASE_DURATION = 300; // 5 minutes
      const REVEAL_PHASE_DURATION = 180; // 3 minutes

      const timeElapsed = currentTime - startTime;
      const commitPhaseEnd = COMMIT_PHASE_DURATION;
      const revealPhaseEnd = COMMIT_PHASE_DURATION + REVEAL_PHASE_DURATION;

      let phase, timeRemaining;

      if (timeElapsed < commitPhaseEnd) {
        // COMMIT PHASE
        phase = "commit";
        timeRemaining = commitPhaseEnd - timeElapsed;
      } else if (timeElapsed < revealPhaseEnd) {
        // REVEAL PHASE
        phase = "reveal";
        timeRemaining = revealPhaseEnd - timeElapsed;
      } else {
        // PROCESSING PHASE
        phase = "processing";
        timeRemaining = 0;
      }

      // Ensure timeRemaining is never negative
      timeRemaining = Math.max(0, timeRemaining);

      console.log(
        `📊 Batch ${
          result.batchId
        }: ${phase.toUpperCase()} phase, ${timeRemaining}s remaining`
      );

      // Auto-process batch when it reaches processing phase (only once per batch)
      const currentBatchId = Number(result.batchId);
      if (
        phase === "processing" &&
        timeRemaining === 0 &&
        currentBatchId >= this.lastProcessedBatch // Changed > to >= to handle batch 0
      ) {
        console.log(
          `🔄 Batch ${currentBatchId} completed! Processing matches first...`
        );
        this.lastProcessedBatch = currentBatchId + 1; // Set to next expected batch

        // PROCESS MATCHES FIRST, THEN CREATE NEW BATCH
        try {
          await this.processBatchMatches(currentBatchId);

          // Only create new batch after processing is complete
          const txHash = await this.createNewBatch();
          console.log(`✅ New batch created automatically! TX: ${txHash}`);
          console.log("🔄 Batch cycle continues...");
        } catch (error) {
          console.error("❌ Failed to auto-process batch:", error);
          // Reset tracker so it can try again
          this.lastProcessedBatch = currentBatchId;
        }
      }

      return {
        ...result,
        phase,
        timeRemaining,
      };
    } catch (error: any) {
      console.error("Failed to get current batch:", error.message);

      // Return mock batch data for testing
      const currentTime = Math.floor(Date.now() / 1000);
      return {
        batchId: 1,
        startTime: currentTime,
        endTime: 0,
        orderIds: [],
        processed: false,
        totalOrders: 0,
        phase: "commit",
        timeRemaining: 300,
      };
    }
  }

  /**
   * Get revealed order details
   */
  async getRevealedOrder(orderId: number): Promise<{
    trader: Address;
    tokenA: Address;
    tokenB: Address;
    amount: bigint;
    price: bigint;
    salt: bigint;
    orderType: number;
    orderId: number;
    batchId: number;
    executed: boolean;
  } | null> {
    try {
      const order = await this.publicClient.readContract({
        address: this.contracts.orderBook,
        abi: ORDERBOOK_ABI,
        functionName: "revealedOrders",
        args: [orderId],
      });
      // Check if order exists (trader is not zero address)
      if (!order || order[0] === "0x0000000000000000000000000000000000000000") {
        return null;
      }

      // Check if order has been revealed (amount > 0)
      if (order[3] === 0n) {
        return null;
      }

      return {
        trader: order[0],
        tokenA: order[1],
        tokenB: order[2],
        amount: order[3],
        price: order[5],
        salt: order[6],
        orderType: Number(order[7]),
        orderId: Number(order[8]),
        batchId: Number(order[9]),
        executed: order[10] === true,
      };
    } catch (error) {
      // Handle ABI decoding errors more gracefully
      if (error.message && error.message.includes("not a valid boolean")) {
        console.warn(`⚠️ Order ${orderId} has invalid, ${error.message}`);
        return null;
      }
      console.error(`❌ Failed to get revealed order ${orderId}:`, error);
      return null;
    }
  }

  /**
   * Get order IDs for a specific batch
   */
  async getBatchOrderIds(batchId: number): Promise<string[]> {
    try {
      const orderIds = await this.publicClient.readContract({
        address: this.contracts.orderBook,
        abi: ORDERBOOK_ABI,
        functionName: "getBatchOrderIds",
        args: [BigInt(batchId)],
      });

      return (orderIds as bigint[]).map((id) => id.toString());
    } catch (error) {
      console.error(
        `❌ Failed to get batch order IDs for batch ${batchId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Get token balance
   */
  async getTokenBalance(
    tokenAddress: Address,
    userAddress: Address
  ): Promise<bigint> {
    try {
      const balance = await this.publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [userAddress],
      });

      return balance;
    } catch (error) {
      console.error(`❌ Failed to get token balance:`, error);
      return 0n;
    }
  }

  /**
   * Get nUSD balance for user
   */
  async getNUSDBalance(userAddress: Address): Promise<bigint> {
    return this.getTokenBalance(this.contracts.nUSD, userAddress);
  }

  /**
   * Get chain info
   */
  getChainInfo(): {
    chainId: number;
    name: string;
    rpcUrl: string;
    explorerUrl: string;
  } {
    return {
      chainId: citreaTestnet.id,
      name: citreaTestnet.name,
      rpcUrl: citreaTestnet.rpcUrls.default.http[0],
      explorerUrl: citreaTestnet.blockExplorers.default.url,
    };
  }

  /**
   * Get account info
   */
  getAccountInfo(): {
    address: Address;
    balance?: bigint;
  } {
    return {
      address: this.account.address,
    };
  }

  /**
   * Test contract connectivity
   */
  async testContracts() {
    const results = {
      bridge: { connected: false, error: null as string | null },
      orderBook: { connected: false, error: null as string | null },
      tokens: {
        wPEPE: { connected: false, error: null as string | null },
        wORDI: { connected: false, error: null as string | null },
      },
    };

    // Test bridge
    try {
      await this.publicClient.readContract({
        address: this.contracts.bridge,
        abi: BRIDGE_ABI,
        functionName: "nextRequestId",
      });
      results.bridge.connected = true;
    } catch (error: any) {
      results.bridge.error = error.message;
    }

    // Test order book
    try {
      await this.publicClient.readContract({
        address: this.contracts.orderBook,
        abi: ORDERBOOK_ABI,
        functionName: "currentBatchId",
      });
      results.orderBook.connected = true;
    } catch (error: any) {
      results.orderBook.error = error.message;
    }

    // Test tokens
    for (const [ticker, address] of Object.entries(this.contracts.tokens)) {
      try {
        await this.publicClient.readContract({
          address: address,
          abi: WRAPPED_BRC20_ABI,
          functionName: "totalSupply",
        });
        results.tokens[ticker as keyof typeof results.tokens].connected = true;
      } catch (error: any) {
        results.tokens[ticker as keyof typeof results.tokens].error =
          error.message;
      }
    }

    return results;
  }
}

export default CitreaService;

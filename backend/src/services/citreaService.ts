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

      // Auto-create new batch when current batch reaches processing phase (only once per batch)
      const currentBatchId = Number(result.batchId);
      if (
        phase === "processing" &&
        timeRemaining === 0 &&
        currentBatchId >= this.lastProcessedBatch // Changed > to >= to handle batch 0
      ) {
        console.log(
          `🔄 Batch ${currentBatchId} completed! Auto-creating new batch...`
        );
        this.lastProcessedBatch = currentBatchId + 1; // Set to next expected batch

        // Note: In production, you'd process matches first, then create new batch
        try {
          const txHash = await this.createNewBatch();
          console.log(`✅ New batch created automatically! TX: ${txHash}`);
          console.log("🔄 Batch cycle continues...");
        } catch (error) {
          console.error("❌ Failed to auto-create new batch:", error);
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
        args: [BigInt(orderId)],
      });

      if (order.trader === "0x0000000000000000000000000000000000000000") {
        return null;
      }

      return {
        trader: order.trader,
        tokenA: order.tokenA,
        tokenB: order.tokenB,
        amount: order.amount,
        price: order.price,
        salt: order.salt,
        orderType: Number(order.orderType),
        orderId: Number(order.orderId),
        batchId: Number(order.batchId),
        executed: order.executed,
      };
    } catch (error) {
      console.error(`❌ Failed to get revealed order ${orderId}:`, error);
      return null;
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

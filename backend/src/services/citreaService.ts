import {
  createPublicClient,
  createWalletClient,
  http,
  Address,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { citreaTestnet } from "../config/citrea.js";

// Contract ABIs (simplified for hackathon)
const BRIDGE_ABI = [
  {
    inputs: [
      { type: "address", name: "user" },
      { type: "string", name: "ticker" },
      { type: "uint256", name: "amount" },
      { type: "string", name: "btcTxHash" },
    ],
    name: "processBridgeIn",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ type: "string", name: "ticker" }],
    name: "getWrappedToken",
    outputs: [{ type: "address", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "address", name: "user" }],
    name: "isUserRegistered",
    outputs: [{ type: "bool", name: "" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ORDERBOOK_ABI = [
  {
    inputs: [
      { type: "uint256", name: "batchId" },
      { type: "uint256[]", name: "buyOrderIds" },
      { type: "uint256[]", name: "sellOrderIds" },
      { type: "uint256[]", name: "matchedAmounts" },
      { type: "uint256[]", name: "executionPrices" },
    ],
    name: "processBatch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getCurrentBatch",
    outputs: [
      {
        type: "tuple",
        name: "",
        components: [
          { type: "uint256", name: "batchId" },
          { type: "uint256", name: "startTime" },
          { type: "uint256", name: "endTime" },
          { type: "uint256[]", name: "orderIds" },
          { type: "bool", name: "processed" },
          { type: "uint256", name: "totalOrders" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "orderId" }],
    name: "revealedOrders",
    outputs: [
      {
        type: "tuple",
        name: "",
        components: [
          { type: "address", name: "trader" },
          { type: "address", name: "tokenA" },
          { type: "address", name: "tokenB" },
          { type: "uint256", name: "amount" },
          { type: "uint256", name: "price" },
          { type: "uint256", name: "salt" },
          { type: "uint8", name: "orderType" },
          { type: "uint256", name: "orderId" },
          { type: "uint256", name: "batchId" },
          { type: "bool", name: "executed" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ERC20_ABI = [
  {
    inputs: [{ type: "address", name: "account" }],
    name: "balanceOf",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export interface ContractAddresses {
  bridge: Address;
  orderBook: Address;
  nUSD: Address;
}

export class CitreaService {
  private publicClient;
  private walletClient;
  private account;
  private contracts: ContractAddresses;

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
   * Get wrapped token address for a ticker
   */
  async getWrappedTokenAddress(ticker: string): Promise<Address> {
    try {
      const address = await this.publicClient.readContract({
        address: this.contracts.bridge,
        abi: BRIDGE_ABI,
        functionName: "getWrappedToken",
        args: [ticker],
      });

      return address as Address;
    } catch (error) {
      console.error(
        `❌ Failed to get wrapped token address for ${ticker}:`,
        error
      );
      throw error;
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
   * Get current batch info
   */
  async getCurrentBatch(): Promise<{
    batchId: number;
    startTime: number;
    endTime: number;
    orderIds: number[];
    processed: boolean;
    totalOrders: number;
  }> {
    try {
      const batch = await this.publicClient.readContract({
        address: this.contracts.orderBook,
        abi: ORDERBOOK_ABI,
        functionName: "getCurrentBatch",
      });

      return {
        batchId: Number(batch.batchId),
        startTime: Number(batch.startTime),
        endTime: Number(batch.endTime),
        orderIds: batch.orderIds.map((id) => Number(id)),
        processed: batch.processed,
        totalOrders: Number(batch.totalOrders),
      };
    } catch (error) {
      console.error("❌ Failed to get current batch:", error);
      throw error;
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
}

export default CitreaService;

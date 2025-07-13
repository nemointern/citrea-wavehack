import { EventEmitter } from "events";

export interface RevealedOrder {
  orderId: number;
  trader: string;
  tokenA: string;
  tokenB: string;
  amount: bigint;
  price: bigint; // Price in tokenB per tokenA (scaled by 1e18)
  orderType: "BUY" | "SELL";
  batchId: number;
  timestamp: number;
}

export interface OrderMatch {
  buyOrderId: number;
  sellOrderId: number;
  matchedAmount: bigint;
  executionPrice: bigint;
  timestamp: number;
}

export interface BatchResult {
  batchId: number;
  totalOrders: number;
  totalMatches: number;
  matches: OrderMatch[];
  executionTime: number;
  txHash?: string; // Optional transaction hash for blockchain execution
}

export class MatchingEngine extends EventEmitter {
  private priceFeeds: Map<string, bigint>; // token pair -> reference price
  private readonly PRICE_TOLERANCE = 500n; // 5% tolerance (in basis points * 100)
  private readonly MAX_SLIPPAGE = 1000n; // 10% max slippage

  constructor() {
    super();
    this.priceFeeds = new Map();

    // Initialize with mock prices for hackathon
    this.initializeMockPrices();
  }

  /**
   * Initialize mock price feeds for testing
   */
  private initializeMockPrices(): void {
    // Mock prices (scaled by 1e18)
    this.priceFeeds.set("PEPE/nUSD", 1000000000000000n); // 0.001 nUSD per PEPE
    this.priceFeeds.set("CTRA/nUSD", 10000000000000000n); // 0.01 nUSD per CTRA
    this.priceFeeds.set("nUSD/PEPE", 1000000000000000000000n); // 1000 PEPE per nUSD
    this.priceFeeds.set("nUSD/CTRA", 100000000000000000000n); // 100 CTRA per nUSD

    // Cross pairs for advanced trading
    this.priceFeeds.set("PEPE/CTRA", 100000000000000n); // 0.0001 CTRA per PEPE
    this.priceFeeds.set("CTRA/PEPE", 10000000000000000000000n); // 10000 PEPE per CTRA
  }

  /**
   * Update reference price for a token pair
   */
  updatePrice(tokenPair: string, price: bigint): void {
    this.priceFeeds.set(tokenPair, price);
    console.log(`📊 Updated price for ${tokenPair}: ${price}`);
    this.emit("priceUpdate", { tokenPair, price });
  }

  /**
   * Get reference price for a token pair
   */
  getReferencePrice(tokenA: string, tokenB: string): bigint | null {
    const pair = `${tokenA}/${tokenB}`;
    return this.priceFeeds.get(pair) || null;
  }

  /**
   * Process a batch of revealed orders
   */
  async processBatch(
    batchId: number,
    revealedOrders: RevealedOrder[]
  ): Promise<BatchResult> {
    const startTime = Date.now();
    console.log(
      `🔄 Processing batch ${batchId} with ${revealedOrders.length} orders`
    );

    // Group orders by token pair
    const ordersByPair = this.groupOrdersByPair(revealedOrders);
    const allMatches: OrderMatch[] = [];

    // Process each token pair separately
    for (const [tokenPair, orders] of ordersByPair.entries()) {
      console.log(`💱 Processing ${orders.length} orders for ${tokenPair}`);

      const pairMatches = await this.matchOrdersForPair(orders, tokenPair);
      allMatches.push(...pairMatches);
    }

    const executionTime = Date.now() - startTime;

    const result: BatchResult = {
      batchId,
      totalOrders: revealedOrders.length,
      totalMatches: allMatches.length,
      matches: allMatches,
      executionTime,
    };

    console.log(
      `✅ Batch ${batchId} processed: ${allMatches.length} matches in ${executionTime}ms`
    );
    this.emit("batchProcessed", result);

    return result;
  }

  /**
   * Group orders by token pair
   */
  private groupOrdersByPair(
    orders: RevealedOrder[]
  ): Map<string, RevealedOrder[]> {
    const grouped = new Map<string, RevealedOrder[]>();

    for (const order of orders) {
      const pair = `${order.tokenA}/${order.tokenB}`;
      if (!grouped.has(pair)) {
        grouped.set(pair, []);
      }
      grouped.get(pair)!.push(order);
    }

    return grouped;
  }

  /**
   * Match orders for a specific token pair
   */
  private async matchOrdersForPair(
    orders: RevealedOrder[],
    tokenPair: string
  ): Promise<OrderMatch[]> {
    const matches: OrderMatch[] = [];

    // Separate buy and sell orders
    const buyOrders = orders.filter((order) => order.orderType === "BUY");
    const sellOrders = orders.filter((order) => order.orderType === "SELL");

    // Sort orders for optimal matching
    buyOrders.sort((a, b) => Number(b.price - a.price)); // Highest price first
    sellOrders.sort((a, b) => Number(a.price - b.price)); // Lowest price first

    console.log(
      `  📈 ${buyOrders.length} buy orders, 📉 ${sellOrders.length} sell orders`
    );

    // Get reference price for fair value matching
    const [tokenA, tokenB] = tokenPair.split("/");
    const referencePrice = this.getReferencePrice(tokenA, tokenB);

    if (!referencePrice) {
      console.warn(
        `⚠️ No reference price for ${tokenPair}, using order book matching`
      );
      return this.matchOrdersDirectly(buyOrders, sellOrders);
    }

    // Match orders using reference price with tolerance
    const fairMatches = this.matchOrdersWithReferencePrice(
      buyOrders,
      sellOrders,
      referencePrice
    );

    matches.push(...fairMatches);
    return matches;
  }

  /**
   * Match orders using reference price (fair value matching)
   */
  private matchOrdersWithReferencePrice(
    buyOrders: RevealedOrder[],
    sellOrders: RevealedOrder[],
    referencePrice: bigint
  ): OrderMatch[] {
    const matches: OrderMatch[] = [];
    const usedBuyOrders = new Set<number>();
    const usedSellOrders = new Set<number>();

    // Calculate price bounds
    const minPrice =
      (referencePrice * (10000n - this.PRICE_TOLERANCE)) / 10000n;
    const maxPrice =
      (referencePrice * (10000n + this.PRICE_TOLERANCE)) / 10000n;

    console.log(
      `  💰 Reference price: ${referencePrice}, bounds: [${minPrice}, ${maxPrice}]`
    );

    // Consider all orders for matching (let canMatchOrders decide compatibility)
    const validBuyOrders = buyOrders.filter(
      (order) => !usedBuyOrders.has(order.orderId)
    );
    const validSellOrders = sellOrders.filter(
      (order) => !usedSellOrders.has(order.orderId)
    );

    // Match orders at reference price
    for (const buyOrder of validBuyOrders) {
      if (usedBuyOrders.has(buyOrder.orderId)) continue;

      for (const sellOrder of validSellOrders) {
        if (usedSellOrders.has(sellOrder.orderId)) continue;

        // Check if orders can be matched
        console.log(
          `    🔍 Checking match: Buy ${buyOrder.orderId} (${buyOrder.price}) vs Sell ${sellOrder.orderId} (${sellOrder.price})`
        );
        if (this.canMatchOrders(buyOrder, sellOrder, referencePrice)) {
          const matchedAmount =
            buyOrder.amount <= sellOrder.amount
              ? buyOrder.amount
              : sellOrder.amount;

          const match: OrderMatch = {
            buyOrderId: buyOrder.orderId,
            sellOrderId: sellOrder.orderId,
            matchedAmount,
            executionPrice: referencePrice, // Execute at fair price
            timestamp: Date.now(),
          };

          matches.push(match);
          usedBuyOrders.add(buyOrder.orderId);
          usedSellOrders.add(sellOrder.orderId);

          console.log(
            `  🤝 Matched orders ${buyOrder.orderId} <-> ${sellOrder.orderId} at ${referencePrice}`
          );
          break;
        }
      }
    }

    return matches;
  }

  /**
   * Direct order book matching (without reference price)
   */
  private matchOrdersDirectly(
    buyOrders: RevealedOrder[],
    sellOrders: RevealedOrder[]
  ): OrderMatch[] {
    const matches: OrderMatch[] = [];
    const usedBuyOrders = new Set<number>();
    const usedSellOrders = new Set<number>();

    for (const buyOrder of buyOrders) {
      if (usedBuyOrders.has(buyOrder.orderId)) continue;

      for (const sellOrder of sellOrders) {
        if (usedSellOrders.has(sellOrder.orderId)) continue;

        // Check if buy price >= sell price
        if (buyOrder.price >= sellOrder.price) {
          const matchedAmount =
            buyOrder.amount <= sellOrder.amount
              ? buyOrder.amount
              : sellOrder.amount;

          // Use midpoint price for execution - ensure BigInt arithmetic
          const executionPrice =
            (BigInt(buyOrder.price) + BigInt(sellOrder.price)) / 2n;

          const match: OrderMatch = {
            buyOrderId: buyOrder.orderId,
            sellOrderId: sellOrder.orderId,
            matchedAmount,
            executionPrice,
            timestamp: Date.now(),
          };

          matches.push(match);
          usedBuyOrders.add(buyOrder.orderId);
          usedSellOrders.add(sellOrder.orderId);

          console.log(
            `  🤝 Direct match ${buyOrder.orderId} <-> ${sellOrder.orderId} at ${executionPrice}`
          );
          break;
        }
      }
    }

    return matches;
  }

  /**
   * Check if two orders can be matched at reference price
   */
  private canMatchOrders(
    buyOrder: RevealedOrder,
    sellOrder: RevealedOrder,
    referencePrice: bigint
  ): boolean {
    // Check if orders are for the same token pair
    const tokensMatch =
      buyOrder.tokenA === sellOrder.tokenA &&
      buyOrder.tokenB === sellOrder.tokenB;

    if (!tokensMatch) return false;

    // Check if orders have compatible types
    if (buyOrder.orderType !== "BUY" || sellOrder.orderType !== "SELL") {
      return false;
    }

    // For a match to be possible:
    // - Buy order price should be >= sell order price (willing to pay more than asking)
    // OR both orders should be within tolerance of reference price for fair matching
    const pricesCross = buyOrder.price >= sellOrder.price;

    // Also check if both orders are within tolerance of reference price
    const buyPriceInTolerance =
      buyOrder.price >=
      referencePrice - (referencePrice * this.PRICE_TOLERANCE) / 10000n;
    const sellPriceInTolerance =
      sellOrder.price <=
      referencePrice + (referencePrice * this.PRICE_TOLERANCE) / 10000n;

    return pricesCross || (buyPriceInTolerance && sellPriceInTolerance);
  }

  /**
   * Calculate optimal execution price for a match
   */
  private calculateExecutionPrice(
    buyOrder: RevealedOrder,
    sellOrder: RevealedOrder,
    referencePrice?: bigint
  ): bigint {
    if (referencePrice) {
      return referencePrice;
    }

    // Use midpoint of bid-ask spread
    return (buyOrder.price + sellOrder.price) / 2n;
  }

  /**
   * Get matching statistics
   */
  getMatchingStats(): {
    totalPairs: number;
    availablePrices: string[];
    lastUpdate: number;
  } {
    return {
      totalPairs: this.priceFeeds.size,
      availablePrices: Array.from(this.priceFeeds.keys()),
      lastUpdate: Date.now(),
    };
  }

  /**
   * Simulate order matching (for testing)
   */
  async simulateMatching(orders: RevealedOrder[]): Promise<BatchResult> {
    const mockBatchId = Math.floor(Math.random() * 10000);
    return this.processBatch(mockBatchId, orders);
  }
}

export default MatchingEngine;

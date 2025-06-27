import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import BTCMonitor from "./services/btcMonitor";
import MatchingEngine from "./services/matchingEngine";
import CitreaService from "./services/citreaService";
import BRC20Service from "./services/brc20Service.js";
import BridgeService from "./services/bridgeService.js";
import { CITREA_CONTRACTS } from "./config/contracts";
import { Address } from "viem";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services
let btcMonitor: BTCMonitor;
let matchingEngine: MatchingEngine;
let citreaService: CitreaService;
let brc20Service: BRC20Service;
let bridgeService: BridgeService;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req: any, res: any) => {
  res.json({
    message: "Citrea Wave Hackathon Backend API",
    status: "running",
    timestamp: new Date().toISOString(),
    features: [
      "BTC Bridge Monitor",
      "Dark Pool Matching Engine",
      "Citrea Smart Contract Integration",
    ],
  });
});

app.get("/api/health", async (req: any, res: any) => {
  try {
    const btcStatus = btcMonitor
      ? await btcMonitor.getStatus()
      : { isRunning: false, currentBlock: 0 };
    const matchingStats = matchingEngine?.getMatchingStats() || {
      totalPairs: 0,
    };
    const citreaInfo = citreaService?.getChainInfo() || null;
    const bridgeStatus = bridgeService?.getProcessingStatus() || {
      isProcessing: false,
      pendingRequests: 0,
    };
    const brc20Stats = brc20Service?.getDepositStats() || {
      supportedTokens: ["PEPE", "ORDI", "CTRA"],
      totalDeposits: 0,
    };

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        btcMonitor: btcStatus,
        matchingEngine: matchingStats,
        citrea: citreaInfo,
        bridge: bridgeStatus,
        brc20: brc20Stats,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// BTC Monitor routes
app.post("/api/btc/monitor/address", (req: any, res: any) => {
  try {
    const { address } = req.body;
    if (!address) {
      return res.status(400).json({ error: "Address is required" });
    }

    btcMonitor.addAddress(address);
    res.json({
      success: true,
      message: `Address ${address} added to monitoring`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/btc/monitor/status", async (req: any, res: any) => {
  try {
    if (!btcMonitor) {
      return res.status(503).json({ error: "BTC monitor not initialized" });
    }
    const status = await btcMonitor.getStatus();
    res.json(status);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Bridge routes
app.post("/api/bridge/mint", async (req: any, res: any) => {
  try {
    const { userAddress, ticker, amount, btcTxHash } = req.body;

    if (!userAddress || !ticker || !amount || !btcTxHash) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const txHash = await citreaService.processBridgeMint(
      userAddress as Address,
      ticker,
      amount,
      btcTxHash
    );

    res.json({ success: true, txHash, message: `Minted ${amount} ${ticker}` });
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/bridge/token/:ticker", async (req: any, res: any) => {
  try {
    const { ticker } = req.params;
    const tokenAddress = await citreaService.getWrappedTokenAddress(ticker);
    res.json({ ticker, tokenAddress });
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// New Bridge API endpoints
app.post("/api/bridge/create", async (req: any, res: any) => {
  try {
    const { userId, ticker, toAddress } = req.body;

    if (!userId || !ticker || !toAddress) {
      return res.status(400).json({
        error: "Missing required parameters: userId, ticker, toAddress",
      });
    }

    if (!bridgeService) {
      return res.status(503).json({ error: "Bridge service not initialized" });
    }

    const bridgeRequest = await bridgeService.createBridgeRequest(
      userId,
      ticker,
      toAddress
    );
    res.json({
      success: true,
      ...bridgeRequest,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/bridge/request/:id", (req: any, res: any) => {
  try {
    const { id } = req.params;

    if (!bridgeService) {
      return res.status(503).json({ error: "Bridge service not initialized" });
    }

    const request = bridgeService.getBridgeRequest(id);
    if (!request) {
      return res.status(404).json({ error: "Bridge request not found" });
    }

    res.json(request);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/bridge/user/:userId/requests", (req: any, res: any) => {
  try {
    const { userId } = req.params;

    if (!bridgeService) {
      return res.status(503).json({ error: "Bridge service not initialized" });
    }

    const requests = bridgeService.getUserBridgeRequests(userId);
    res.json({ userId, requests });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/bridge/stats", (req: any, res: any) => {
  try {
    if (!bridgeService) {
      return res.json({
        totalRequests: 0,
        completed: 0,
        pending: 0,
        failed: 0,
        totalVolume: {},
        message: "Bridge service not initialized - demo mode",
      });
    }

    const stats = bridgeService.getBridgeStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/bridge/status", (req: any, res: any) => {
  try {
    if (!bridgeService) {
      return res.json({
        isProcessing: false,
        lastUpdate: new Date().toISOString(),
        pendingRequests: 0,
        recentActivity: [],
        message: "Bridge service not initialized",
      });
    }

    const status = bridgeService.getProcessingStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// BRC20 API endpoints
app.get("/api/brc20/token/:ticker/info", async (req: any, res: any) => {
  try {
    const { ticker } = req.params;

    if (!brc20Service) {
      return res.status(503).json({ error: "BRC20 service not initialized" });
    }

    const tokenInfo = await brc20Service.getTokenInfo(ticker);
    if (!tokenInfo) {
      return res.status(404).json({ error: `Token ${ticker} not found` });
    }

    res.json(tokenInfo);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/brc20/address/:address/history", async (req: any, res: any) => {
  try {
    const { address } = req.params;
    const { ticker } = req.query;

    if (!brc20Service) {
      return res.status(503).json({ error: "BRC20 service not initialized" });
    }

    const history = await brc20Service.getBRC20History(
      address,
      ticker as string
    );
    res.json({ address, ticker: ticker || "all", history });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/brc20/deposits/stats", (req: any, res: any) => {
  try {
    if (!brc20Service) {
      return res.json({
        totalDeposits: 0,
        processedTransfers: 0,
        pendingDeposits: 0,
        supportedTokens: ["PEPE", "ORDI", "CTRA"],
        message: "BRC20 service not initialized - demo mode",
      });
    }

    const stats = brc20Service.getDepositStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Dark Pool routes
app.get("/api/darkpool/batch/current", async (req: any, res: any) => {
  try {
    if (!citreaService) {
      return res.json({
        batchId: 1,
        phase: "COMMIT",
        timeRemaining: 300,
        ordersCommitted: 0,
        message: "Smart contracts not deployed - demo mode",
      });
    }
    const currentBatch = await citreaService.getCurrentBatch();
    res.json(currentBatch);
  } catch (error) {
    // Return demo data if contracts aren't deployed
    res.json({
      batchId: 1,
      phase: "COMMIT",
      timeRemaining: 300,
      ordersCommitted: 0,
      message: "Smart contracts not deployed - demo mode",
    });
  }
});

app.post("/api/darkpool/batch/process", async (req: any, res: any) => {
  try {
    const { batchId, orders } = req.body;

    if (!batchId || !orders) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Process matching
    const batchResult = await matchingEngine.processBatch(batchId, orders);

    // Execute on blockchain if there are matches
    if (batchResult.matches.length > 0) {
      const buyOrderIds = batchResult.matches.map((m) => m.buyOrderId);
      const sellOrderIds = batchResult.matches.map((m) => m.sellOrderId);
      const matchedAmounts = batchResult.matches.map((m) => m.matchedAmount);
      const executionPrices = batchResult.matches.map((m) => m.executionPrice);

      const txHash = await citreaService.processDarkPoolBatch(
        batchId,
        buyOrderIds,
        sellOrderIds,
        matchedAmounts,
        executionPrices
      );

      batchResult.txHash = txHash;
    }

    res.json(batchResult);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/darkpool/matching/stats", (req: any, res: any) => {
  try {
    const stats = matchingEngine.getMatchingStats();
    res.json(stats);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Order management endpoints
interface OrderSubmission {
  tokenA: string;
  tokenB: string;
  amount: string;
  price: string;
  orderType: "BUY" | "SELL";
  userAddress?: string;
}

interface UserOrder {
  orderId: number;
  batchId: number;
  tokenA: string;
  tokenB: string;
  amount: string;
  price: string;
  orderType: "BUY" | "SELL";
  status: "COMMITTED" | "REVEALED" | "MATCHED" | "FAILED";
  commitHash?: string;
  salt?: string;
  timestamp: number;
  trader: string;
}

// In-memory storage for orders (in production, use database)
const userOrders: Map<string, UserOrder[]> = new Map();
let nextOrderId = 1;

function generateSalt(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

function generateCommitHash(orderData: OrderSubmission, salt: string): string {
  const dataStr = `${orderData.tokenA}-${orderData.tokenB}-${orderData.amount}-${orderData.price}-${orderData.orderType}-${salt}`;
  // Simple hash for demo (in production, use proper cryptographic hash)
  return Buffer.from(dataStr).toString("base64");
}

app.post("/api/darkpool/order/submit", async (req: any, res: any) => {
  try {
    const orderData: OrderSubmission = req.body;
    const { tokenA, tokenB, amount, price, orderType, userAddress } = orderData;

    if (!tokenA || !tokenB || !amount || !price || !orderType) {
      return res.status(400).json({
        error:
          "Missing required parameters: tokenA, tokenB, amount, price, orderType",
      });
    }

    // For demo purposes, always allow order submission
    const currentBatch = {
      batchId: 1,
      phase: "COMMIT",
    };

    console.log(`📋 Current batch phase: ${currentBatch.phase}`);

    if (currentBatch.phase !== "COMMIT") {
      return res.status(400).json({
        error: "Orders can only be submitted during COMMIT phase",
        currentPhase: currentBatch.phase,
      });
    }

    const salt = generateSalt();
    const commitHash = generateCommitHash(orderData, salt);
    const trader = userAddress || `trader_${nextOrderId}`;

    const newOrder: UserOrder = {
      orderId: nextOrderId++,
      batchId: currentBatch.batchId,
      tokenA,
      tokenB,
      amount,
      price,
      orderType: orderType as "BUY" | "SELL",
      status: "COMMITTED",
      commitHash,
      salt,
      timestamp: Date.now(),
      trader,
    };

    // Store order
    if (!userOrders.has(trader)) {
      userOrders.set(trader, []);
    }
    userOrders.get(trader)!.push(newOrder);

    console.log(
      `📝 Order submitted: ${newOrder.orderId} (${orderType} ${amount} ${tokenA} for ${price} ${tokenB})`
    );

    res.json({
      orderId: newOrder.orderId,
      batchId: newOrder.batchId,
      commitHash,
      salt, // Return salt for reveal phase
      success: true,
      message: `Order ${newOrder.orderId} committed successfully`,
    });
  } catch (error) {
    console.error("❌ Error submitting order:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/darkpool/orders/user/:userAddress", (req: any, res: any) => {
  try {
    const { userAddress } = req.params;

    const orders = userOrders.get(userAddress) || [];

    res.json({
      orders: orders.map((order) => ({
        orderId: order.orderId,
        batchId: order.batchId,
        tokenA: order.tokenA,
        tokenB: order.tokenB,
        amount: order.amount,
        price: order.price,
        orderType: order.orderType,
        status: order.status,
        commitHash: order.commitHash,
        timestamp: order.timestamp,
        trader: order.trader,
      })),
      count: orders.length,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/darkpool/order/reveal", (req: any, res: any) => {
  try {
    const { orderId, salt, amount, price } = req.body;

    if (!orderId || !salt || !amount || !price) {
      return res.status(400).json({
        error: "Missing required parameters: orderId, salt, amount, price",
      });
    }

    // Find the order
    let foundOrder: UserOrder | null = null;
    let userKey: string | null = null;

    for (const [user, orders] of userOrders.entries()) {
      const order = orders.find((o) => o.orderId === orderId);
      if (order) {
        foundOrder = order;
        userKey = user;
        break;
      }
    }

    if (!foundOrder || !userKey) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (foundOrder.status !== "COMMITTED") {
      return res.status(400).json({
        error: `Order ${orderId} cannot be revealed, current status: ${foundOrder.status}`,
      });
    }

    // Verify the reveal data matches the commitment
    const expectedHash = generateCommitHash(
      {
        tokenA: foundOrder.tokenA,
        tokenB: foundOrder.tokenB,
        amount,
        price,
        orderType: foundOrder.orderType,
      },
      salt
    );

    if (expectedHash !== foundOrder.commitHash) {
      return res.status(400).json({
        error: "Invalid reveal data - does not match commitment hash",
      });
    }

    // Update order status
    foundOrder.status = "REVEALED";

    console.log(
      `🎭 Order revealed: ${orderId} (${foundOrder.orderType} ${amount} ${foundOrder.tokenA})`
    );

    res.json({
      success: true,
      message: `Order ${orderId} revealed successfully`,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/darkpool/order/cancel", (req: any, res: any) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: "Missing orderId parameter" });
    }

    // Find and remove the order
    let found = false;

    for (const [user, orders] of userOrders.entries()) {
      const orderIndex = orders.findIndex((o) => o.orderId === orderId);
      if (orderIndex !== -1) {
        const order = orders[orderIndex];

        if (order.status === "MATCHED") {
          return res.status(400).json({
            error: "Cannot cancel matched order",
          });
        }

        orders.splice(orderIndex, 1);
        found = true;

        console.log(`❌ Order cancelled: ${orderId}`);
        break;
      }
    }

    if (!found) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({
      success: true,
      message: `Order ${orderId} cancelled successfully`,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Test routes
app.get("/api/test/contracts", async (req: any, res: any) => {
  try {
    if (!citreaService) {
      return res.status(500).json({ error: "Citrea service not initialized" });
    }

    const testResults = await citreaService.testContracts();
    res.json({
      success: true,
      results: testResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Wallet routes
app.get("/api/wallet/:address/balance/:token", async (req: any, res: any) => {
  try {
    const { address, token } = req.params;

    if (!citreaService) {
      return res.json({
        address,
        token,
        balance: "0",
        message: "Smart contracts not deployed - demo mode",
      });
    }

    let balance: bigint;
    if (token.toLowerCase() === "nusd") {
      balance = await citreaService.getNUSDBalance(address as Address);
    } else {
      const tokenAddress = await citreaService.getWrappedTokenAddress(token);
      balance = await citreaService.getTokenBalance(
        tokenAddress,
        address as Address
      );
    }

    res.json({ address, token, balance: balance.toString() });
  } catch (error) {
    // Return demo balance if contracts aren't deployed or address is invalid
    res.json({
      address: req.params.address,
      token: req.params.token,
      balance: "0",
      message: "Smart contracts not deployed or invalid address - demo mode",
    });
  }
});

// Initialize services
async function initializeServices() {
  try {
    console.log("🔧 Initializing services...");

    // Initialize BTC Monitor
    btcMonitor = new BTCMonitor();

    // Initialize Matching Engine
    matchingEngine = new MatchingEngine();

    // Initialize BRC20 Service
    brc20Service = new BRC20Service();
    await brc20Service.createMockTokens(); // Create mock tokens for testing

    // Initialize Citrea Service (if private key is provided)
    if (process.env.PRIVATE_KEY) {
      citreaService = new CitreaService(
        process.env.PRIVATE_KEY,
        CITREA_CONTRACTS
      );
    }

    // Initialize Bridge Service (requires both BRC20 and Citrea services)
    if (brc20Service && citreaService) {
      bridgeService = new BridgeService(brc20Service, citreaService);
      await bridgeService.startProcessing();
      console.log("🌉 Bridge service started");
    } else {
      console.log("⚠️ Bridge service not started - missing dependencies");
    }

    // Set up comprehensive event listeners
    btcMonitor.on("brc20Transfer", async (transfer) => {
      console.log("🎯 BRC20 Transfer detected:", transfer);

      // Auto-process bridge mint if citrea service is available
      if (citreaService) {
        try {
          await citreaService.processBridgeMint(
            transfer.toAddress as Address,
            transfer.ticker,
            transfer.amount,
            transfer.txHash
          );
          console.log(`✅ Auto-processed bridge mint for ${transfer.ticker}`);
        } catch (error: any) {
          console.error("❌ Failed to auto-process bridge mint:", error);
        }
      }
    });

    matchingEngine.on("batchProcessed", (result) => {
      console.log(
        `📊 Batch ${result.batchId} processed: ${result.totalMatches} matches`
      );
    });

    // Bridge service event listeners
    if (bridgeService) {
      bridgeService.on("depositDetected", (event) => {
        console.log(`💰 Bridge deposit detected: ${event.bridgeRequestId}`);
        // Could trigger notifications here
      });

      bridgeService.on("bridgeCompleted", (event) => {
        console.log(
          `✅ Bridge completed: ${event.amount} ${event.ticker} → w${event.ticker}`
        );
        console.log(`📝 Citrea TX: ${event.citreaTxHash}`);
        // Could trigger success notifications here
      });

      bridgeService.on("bridgeFailed", (event) => {
        console.error(
          `❌ Bridge failed: ${event.bridgeRequestId} - ${event.error}`
        );
        // Could trigger error notifications here
      });
    }

    // Start BTC monitoring
    await btcMonitor.startMonitoring();

    console.log("✅ All services initialized successfully");
  } catch (error: any) {
    console.error("❌ Failed to initialize services:", error);
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  await initializeServices();
});

export default app;

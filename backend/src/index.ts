import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import BTCMonitor from "./services/btcMonitor";
import MatchingEngine from "./services/matchingEngine";
import CitreaService from "./services/citreaService";
import BRC20Service from "./services/brc20Service";
import BridgeService from "./services/bridgeService";
import { CITREA_CONTRACTS } from "./config/contracts";
import { Address } from "viem";
import { setupSwagger } from "./swagger-setup";

// Fix BigInt serialization for JSON responses
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

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

// CORS Configuration for Production
const getAllowedOrigins = () => {
  if (process.env.NODE_ENV === "production") {
    const origins = [
      "https://nocturne-ivory.vercel.app",
      /\.vercel\.app$/,
      /\.netlify\.app$/,
    ];

    // Add custom origins from environment variable
    if (process.env.ALLOWED_ORIGINS) {
      const customOrigins = process.env.ALLOWED_ORIGINS.split(",");
      origins.push(...customOrigins);
    }

    return origins;
  }

  return ["http://localhost:5173", "http://localhost:3000"];
};

const corsOptions = {
  origin: getAllowedOrigins(),
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "Cache-Control",
    "X-Cache-Date",
  ],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

setupSwagger(app);

// Routes
/**
 * @swagger
 * /:
 *   get:
 *     summary: Get API status and information
 *     tags: [Health]
 *     description: Returns basic information about the API and its features
 *     responses:
 *       200:
 *         description: API information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Citrea Wave Hackathon Backend API"
 *                 status:
 *                   type: string
 *                   example: "running"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 features:
 *                   type: array
 *                   items:
 *                     type: string
 */
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
    documentation: "/api-docs",
  });
});

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Get system health status
 *     tags: [Health]
 *     description: Returns comprehensive health status of all system services
 *     responses:
 *       200:
 *         description: System health information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 services:
 *                   type: object
 *                   properties:
 *                     btcMonitor:
 *                       type: object
 *                       properties:
 *                         isRunning:
 *                           type: boolean
 *                         currentBlock:
 *                           type: integer
 *                     matchingEngine:
 *                       $ref: '#/components/schemas/MatchingStats'
 *                     citrea:
 *                       type: object
 *                     bridge:
 *                       type: object
 *                       properties:
 *                         isProcessing:
 *                           type: boolean
 *                         pendingRequests:
 *                           type: integer
 *                     brc20:
 *                       $ref: '#/components/schemas/BRC20Stats'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
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
      supportedTokens: ["PEPE", "CTRA"],
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

/**
 * @swagger
 * /api/bridge/token/{ticker}:
 *   get:
 *     summary: Get wrapped token address
 *     tags: [Bridge]
 *     description: Returns the Citrea address of a wrapped BRC20 token
 *     parameters:
 *       - in: path
 *         name: ticker
 *         required: true
 *         schema:
 *           type: string
 *         description: BRC20 token ticker symbol
 *         example: "PEPE"
 *     responses:
 *       200:
 *         description: Wrapped token address
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ticker:
 *                   type: string
 *                   example: "PEPE"
 *                 tokenAddress:
 *                   type: string
 *                   example: "0x123...abc"
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
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
/**
 * @swagger
 * /api/bridge/create:
 *   post:
 *     summary: Create a new bridge request
 *     tags: [Bridge]
 *     description: Creates a new cross-chain bridge request for BRC20 tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, ticker, toAddress]
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User identifier
 *                 example: "user123"
 *               ticker:
 *                 type: string
 *                 description: BRC20 token ticker
 *                 example: "PEPE"
 *               toAddress:
 *                 type: string
 *                 description: Destination address on target chain
 *                 example: "0x123...abc"
 *     responses:
 *       200:
 *         description: Bridge request created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 id:
 *                   type: string
 *                   description: Bridge request ID
 *                 depositAddress:
 *                   type: string
 *                   description: Bitcoin address for deposits
 *                 status:
 *                   type: string
 *                   example: "pending"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       503:
 *         description: Bridge service not initialized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
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

/**
 * @swagger
 * /api/bridge/stats:
 *   get:
 *     summary: Get bridge statistics
 *     tags: [Bridge]
 *     description: Returns comprehensive statistics about bridge operations
 *     responses:
 *       200:
 *         description: Bridge statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalRequests:
 *                   type: integer
 *                   description: Total number of bridge requests
 *                   example: 150
 *                 completed:
 *                   type: integer
 *                   description: Number of completed bridge requests
 *                   example: 145
 *                 pending:
 *                   type: integer
 *                   description: Number of pending bridge requests
 *                   example: 3
 *                 failed:
 *                   type: integer
 *                   description: Number of failed bridge requests
 *                   example: 2
 *                 totalVolume:
 *                   type: object
 *                   description: Total volume bridged by token
 *                   additionalProperties:
 *                     type: string
 *                   example:
 *                     PEPE: "1000000000000000000000"
 *                     CTRA: "500000000000000000000"
 *                 message:
 *                   type: string
 *                   description: Status message
 *                   example: "Bridge service running normally"
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
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

/**
 * @swagger
 * /api/bridge/status:
 *   get:
 *     summary: Get bridge processing status
 *     tags: [Bridge]
 *     description: Returns current status of the cross-chain bridge processing
 *     responses:
 *       200:
 *         description: Bridge processing status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isProcessing:
 *                   type: boolean
 *                   description: Whether bridge is currently processing requests
 *                   example: true
 *                 lastUpdate:
 *                   type: string
 *                   format: date-time
 *                   description: Last processing update timestamp
 *                 pendingRequests:
 *                   type: integer
 *                   description: Number of pending bridge requests
 *                   example: 5
 *                 recentActivity:
 *                   type: array
 *                   description: Recent bridge activities
 *                   items:
 *                     type: object
 *                 message:
 *                   type: string
 *                   description: Status message
 *                   example: "Bridge service running normally"
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
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
/**
 * @swagger
 * /api/brc20/token/{ticker}/info:
 *   get:
 *     summary: Get BRC20 token information
 *     tags: [BRC20]
 *     description: Returns detailed information about a specific BRC20 token
 *     parameters:
 *       - in: path
 *         name: ticker
 *         required: true
 *         schema:
 *           type: string
 *         description: BRC20 token ticker symbol
 *         example: "PEPE"
 *     responses:
 *       200:
 *         description: BRC20 token information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ticker:
 *                   type: string
 *                   example: "PEPE"
 *                 totalSupply:
 *                   type: string
 *                   example: "420690000000000"
 *                 decimals:
 *                   type: string
 *                   example: "18"
 *                 deployBy:
 *                   type: string
 *                   example: "0x123..."
 *                 deployTime:
 *                   type: integer
 *                   example: 1640995200
 *                 holders:
 *                   type: integer
 *                   example: 1337
 *       404:
 *         description: Token not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token PEPE not found"
 *       503:
 *         description: BRC20 service not initialized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
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

/**
 * @swagger
 * /api/brc20/address/{address}/history:
 *   get:
 *     summary: Get BRC20 transaction history for an address
 *     tags: [BRC20]
 *     description: Returns BRC20 transaction history for a specific address, optionally filtered by ticker
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Bitcoin address to query
 *         example: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"
 *       - in: query
 *         name: ticker
 *         schema:
 *           type: string
 *         description: Optional BRC20 token ticker to filter by
 *         example: "PEPE"
 *     responses:
 *       200:
 *         description: BRC20 transaction history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 address:
 *                   type: string
 *                   example: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"
 *                 ticker:
 *                   type: string
 *                   example: "PEPE"
 *                 history:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       txid:
 *                         type: string
 *                       blockHeight:
 *                         type: integer
 *                       ticker:
 *                         type: string
 *                       amount:
 *                         type: string
 *                       from:
 *                         type: string
 *                       to:
 *                         type: string
 *                       timestamp:
 *                         type: integer
 *       503:
 *         description: BRC20 service not initialized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
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

/**
 * @swagger
 * /api/brc20/deposits/stats:
 *   get:
 *     summary: Get BRC20 deposit statistics
 *     tags: [BRC20]
 *     description: Returns statistics about BRC20 deposits and supported tokens
 *     responses:
 *       200:
 *         description: BRC20 deposit statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BRC20Stats'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
app.get("/api/brc20/deposits/stats", (req: any, res: any) => {
  try {
    if (!brc20Service) {
      return res.json({
        totalDeposits: 0,
        processedTransfers: 0,
        pendingDeposits: 0,
        supportedTokens: ["PEPE", "CTRA"],
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

/**
 * @swagger
 * /api/darkpool/batch/process:
 *   post:
 *     summary: Process a batch of revealed orders
 *     tags: [Batches]
 *     description: Execute matching algorithm on revealed orders and submit results to blockchain
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [batchId, orders]
 *             properties:
 *               batchId:
 *                 type: integer
 *                 description: Batch identifier
 *                 example: 17
 *               orders:
 *                 type: array
 *                 description: Array of revealed orders to match
 *                 items:
 *                   type: object
 *                   properties:
 *                     orderId:
 *                       type: integer
 *                       example: 123
 *                     trader:
 *                       type: string
 *                       example: "0x123..."
 *                     tokenA:
 *                       type: string
 *                       example: "PEPE"
 *                     tokenB:
 *                       type: string
 *                       example: "nUSD"
 *                     amount:
 *                       type: string
 *                       example: "1000000000000000000000"
 *                     price:
 *                       type: string
 *                       example: "1200000000000000"
 *                     orderType:
 *                       type: string
 *                       enum: [BUY, SELL]
 *                     batchId:
 *                       type: integer
 *                       example: 17
 *                     timestamp:
 *                       type: integer
 *                       example: 1752403325000
 *     responses:
 *       200:
 *         description: Batch processing results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 batchId:
 *                   type: integer
 *                   example: 17
 *                 totalOrders:
 *                   type: integer
 *                   example: 5
 *                 totalMatches:
 *                   type: integer
 *                   example: 2
 *                 totalVolume:
 *                   type: string
 *                   example: "500000000000000000000"
 *                 matches:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       buyOrderId:
 *                         type: integer
 *                       sellOrderId:
 *                         type: integer
 *                       matchedAmount:
 *                         type: string
 *                       executionPrice:
 *                         type: string
 *                 txHash:
 *                   type: string
 *                   description: Blockchain transaction hash (if executed)
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
app.post("/api/darkpool/batch/process", async (req: any, res: any) => {
  try {
    const { batchId, orders } = req.body;

    if (!batchId || !orders) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Convert orders to RevealedOrder format with BigInt values
    const revealedOrders = orders.map((order: any) => ({
      ...order,
      amount: BigInt(order.amount),
      price: BigInt(order.price),
    }));

    // Process matching
    const batchResult = await matchingEngine.processBatch(
      batchId,
      revealedOrders
    );

    // Execute on blockchain if there are matches
    if (batchResult.matches.length > 0) {
      const buyOrderIds = batchResult.matches.map((m) => m.buyOrderId);
      const sellOrderIds = batchResult.matches.map((m) => m.sellOrderId);
      const matchedAmounts = batchResult.matches.map((m) => m.matchedAmount);
      const executionPrices = batchResult.matches.map((m) => m.executionPrice);

      try {
        const txHash = await citreaService.processDarkPoolBatch(
          batchId,
          buyOrderIds,
          sellOrderIds,
          matchedAmounts,
          executionPrices
        );
        batchResult.txHash = txHash;
      } catch (contractError) {
        console.error(
          "❌ Contract execution failed, but matching succeeded:",
          contractError
        );
        // Continue with the successful matching result
      }
    }

    // Convert BigInt values to strings for JSON serialization
    const serializedResult = {
      ...batchResult,
      matches: batchResult.matches.map((match) => ({
        ...match,
        matchedAmount: match.matchedAmount.toString(),
        executionPrice: match.executionPrice.toString(),
      })),
    };

    res.json(serializedResult);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * @swagger
 * /api/darkpool/matching/stats:
 *   get:
 *     summary: Get dark pool matching engine statistics
 *     tags: [Dark Pool]
 *     description: Returns comprehensive statistics about the matching engine performance
 *     responses:
 *       200:
 *         description: Matching engine statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MatchingStats'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
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

// Create new batch endpoint
/**
 * @swagger
 * /api/darkpool/batch/create:
 *   post:
 *     summary: Create a new dark pool batch
 *     tags: [Batches]
 *     description: Creates a new batch on the blockchain for order submissions
 *     responses:
 *       200:
 *         description: Batch created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "New batch created successfully"
 *                 txHash:
 *                   type: string
 *                   description: Transaction hash
 *                   example: "0xabc123..."
 *                 explorerUrl:
 *                   type: string
 *                   description: Block explorer URL
 *                   example: "https://explorer.testnet.citrea.xyz/tx/0xabc123..."
 *       500:
 *         $ref: '#/components/responses/InternalError'
 *       503:
 *         description: Service unavailable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Citrea service not available"
 */
app.post("/api/darkpool/batch/create", async (req: any, res: any) => {
  try {
    if (!citreaService) {
      return res.status(503).json({
        error: "Citrea service not available",
      });
    }

    const txHash = await citreaService.createNewBatch();

    res.json({
      success: true,
      message: "New batch created successfully",
      txHash,
      explorerUrl: `https://explorer.testnet.citrea.xyz/tx/${txHash}`,
    });
  } catch (error) {
    console.error("❌ Error creating batch:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
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
  // Match the smart contract hash: keccak256(abi.encodePacked(amount, price, salt, orderType))
  const { keccak256, encodePacked } = require("viem");

  try {
    // Convert values to proper types for abi.encodePacked
    const amount = BigInt(parseFloat(orderData.amount) * 1e18);
    const price = BigInt(parseFloat(orderData.price) * 1e18);
    // Convert salt string to uint256
    const saltBigInt = BigInt(
      `0x${Buffer.from(salt).toString("hex").padStart(64, "0").slice(0, 64)}`
    );
    const orderType = orderData.orderType === "BUY" ? 0 : 1;

    // Use encodePacked to match abi.encodePacked exactly
    const packed = encodePacked(
      ["uint256", "uint256", "uint256", "uint8"],
      [amount, price, saltBigInt, orderType]
    );

    // Generate keccak256 hash
    const hash = keccak256(packed);
    console.log(
      `📝 Generated commitment hash: ${hash} for ${orderData.orderType} ${orderData.amount} ${orderData.tokenA}`
    );
    return hash;
  } catch (error) {
    console.error("❌ Error generating commitment hash:", error);
    // Fallback to simple hash
    const dataStr = `${orderData.tokenA}-${orderData.tokenB}-${orderData.amount}-${orderData.price}-${orderData.orderType}-${salt}`;
    const fallbackHash = `0x${Buffer.from(dataStr)
      .toString("hex")
      .padStart(64, "0")
      .slice(0, 64)}`;
    console.log(`📝 Using fallback hash: ${fallbackHash}`);
    return fallbackHash;
  }
}

/**
 * @swagger
 * /api/darkpool/order/submit:
 *   post:
 *     summary: Submit a new order to the dark pool
 *     tags: [Orders]
 *     description: Submit an order commitment to the current batch (only during COMMIT phase)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Order'
 *     responses:
 *       200:
 *         description: Order submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orderId:
 *                   type: integer
 *                   description: Generated order ID
 *                   example: 123
 *                 batchId:
 *                   type: integer
 *                   description: Current batch ID
 *                   example: 17
 *                 commitHash:
 *                   type: string
 *                   description: Order commitment hash
 *                   example: "0xdef456..."
 *                 salt:
 *                   type: string
 *                   description: Salt for revealing later
 *                   example: "random_salt_123"
 *                 txHash:
 *                   type: string
 *                   description: Blockchain transaction hash
 *                   example: "0xabc123..."
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Order 123 committed successfully on-chain"
 *                 explorerUrl:
 *                   type: string
 *                   description: Block explorer URL
 *                   example: "https://explorer.testnet.citrea.xyz/tx/0xabc123..."
 *       400:
 *         description: Bad request - missing parameters or wrong phase
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Orders can only be submitted during COMMIT phase"
 *                 currentPhase:
 *                   type: string
 *                   example: "reveal"
 *       503:
 *         description: Service unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

    if (!citreaService) {
      return res.status(503).json({
        error: "Citrea service not available - smart contracts not deployed",
      });
    }

    // Get current batch status from smart contract
    const currentBatch = await citreaService.getCurrentBatch();
    console.log(`📋 Current batch phase: ${currentBatch.phase}`);

    if (currentBatch.phase !== "commit") {
      return res.status(400).json({
        error: "Orders can only be submitted during COMMIT phase",
        currentPhase: currentBatch.phase,
      });
    }

    const salt = generateSalt();
    const commitHash = generateCommitHash(orderData, salt);
    const trader = userAddress || `trader_${nextOrderId}`;

    try {
      // COMMIT ORDER ON-CHAIN (only need the commitment hash)
      const { orderId, txHash } = await citreaService.commitOrder(commitHash);

      // Store order locally for frontend tracking
      const newOrder: UserOrder = {
        orderId,
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

      if (!userOrders.has(trader)) {
        userOrders.set(trader, []);
      }
      userOrders.get(trader)!.push(newOrder);

      console.log(
        `✅ Order submitted ON-CHAIN: ${orderId} (${orderType} ${amount} ${tokenA} for ${price} ${tokenB}) TX: ${txHash}`
      );

      res.json({
        orderId,
        batchId: currentBatch.batchId,
        commitHash,
        salt,
        txHash,
        success: true,
        message: `Order ${orderId} committed successfully on-chain`,
        explorerUrl: `https://explorer.testnet.citrea.xyz/tx/${txHash}`,
      });
    } catch (contractError) {
      console.error("❌ Smart contract error:", contractError);

      // Fallback to off-chain for demo if contract fails
      const newOrder: UserOrder = {
        orderId: nextOrderId++,
        batchId: currentBatch.batchId || 1,
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

      if (!userOrders.has(trader)) {
        userOrders.set(trader, []);
      }
      userOrders.get(trader)!.push(newOrder);

      res.json({
        orderId: newOrder.orderId,
        batchId: newOrder.batchId,
        commitHash,
        salt,
        success: true,
        message: `Order ${newOrder.orderId} committed (demo mode - contract unavailable)`,
        warning: "Smart contract not available, using demo mode",
      });
    }
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

app.post("/api/darkpool/order/reveal", async (req: any, res: any) => {
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

    if (citreaService) {
      try {
        // REVEAL ORDER ON-CHAIN
        const tokenAAddress = citreaService.getTokenAddress(foundOrder.tokenA);
        const tokenBAddress = citreaService.getTokenAddress(foundOrder.tokenB);
        const amountWei = BigInt(parseFloat(amount) * 1e18);
        const priceWei = BigInt(parseFloat(price) * 1e18);
        // Convert salt to uint256 (same format as commitment hash generation)
        const saltBigInt = BigInt(
          `0x${Buffer.from(salt)
            .toString("hex")
            .padStart(64, "0")
            .slice(0, 64)}`
        );
        const orderType = foundOrder.orderType === "BUY" ? 0 : 1;

        const txHash = await citreaService.revealOrder(
          orderId,
          tokenAAddress,
          tokenBAddress,
          amountWei,
          priceWei,
          saltBigInt,
          orderType
        );

        // Update order status
        foundOrder.status = "REVEALED";

        console.log(
          `✅ Order revealed ON-CHAIN: ${orderId} (${foundOrder.orderType} ${amount} ${foundOrder.tokenA}) TX: ${txHash}`
        );

        res.json({
          success: true,
          message: `Order ${orderId} revealed successfully on-chain`,
          txHash,
          explorerUrl: `https://explorer.testnet.citrea.xyz/tx/${txHash}`,
        });
      } catch (contractError) {
        console.error("❌ Smart contract reveal error:", contractError);

        // Fallback to off-chain update
        foundOrder.status = "REVEALED";

        res.json({
          success: true,
          message: `Order ${orderId} revealed (demo mode - contract unavailable)`,
          warning: "Smart contract not available, using demo mode",
        });
      }
    } else {
      // No smart contract service available
      foundOrder.status = "REVEALED";

      console.log(
        `🎭 Order revealed (demo): ${orderId} (${foundOrder.orderType} ${amount} ${foundOrder.tokenA})`
      );

      res.json({
        success: true,
        message: `Order ${orderId} revealed successfully (demo mode)`,
        warning: "Smart contract not available, using demo mode",
      });
    }
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

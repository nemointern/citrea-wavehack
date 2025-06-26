import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import BTCMonitor from "./services/btcMonitor";
import MatchingEngine from "./services/matchingEngine";
import CitreaService from "./services/citreaService";
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

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        btcMonitor: btcStatus,
        matchingEngine: matchingStats,
        citrea: citreaInfo,
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

    // Initialize Citrea Service (if private key is provided)
    if (process.env.PRIVATE_KEY) {
      citreaService = new CitreaService(
        process.env.PRIVATE_KEY,
        CITREA_CONTRACTS
      );
    }

    // Set up event listeners
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

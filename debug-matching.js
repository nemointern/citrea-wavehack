// Debug Order Matching System
// Run this script to test order matching end-to-end

const axios = require("axios");

const API_BASE = "http://3.71.41.71:3001/api"; //  backend URL

async function debugOrderMatching() {
  console.log("🔍 === ORDER MATCHING DEBUG SESSION ===\n");

  try {
    // Step 1: Check current batch status
    console.log("📊 Step 1: Checking current batch status...");
    const batchResponse = await axios.get(`${API_BASE}/darkpool/batch/current`);
    const currentBatch = batchResponse.data;

    console.log(`Current Batch: ${currentBatch.batchId}`);
    console.log(`Phase: ${currentBatch.phase}`);
    console.log(`Time Remaining: ${currentBatch.timeRemaining}s`);
    console.log(`Orders Committed: ${currentBatch.ordersCommitted || 0}\n`);

    // Step 2: Check matching engine stats
    console.log("🔧 Step 2: Checking matching engine stats...");
    const statsResponse = await axios.get(
      `${API_BASE}/darkpool/matching/stats`
    );
    const stats = statsResponse.data;

    console.log(`Total Orders: ${stats.totalOrders}`);
    console.log(`Total Matches: ${stats.totalMatches}`);
    console.log(`Total Pairs: ${stats.totalPairs}\n`);

    // Step 3: Test order submission (if in COMMIT phase)
    if (currentBatch.phase === "commit" || currentBatch.phase === "COMMIT") {
      console.log("💰 Step 3: Testing order submission...");

      // Create test BUY order
      const buyOrder = {
        tokenA: "nUSD",
        tokenB: "wPEPE",
        amount: "100",
        price: "0.01",
        orderType: "BUY",
        userAddress: "0x1234567890123456789012345678901234567890",
      };

      // Create test SELL order
      const sellOrder = {
        tokenA: "nUSD",
        tokenB: "wPEPE",
        amount: "100",
        price: "0.01",
        orderType: "SELL",
        userAddress: "0x9876543210987654321098765432109876543210",
      };

      try {
        console.log("Creating BUY order...");
        const buyResponse = await axios.post(
          `${API_BASE}/darkpool/order/submit`,
          buyOrder
        );
        console.log(
          `✅ BUY Order created: ID ${buyResponse.data.orderId}, Hash: ${buyResponse.data.commitHash}`
        );

        console.log("Creating SELL order...");
        const sellResponse = await axios.post(
          `${API_BASE}/darkpool/order/submit`,
          sellOrder
        );
        console.log(
          `✅ SELL Order created: ID ${sellResponse.data.orderId}, Hash: ${sellResponse.data.commitHash}`
        );

        console.log(
          "\n🔄 Orders created! Wait for REVEAL phase to reveal them."
        );
        console.log("💡 During REVEAL phase, call:");
        console.log(`POST ${API_BASE}/darkpool/order/reveal`);
        console.log(
          'With: { "orderId": X, "salt": "...", "amount": "100", "price": "0.01" }'
        );
      } catch (orderError) {
        console.error(
          "❌ Order creation failed:",
          orderError.response?.data || orderError.message
        );
      }
    } else if (
      currentBatch.phase === "reveal" ||
      currentBatch.phase === "REVEAL"
    ) {
      console.log("🔓 Step 3: In REVEAL phase - orders should be revealed now");
      console.log("💡 Make sure to reveal your committed orders!");
    } else {
      console.log("⚡ Step 3: In EXECUTE phase - checking for matches...");

      // Test matching engine directly
      console.log("\n🧪 Step 4: Testing matching engine with sample orders...");
      await testMatchingEngine();
    }
  } catch (error) {
    console.error("❌ Debug failed:", error.response?.data || error.message);
  }
}

async function testMatchingEngine() {
  // Test matching with sample revealed orders
  const sampleOrders = [
    {
      orderId: 1,
      trader: "0x1234567890123456789012345678901234567890",
      tokenA: "nUSD",
      tokenB: "wPEPE",
      amount: "100000000000000000000", // 100 * 1e18
      price: "10000000000000000", // 0.01 * 1e18
      orderType: "BUY",
      batchId: 1,
      timestamp: Date.now(),
    },
    {
      orderId: 2,
      trader: "0x9876543210987654321098765432109876543210",
      tokenA: "nUSD",
      tokenB: "wPEPE",
      amount: "100000000000000000000", // 100 * 1e18
      price: "10000000000000000", // 0.01 * 1e18
      orderType: "SELL",
      batchId: 1,
      timestamp: Date.now(),
    },
  ];

  try {
    console.log("🔄 Processing batch with sample orders...");
    const matchResult = await axios.post(`${API_BASE}/darkpool/batch/process`, {
      batchId: 999,
      orders: sampleOrders,
    });

    console.log("\n✅ MATCHING RESULTS:");
    console.log(`Total Orders: ${matchResult.data.totalOrders}`);
    console.log(`Total Matches: ${matchResult.data.totalMatches}`);

    if (matchResult.data.matches.length > 0) {
      matchResult.data.matches.forEach((match, i) => {
        console.log(`\nMatch ${i + 1}:`);
        console.log(`  Buy Order ID: ${match.buyOrderId}`);
        console.log(`  Sell Order ID: ${match.sellOrderId}`);
        console.log(`  Matched Amount: ${match.matchedAmount}`);
        console.log(`  Execution Price: ${match.executionPrice}`);
      });

      if (matchResult.data.txHash) {
        console.log(`\n🔗 Blockchain TX: ${matchResult.data.txHash}`);
      }
    } else {
      console.log("⚠️ No matches found. Possible issues:");
      console.log("- Orders are for different token pairs");
      console.log("- Buy price < Sell price");
      console.log("- Orders outside price tolerance");
    }
  } catch (error) {
    console.error(
      "❌ Matching test failed:",
      error.response?.data || error.message
    );
  }
}

// Run the debug session
debugOrderMatching()
  .then(() => {
    console.log("\n🏁 Debug session complete!");
  })
  .catch(console.error);

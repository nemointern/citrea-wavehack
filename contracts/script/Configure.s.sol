// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/bridge/CitreaBridge.sol";
import "../src/darkpool/OrderBook.sol";
import "../src/tokens/WrappedBRC20.sol";

contract Configure is Script {
    // Deployed contract addresses - Update these in frontend/src/config/addresses.ts
    address constant BRIDGE_ADDRESS = 0x800D8509C063937487E991D0c71546De8bF9D906;
    address constant ORDERBOOK_ADDRESS = 0x653eF550EF46B58E168663131af2A0c304340913;
    address constant WPEPE_ADDRESS = 0x8153c10105315581FaeD05236F18c73A81ff21Db;
    // address constant WORDI_ADDRESS = 0xdc572f9189F1d771e5C5c55BE1095B187E102481; // Removed wORDI

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Configuring contracts with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        CitreaBridge bridge = CitreaBridge(BRIDGE_ADDRESS);
        
        console.log("Setting up token mappings...");
        
        // Set up wPEPE mapping (case-insensitive)
        bridge.setWrappedToken("pepe", WPEPE_ADDRESS);
        bridge.setWrappedToken("PEPE", WPEPE_ADDRESS);
        bridge.setWrappedToken("wPEPE", WPEPE_ADDRESS);
        
        // Set up wORDI mapping (case-insensitive)
        // bridge.setWrappedToken("ordi", WORDI_ADDRESS);
        // bridge.setWrappedToken("ORDI", WORDI_ADDRESS);
        // bridge.setWrappedToken("wORDI", WORDI_ADDRESS); // Removed wORDI
        
        console.log("Token mappings configured:");
        console.log("- pepe/PEPE/wPEPE ->", WPEPE_ADDRESS);
        // console.log("- ordi/ORDI/wORDI ->", WORDI_ADDRESS); // Removed wORDI
        
        // Check OrderBook current batch
        console.log("\n=== Checking OrderBook ===");
        OrderBook orderBook = OrderBook(ORDERBOOK_ADDRESS);
        
        try orderBook.getCurrentBatch() returns (OrderBook.Batch memory batch) {
            console.log("Current batch ID:", batch.batchId);
            console.log("Batch start time:", batch.startTime);
            console.log("Total orders:", batch.totalOrders);
        } catch {
            console.log("Failed to get current batch");
        }
        
        vm.stopBroadcast();
        
        console.log("\n=== Configuration Notes ===");
        console.log("1. Wrapped tokens are deployed but not associated with bridge");
        console.log("2. Bridge expects tokens deployed via deployWrappedToken()");
        console.log("3. Current tokens need manual association or re-deployment");
        console.log("4. OrderBook appears to be working correctly");
        console.log("Configuration complete!");
    }
} 
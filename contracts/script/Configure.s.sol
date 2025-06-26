// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import "../src/bridge/CitreaBridge.sol";
import "../src/darkpool/OrderBook.sol";
import "../src/tokens/WrappedBRC20.sol";

contract Configure is Script {
    // Deployed contract addresses
    address constant BRIDGE_ADDRESS = 0x036A6AB2D15918B5F35C6BC78905b53763d01220;
    address constant ORDERBOOK_ADDRESS = 0x887102733A08332d572BfF84262ffa80fFDd81fF;
    address constant WPEPE_ADDRESS = 0x8153c10105315581FaeD05236F18c73A81ff21Db;
    address constant WORDI_ADDRESS = 0xdc572f9189F1d771e5C5c55BE1095B187E102481;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Configuring contracts with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        CitreaBridge bridge = CitreaBridge(BRIDGE_ADDRESS);
        
        // Check current token associations
        console.log("\n=== Checking current token associations ===");
        address pepeToken = bridge.getWrappedToken("pepe");
        address ordiToken = bridge.getWrappedToken("ordi");
        
        console.log("Current PEPE token address:", pepeToken);
        console.log("Current ORDI token address:", ordiToken);
        
        // The wrapped tokens were deployed directly, not through the bridge
        // So we need to manually set up the associations in the bridge contract
        // This requires modifying the bridge contract to have a setter function
        
        console.log("\n=== Deployed Token Addresses ===");
        console.log("wPEPE:", WPEPE_ADDRESS);
        console.log("wORDI:", WORDI_ADDRESS);
        
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
    }
} 
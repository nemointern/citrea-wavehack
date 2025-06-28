// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/darkpool/OrderBook.sol";

contract DeployTokenTransfersScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying updated OrderBook with token transfers");
        console.log("Deploying with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy new OrderBook with token transfer functionality
        OrderBook newOrderBook = new OrderBook();
        
        console.log("New OrderBook deployed at:", address(newOrderBook));
        
        vm.stopBroadcast();
        
        console.log("\n=== DEPLOYMENT COMPLETE ===");
        console.log("OrderBook (with transfers):", address(newOrderBook));
        console.log("\n=== NEXT STEPS ===");
        console.log("1. Update backend config to use new OrderBook address");
        console.log("2. Users need to approve tokens before trading:");
        console.log("   - token.approve(orderBookAddress, amount)");
        console.log("3. Test with small amounts first");
        
        console.log("\n=== TOKEN TRANSFER FUNCTIONALITY ===");
        console.log("Orders now execute REAL token transfers");
        console.log("Atomic settlement - both transfers succeed or both fail");
        console.log("Users get tokens immediately when matched");
    }
} 
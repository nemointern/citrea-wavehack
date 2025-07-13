// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/bridge/CitreaBridge.sol";
import "../src/tokens/WrappedBRC20.sol";

contract MintTestTokensScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Minting wCTRA test tokens with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        // Contract addresses from deployments
        address bridgeAddress = 0x75F9fBB2d498BC123fb6a4c1CF68c7Afb413e2d2;
        address wCTRAAddress = 0xC4f31283b917b0a71795e4B7a1C83633dDC1E483;
        
        // Test user addresses 
        address testUser1 = deployer; // Use deployer as test user
        address testUser2 = 0x742D35cc6E6C84f1E9d1e5AC533e4b9C72FAe4cC; // Example test user
        
        vm.startBroadcast(deployerPrivateKey);
        
        CitreaBridge bridge = CitreaBridge(bridgeAddress);
        
        console.log("=== MINTING wCTRA TEST TOKENS ===");
        
        // Add additional minting for more testing liquidity
        console.log("Minting additional wCTRA tokens for testing...");
        bridge.processBridgeIn(testUser1, "CTRA", 50000 * 10**18, "test_tx_ctra_3"); // 50k more
        bridge.processBridgeIn(testUser2, "CTRA", 25000 * 10**18, "test_tx_ctra_4"); // 25k more
        bridge.processBridgeIn(testUser1, "CTRA", 30000 * 10**18, "test_tx_ctra_5"); // 30k more to deployer
        
        vm.stopBroadcast();
        
        console.log("=== wCTRA MINTING COMPLETE ===");
        console.log("wCTRA Contract:", wCTRAAddress);
        console.log("Bridge Contract:", bridgeAddress);
        
        // Check balances
        WrappedBRC20 wCTRA = WrappedBRC20(wCTRAAddress);
        console.log("=== BALANCES ===");
        console.log("User 1 total:", (wCTRA.balanceOf(testUser1)) / 10**18, "wCTRA");
        console.log("User 2 total:", (wCTRA.balanceOf(testUser2)) / 10**18, "wCTRA");
    }
} 
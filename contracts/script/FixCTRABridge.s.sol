// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/bridge/CitreaBridge.sol";

contract FixCTRABridgeScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Fixing wCTRA bridge registration with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        // Contract addresses
        address bridgeAddress = 0x800D8509C063937487E991D0c71546De8bF9D906;
        address wCTRAAddress = 0x0e62a515FE7b3B07d3577DE0d863034ebd41f7BF;
        
        console.log("Bridge address:", bridgeAddress);
        console.log("wCTRA address:", wCTRAAddress);
        
        vm.startBroadcast(deployerPrivateKey);
        
        CitreaBridge bridge = CitreaBridge(bridgeAddress);
        
        // Register wCTRA with different ticker variations
        console.log("Registering wCTRA with bridge...");
        
        bridge.setWrappedToken("ctra", wCTRAAddress);
        console.log("Registered wCTRA for ticker: ctra");
        
        bridge.setWrappedToken("CTRA", wCTRAAddress);
        console.log("Registered wCTRA for ticker: CTRA");
        
        bridge.setWrappedToken("Ctra", wCTRAAddress);
        console.log("Registered wCTRA for ticker: Ctra");
        
        vm.stopBroadcast();
        
        // Verify registration
        console.log("\n=== VERIFICATION ===");
        
        vm.startBroadcast(deployerPrivateKey);
        
        address ctraResult = bridge.getWrappedToken("ctra");
        address CTRAResult = bridge.getWrappedToken("CTRA");
        
        vm.stopBroadcast();
        
        console.log("Bridge lookup for 'ctra':", ctraResult);
        console.log("Bridge lookup for 'CTRA':", CTRAResult);
        
        if (ctraResult == wCTRAAddress && CTRAResult == wCTRAAddress) {
            console.log("wCTRA successfully registered with bridge!");
        } else {
            console.log("wCTRA registration failed");
        }
        
        console.log("\n=== CTRA BRIDGE FIX COMPLETE ===");
    }
} 
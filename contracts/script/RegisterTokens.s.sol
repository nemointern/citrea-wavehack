// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/bridge/CitreaBridge.sol";

contract RegisterTokensScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Registering tokens with account:", deployer);
        
        // Main bridge address from our deployment
        address mainBridgeAddress = 0x75F9fBB2d498BC123fb6a4c1CF68c7Afb413e2d2;
        address wCTRAAddress = 0xC4f31283b917b0a71795e4B7a1C83633dDC1E483;
        
        vm.startBroadcast(deployerPrivateKey);
        
        CitreaBridge mainBridge = CitreaBridge(mainBridgeAddress);
        
        console.log("Registering wCTRA with main bridge...");
        
        // Register wCTRA token with the main bridge
        mainBridge.setWrappedToken("CTRA", wCTRAAddress);
        console.log("wCTRA registered for ticker: CTRA");
        
        // Also register lowercase version for compatibility
        mainBridge.setWrappedToken("ctra", wCTRAAddress);
        console.log("wCTRA registered for ticker: ctra");
        
        vm.stopBroadcast();
        
        console.log("=== TOKEN REGISTRATION COMPLETE ===");
        console.log("wCTRA:", wCTRAAddress);
        console.log("Main Bridge:", mainBridgeAddress);
        console.log("Ready for testing!");
    }
} 
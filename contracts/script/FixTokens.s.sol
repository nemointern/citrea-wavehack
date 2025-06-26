// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import "../src/bridge/CitreaBridge.sol";

contract FixTokens is Script {
    address constant BRIDGE_ADDRESS = 0x036A6AB2D15918B5F35C6BC78905b53763d01220;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Fixing token associations with account:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        CitreaBridge bridge = CitreaBridge(BRIDGE_ADDRESS);
        
        console.log("\n=== Deploying tokens through bridge ===");
        
        // Deploy PEPE token through bridge
        bridge.deployWrappedToken(
            "pepe",                    // ticker
            "Wrapped PEPE",           // name  
            "wPEPE",                  // symbol
            1000000000 * 1e18         // maxSupply (1B tokens)
        );
        
        // Deploy ORDI token through bridge  
        bridge.deployWrappedToken(
            "ordi",                    // ticker
            "Wrapped ORDI",           // name
            "wORDI",                  // symbol
            21000000 * 1e18           // maxSupply (21M tokens)
        );
        
        // Check the new associations
        address newPepeToken = bridge.getWrappedToken("pepe");
        address newOrdiToken = bridge.getWrappedToken("ordi");
        
        console.log("\n=== New Token Associations ===");
        console.log("PEPE token address:", newPepeToken);
        console.log("ORDI token address:", newOrdiToken);
        
        vm.stopBroadcast();
        
        console.log("\n=== Update Required ===");
        console.log("Update backend/src/config/contracts.ts with new addresses:");
        console.log("wPEPE:", newPepeToken);
        console.log("wORDI:", newOrdiToken);
    }
} 
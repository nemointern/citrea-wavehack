// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import "../src/bridge/CitreaBridge.sol";

contract FixTokens is Script {
    // Existing deployed token addresses
    address constant EXISTING_WPEPE = 0x8153c10105315581FaeD05236F18c73A81ff21Db;
    address constant EXISTING_WORDI = 0xDc572f9189F1d771e5C5c55BE1095B187e102481;
    address constant EXISTING_ORDERBOOK = 0x653eF550EF46B58E168663131af2A0c304340913;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Fixing token associations with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("\n=== Deploying NEW CitreaBridge with setWrappedToken function ===");
        CitreaBridge newBridge = new CitreaBridge();
        console.log("New CitreaBridge deployed at:", address(newBridge));
        
        console.log("\n=== Associating existing tokens ===");
        
        // Associate existing tokens
        newBridge.setWrappedToken("pepe", EXISTING_WPEPE);
        newBridge.setWrappedToken("PEPE", EXISTING_WPEPE);
        newBridge.setWrappedToken("wPEPE", EXISTING_WPEPE);
        
        newBridge.setWrappedToken("ordi", EXISTING_WORDI);
        newBridge.setWrappedToken("ORDI", EXISTING_WORDI);
        newBridge.setWrappedToken("wORDI", EXISTING_WORDI);
        
        console.log("Token associations complete:");
        console.log("- pepe/PEPE/wPEPE ->", EXISTING_WPEPE);
        console.log("- ordi/ORDI/wORDI ->", EXISTING_WORDI);
        
        // Grant bridge role to new bridge on existing tokens
        console.log("\n=== Granting bridge roles ===");
        WrappedBRC20 wpepe = WrappedBRC20(EXISTING_WPEPE);
        WrappedBRC20 wordi = WrappedBRC20(EXISTING_WORDI);
        
        bytes32 bridgeRole = wpepe.BRIDGE_ROLE();
        wpepe.grantRole(bridgeRole, address(newBridge));
        wordi.grantRole(bridgeRole, address(newBridge));
        
        console.log("Bridge roles granted to new bridge");
        
        vm.stopBroadcast();
        
        console.log("\n=== UPDATE REQUIRED ===");
        console.log("Update backend config with new bridge address:");
        console.log("NEW_BRIDGE_ADDRESS =", address(newBridge));
        console.log("ORDERBOOK_ADDRESS =", EXISTING_ORDERBOOK, "(unchanged)");
        console.log("WPEPE_ADDRESS =", EXISTING_WPEPE, "(unchanged)");
        console.log("WORDI_ADDRESS =", EXISTING_WORDI, "(unchanged)");
    }
} 
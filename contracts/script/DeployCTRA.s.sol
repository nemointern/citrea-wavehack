// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/tokens/WrappedBRC20.sol";
import "../src/bridge/CitreaBridge.sol";

contract DeployCTRAScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying wCTRA with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        // Get existing bridge address
        address bridgeAddress = 0x800D8509C063937487E991D0c71546De8bF9D906;
        console.log("Bridge address:", bridgeAddress);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy wCTRA token
        WrappedBRC20 wCTRA = new WrappedBRC20(
            "Wrapped CTRA",
            "wCTRA",
            "CTRA",
            2100000000 * 10**18  // 2.1B tokens total supply
        );
        
        console.log("wCTRA deployed at:", address(wCTRA));
        
        // Grant bridge role to the bridge contract
        bytes32 BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
        wCTRA.grantRole(BRIDGE_ROLE, bridgeAddress);
        console.log("Granted BRIDGE_ROLE to bridge contract");
        
        // Set the wrapped token in the bridge
        CitreaBridge bridge = CitreaBridge(bridgeAddress);
        bridge.setWrappedToken("ctra", address(wCTRA));
        bridge.setWrappedToken("CTRA", address(wCTRA)); // Both cases
        
        console.log("wCTRA registered with bridge for ticker: CTRA");
        
        vm.stopBroadcast();
        
        console.log("\n=== CTRA DEPLOYMENT COMPLETE ===");
        console.log("wCTRA Contract:", address(wCTRA));
        console.log("Total Supply:", wCTRA.totalSupply());
        console.log("Symbol:", wCTRA.symbol());
        console.log("Decimals:", wCTRA.decimals());
        
        console.log("\n=== UPDATE BACKEND CONFIG ===");
        console.log("Add to contracts.ts:");
        console.log("wCTRA:", address(wCTRA));
    }
} 
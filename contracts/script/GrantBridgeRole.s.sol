// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/tokens/WrappedBRC20.sol";

contract GrantBridgeRoleScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Granting bridge role with account:", deployer);
        
        // Contract addresses
        address mainBridgeAddress = 0x75F9fBB2d498BC123fb6a4c1CF68c7Afb413e2d2;
        address wCTRAAddress = 0xC4f31283b917b0a71795e4B7a1C83633dDC1E483;
        
        vm.startBroadcast(deployerPrivateKey);
        
        WrappedBRC20 wCTRA = WrappedBRC20(wCTRAAddress);
        
        console.log("Granting BRIDGE_ROLE to main bridge...");
        
        // Grant BRIDGE_ROLE to the main bridge
        bytes32 BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
        wCTRA.grantRole(BRIDGE_ROLE, mainBridgeAddress);
        
        console.log("BRIDGE_ROLE granted to main bridge");
        
        vm.stopBroadcast();
        
        console.log("=== BRIDGE ROLE GRANTED ===");
        console.log("wCTRA:", wCTRAAddress);
        console.log("Main Bridge:", mainBridgeAddress);
        console.log("Now ready for minting!");
    }
} 
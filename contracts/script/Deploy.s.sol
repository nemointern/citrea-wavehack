// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/tokens/WrappedBRC20.sol";
import "../src/bridge/CitreaBridge.sol";
import "../src/darkpool/OrderBook.sol";

contract Deploy is Script {
    // Deployment addresses will be stored here
    CitreaBridge public bridge;
    OrderBook public orderBook;
    WrappedBRC20 public wPEPE;
    WrappedBRC20 public wORDI;
    
    // Configuration
    address public constant NUSD_ADDRESS = 0x9B28B690550522608890C3C7e63c0b4A7eBab9AA;
    
    function run() external {
        // Get deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying contracts with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy Bridge Contract
        console.log("\n=== Deploying CitreaBridge ===");
        bridge = new CitreaBridge();
        console.log("CitreaBridge deployed at:", address(bridge));
        
        // 2. Deploy OrderBook Contract
        console.log("\n=== Deploying OrderBook ===");
        orderBook = new OrderBook();
        console.log("OrderBook deployed at:", address(orderBook));
        
        // 3. Deploy Wrapped Tokens
        console.log("\n=== Deploying Wrapped Tokens ===");
        
        // Deploy wPEPE (1 billion max supply)
        wPEPE = new WrappedBRC20(
            "Wrapped PEPE",
            "wPEPE", 
            "pepe",
            1_000_000_000 * 1e18
        );
        console.log("wPEPE deployed at:", address(wPEPE));
        
        // Deploy wORDI (21 million max supply)
        wORDI = new WrappedBRC20(
            "Wrapped ORDI",
            "wORDI",
            "ordi", 
            21_000_000 * 1e18
        );
        console.log("wORDI deployed at:", address(wORDI));
        
        // 4. Setup Permissions
        console.log("\n=== Setting up permissions ===");
        
        // Grant bridge role to CitreaBridge contract for wrapped tokens
        wPEPE.grantRole(wPEPE.BRIDGE_ROLE(), address(bridge));
        wORDI.grantRole(wORDI.BRIDGE_ROLE(), address(bridge));
        console.log("Bridge roles granted to CitreaBridge");
        
        // Grant matcher role to deployer for OrderBook (can be changed later)
        orderBook.grantRole(orderBook.MATCHER_ROLE(), deployer);
        console.log("Matcher role granted to deployer");
        
        // 5. Setup token addresses in bridge storage (manual setup for now)
        console.log("\n=== Setup complete ===");
        console.log("Bridge contract needs to be configured with token addresses manually");
        console.log("wPEPE needs to be associated with 'pepe' ticker");
        console.log("wORDI needs to be associated with 'ordi' ticker");
        
        vm.stopBroadcast();
        
        // 6. Print deployment summary
        printDeploymentSummary();
        
        // 7. Save addresses to file
        saveAddresses();
    }
    
    function printDeploymentSummary() internal view {
        console.log("\n==================================================");
        console.log("DEPLOYMENT SUMMARY");
        console.log("==================================================");
        console.log("Network: Citrea Testnet (Chain ID: 5115)");
        console.log("nUSD Token:", NUSD_ADDRESS);
        console.log("");
        console.log("=== Core Contracts ===");
        console.log("CitreaBridge:", address(bridge));
        console.log("OrderBook:", address(orderBook));
        console.log("");
        console.log("=== Wrapped Tokens ===");
        console.log("wPEPE:", address(wPEPE));
        console.log("wORDI:", address(wORDI));
        console.log("");
        console.log("==================================================");
    }
    
    function saveAddresses() internal {
        // Create addresses.json file content
        string memory json = string(abi.encodePacked(
            '{\n',
            '  "network": "citrea-testnet",\n',
            '  "chainId": 5115,\n',
            '  "contracts": {\n',
            '    "bridge": "', vm.toString(address(bridge)), '",\n',
            '    "orderBook": "', vm.toString(address(orderBook)), '",\n',
            '    "nUSD": "', vm.toString(NUSD_ADDRESS), '",\n',
            '    "tokens": {\n',
            '      "wPEPE": "', vm.toString(address(wPEPE)), '",\n',
            '      "wORDI": "', vm.toString(address(wORDI)), '"\n',
            '    }\n',
            '  },\n',
            '  "deployedAt": "', vm.toString(block.timestamp), '"\n',
            '}'
        ));
        
        // Write to file
        vm.writeFile("./addresses.json", json);
        console.log("\nContract addresses saved to addresses.json");
    }
} 
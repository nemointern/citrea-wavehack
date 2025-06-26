import { defineChain } from "viem";

export const citreaTestnet = defineChain({
  id: 5115,
  name: "Citrea Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "cBTC",
    symbol: "cBTC",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.citrea.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Citrea Explorer",
      url: "https://explorer.testnet.citrea.xyz",
    },
  },
  contracts: {
    multicall3: {
      address: "0xca11bde05977b3631167028862be2a173976ca11",
      blockCreated: 1,
    },
  },
  testnet: true,
});

export const NUSD_CONTRACT =
  "0x9B28B690550522608890C3C7e63c0b4A7eBab9AA" as const;

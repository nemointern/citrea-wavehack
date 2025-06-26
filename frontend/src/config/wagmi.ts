import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { defineChain } from "viem";

// Define Citrea Testnet
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
    public: {
      http: ["https://rpc.testnet.citrea.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Citrea Explorer",
      url: "https://explorer.testnet.citrea.xyz",
    },
  },
  testnet: true,
});

export const config = getDefaultConfig({
  appName: "Citrea Wave Bridge",
  projectId: "1571fba8d58875a2bd60258a54d3ddd3",
  chains: [citreaTestnet],
  transports: {
    [citreaTestnet.id]: http(),
  },
  ssr: false,
});

import { Address } from "viem";

export interface ContractAddresses {
  bridge: Address;
  orderBook: Address;
  nUSD: Address;
  tokens: {
    wPEPE: Address;
    wORDI: Address;
  };
}

// Deployed contract addresses on Citrea Testnet
export const CITREA_CONTRACTS: ContractAddresses = {
  bridge: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  orderBook: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  nUSD: "0x9B28B690550522608890C3C7e63c0b4A7eBab9AA",
  tokens: {
    wPEPE: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    wORDI: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
  },
};

// Token ticker to address mapping
export const TOKEN_ADDRESSES: Record<string, Address> = {
  pepe: CITREA_CONTRACTS.tokens.wPEPE,
  ordi: CITREA_CONTRACTS.tokens.wORDI,
  nusd: CITREA_CONTRACTS.nUSD,
};

// Reverse mapping for display purposes
export const ADDRESS_TO_TOKEN: Record<string, string> = {
  [CITREA_CONTRACTS.tokens.wPEPE]: "wPEPE",
  [CITREA_CONTRACTS.tokens.wORDI]: "wORDI",
  [CITREA_CONTRACTS.nUSD]: "nUSD",
};

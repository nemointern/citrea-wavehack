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

// Deployed contract addresses on Citrea Testnet (LIVE DEPLOYMENT)
export const CITREA_CONTRACTS: ContractAddresses = {
  bridge: "0x036A6AB2D15918B5F35C6BC78905b53763d01220",
  orderBook: "0x887102733A08332d572BfF84262ffa80fFDd81fF",
  nUSD: "0x9B28B690550522608890C3C7e63c0b4A7eBab9AA",
  tokens: {
    wPEPE: "0x8153c10105315581FaeD05236F18c73A81ff21Db",
    wORDI: "0xdc572f9189F1d771e5C5c55BE1095B187E102481",
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

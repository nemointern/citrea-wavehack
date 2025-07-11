/**
 * Contract Addresses Configuration (Backend)
 *
 * This file centralizes all contract addresses for the backend services.
 * Should be kept in sync with frontend/src/config/addresses.ts
 */

import { Address } from "viem";

export const CONTRACT_ADDRESSES = {
  // Core Contracts
  ORDERBOOK: "0x653eF550EF46B58E168663131af2A0c304340913" as Address,
  BRIDGE: "0x800D8509C063937487E991D0c71546De8bF9D906" as Address,

  // Token Contracts
  TOKENS: {
    wPEPE: "0x8153c10105315581FaeD05236F18c73A81ff21Db" as Address,
    wORDI: "0xDc572f9189F1d771e5C5c55BE1095B187e102481" as Address,
    wCTRA: "0x0e62a515FE7b3B07d3577DE0d863034ebd41f7BF" as Address,
    nUSD: "0x9B28B690550522608890C3C7e63c0b4A7eBab9AA" as Address,
  },
} as const;

// Legacy interface for backward compatibility
export interface ContractAddresses {
  bridge: Address;
  orderBook: Address;
  nUSD: Address;
  tokens: {
    wPEPE: Address;
    wORDI: Address;
    wCTRA: Address;
  };
}

// Legacy structure for backward compatibility
export const CITREA_CONTRACTS: ContractAddresses = {
  bridge: CONTRACT_ADDRESSES.BRIDGE,
  orderBook: CONTRACT_ADDRESSES.ORDERBOOK,
  nUSD: CONTRACT_ADDRESSES.TOKENS.nUSD,
  tokens: {
    wPEPE: CONTRACT_ADDRESSES.TOKENS.wPEPE,
    wORDI: CONTRACT_ADDRESSES.TOKENS.wORDI,
    wCTRA: CONTRACT_ADDRESSES.TOKENS.wCTRA,
  },
};

// Token ticker to address mapping
export const TOKEN_ADDRESSES: Record<string, Address> = {
  pepe: CONTRACT_ADDRESSES.TOKENS.wPEPE,
  ordi: CONTRACT_ADDRESSES.TOKENS.wORDI,
  ctra: CONTRACT_ADDRESSES.TOKENS.wCTRA,
  nusd: CONTRACT_ADDRESSES.TOKENS.nUSD,
};

// Reverse mapping for display purposes
export const ADDRESS_TO_TOKEN: Record<string, string> = {
  [CONTRACT_ADDRESSES.TOKENS.wPEPE]: "wPEPE",
  [CONTRACT_ADDRESSES.TOKENS.wORDI]: "wORDI",
  [CONTRACT_ADDRESSES.TOKENS.wCTRA]: "wCTRA",
  [CONTRACT_ADDRESSES.TOKENS.nUSD]: "nUSD",
};

// Helper functions
export const getOrderBookAddress = () => CONTRACT_ADDRESSES.ORDERBOOK;
export const getBridgeAddress = () => CONTRACT_ADDRESSES.BRIDGE;
export const getTokenAddress = (
  symbol: keyof typeof CONTRACT_ADDRESSES.TOKENS
) => CONTRACT_ADDRESSES.TOKENS[symbol];
export const getAllTokenAddresses = () => CONTRACT_ADDRESSES.TOKENS;

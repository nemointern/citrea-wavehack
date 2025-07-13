/**
 * Contract Addresses Configuration (Backend)
 *
 * This file centralizes all contract addresses for the backend services.
 * Should be kept in sync with frontend/src/config/addresses.ts
 */

import { Address } from "viem";

export const CONTRACT_ADDRESSES = {
  // Core Contracts
  ORDERBOOK: "0xc5F2c636EedAEe186643792C7626f94f6F38dBf0" as Address,
  BRIDGE: "0x75F9fBB2d498BC123fb6a4c1CF68c7Afb413e2d2" as Address,

  // Token Contracts
  TOKENS: {
    wPEPE: "0x7CF5e5D861Ea3046C52643e32b8af1fA3398eD94" as Address,
    wORDI: "0x0A36C8FB0c7a63Bc4822790622e48302f1CB568b" as Address,
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

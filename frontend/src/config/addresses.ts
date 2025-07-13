/**
 * Contract Addresses Configuration
 *
 * This file centralizes all contract addresses for easy management.
 * Update addresses here and they will be reflected across the entire application.
 */

export const CONTRACT_ADDRESSES = {
  // Core Contracts
  ORDERBOOK: "0xc5F2c636EedAEe186643792C7626f94f6F38dBf0",
  BRIDGE: "0x75F9fBB2d498BC123fb6a4c1CF68c7Afb413e2d2",

  // Token Contracts
  TOKENS: {
    wPEPE: "0x7CF5e5D861Ea3046C52643e32b8af1fA3398eD94",
    wORDI: "0x0A36C8FB0c7a63Bc4822790622e48302f1CB568b",
    wCTRA: "0xC4f31283b917b0a71795e4B7a1C83633dDC1E483",
    nUSD: "0x9B28B690550522608890C3C7e63c0b4A7eBab9AA",
  },
} as const;

// Type definitions for better TypeScript support
export type TokenSymbol = keyof typeof CONTRACT_ADDRESSES.TOKENS;

// Helper functions
export const getTokenAddress = (symbol: TokenSymbol): string => {
  const address = CONTRACT_ADDRESSES.TOKENS[symbol];
  if (!address) {
    throw new Error(`Token address not found for symbol: ${symbol}`);
  }
  return address;
};

export const getAllTokenAddresses = () => CONTRACT_ADDRESSES.TOKENS;

export const getOrderBookAddress = () => CONTRACT_ADDRESSES.ORDERBOOK;

export const getBridgeAddress = () => CONTRACT_ADDRESSES.BRIDGE;

// Validation helper
export const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Verify all addresses are valid on import
Object.entries(CONTRACT_ADDRESSES.TOKENS).forEach(([symbol, address]) => {
  if (!isValidAddress(address)) {
    throw new Error(`Invalid token address for ${symbol}: ${address}`);
  }
});

if (!isValidAddress(CONTRACT_ADDRESSES.ORDERBOOK)) {
  throw new Error(`Invalid OrderBook address: ${CONTRACT_ADDRESSES.ORDERBOOK}`);
}

if (!isValidAddress(CONTRACT_ADDRESSES.BRIDGE)) {
  throw new Error(`Invalid Bridge address: ${CONTRACT_ADDRESSES.BRIDGE}`);
}

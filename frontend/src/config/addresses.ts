/**
 * Contract Addresses Configuration
 *
 * This file centralizes all contract addresses for easy management.
 * Update addresses here and they will be reflected across the entire application.
 */

export const CONTRACT_ADDRESSES = {
  // Core Contracts
  ORDERBOOK: "0x653eF550EF46B58E168663131af2A0c304340913",
  BRIDGE: "0x800D8509C063937487E991D0c71546De8bF9D906",

  // Token Contracts
  TOKENS: {
    wPEPE: "0x8153c10105315581FaeD05236F18c73A81ff21Db",
    wORDI: "0xDc572f9189F1d771e5C5c55BE1095B187e102481",
    wCTRA: "0x0e62a515FE7b3B07d3577DE0d863034ebd41f7BF",
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

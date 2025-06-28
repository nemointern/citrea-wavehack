import { Address } from "viem";

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

// Deployed contract addresses on Citrea Testnet (LIVE DEPLOYMENT)
export const CITREA_CONTRACTS: ContractAddresses = {
  bridge: "0x800D8509C063937487E991D0c71546De8bF9D906",
  orderBook: "0x653eF550EF46B58E168663131af2A0c304340913",
  nUSD: "0x9B28B690550522608890C3C7e63c0b4A7eBab9AA",
  tokens: {
    wPEPE: "0x8153c10105315581faed05236f18c73a81ff21db",
    wORDI: "0xdc572f9189f1d771e5c5c55be1095b187e102481",
    wCTRA: "0x0e62a515FE7b3B07d3577DE0d863034ebd41f7BF",
  },
};

// Token ticker to address mapping
export const TOKEN_ADDRESSES: Record<string, Address> = {
  pepe: CITREA_CONTRACTS.tokens.wPEPE,
  ordi: CITREA_CONTRACTS.tokens.wORDI,
  ctra: CITREA_CONTRACTS.tokens.wCTRA,
  nusd: CITREA_CONTRACTS.nUSD,
};

// Reverse mapping for display purposes
export const ADDRESS_TO_TOKEN: Record<string, string> = {
  [CITREA_CONTRACTS.tokens.wPEPE]: "wPEPE",
  [CITREA_CONTRACTS.tokens.wORDI]: "wORDI",
  [CITREA_CONTRACTS.tokens.wCTRA]: "wCTRA",
  [CITREA_CONTRACTS.nUSD]: "nUSD",
};

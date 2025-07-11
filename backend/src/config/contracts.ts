/**
 * Contract Addresses Configuration (Legacy)
 *
 * This file is now a wrapper around the centralized address configuration.
 * All addresses are managed in ./addresses.ts
 */

export {
  type ContractAddresses,
  CITREA_CONTRACTS,
  TOKEN_ADDRESSES,
  ADDRESS_TO_TOKEN,
  getOrderBookAddress,
  getBridgeAddress,
  getTokenAddress,
  getAllTokenAddresses,
} from "./addresses";

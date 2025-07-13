/**
 * API Configuration
 *
 * This file handles the API base URL configuration for different environments.
 * Update the BACKEND_URL.
 */

// Update this URL with your AWS backend URL after deployment
const PRODUCTION_BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const DEVELOPMENT_BACKEND_URL = "http://localhost:3001";

export const API_BASE_URL = import.meta.env.PROD
  ? PRODUCTION_BACKEND_URL
  : DEVELOPMENT_BACKEND_URL;

// Validation to ensure we never have undefined URLs
if (!API_BASE_URL || API_BASE_URL === "undefined") {
  console.error("API_BASE_URL is undefined! Using fallback.");
  console.error("Environment:", {
    PROD: import.meta.env.PROD,
    DEV: import.meta.env.DEV,
    VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
    PRODUCTION_BACKEND_URL,
    DEVELOPMENT_BACKEND_URL,
  });
}

console.log("✅ API_BASE_URL:", API_BASE_URL);
console.log(
  "🌍 Environment:",
  import.meta.env.PROD ? "PRODUCTION" : "DEVELOPMENT"
);
console.log("🔧 VITE_BACKEND_URL:", import.meta.env.VITE_BACKEND_URL);
// API endpoints
export const API_ENDPOINTS = {
  // Health check
  HEALTH: "/api/health",

  // BTC Monitor
  BTC_MONITOR_STATUS: "/api/btc/monitor/status",
  BTC_ADD_ADDRESS: "/api/btc/monitor/address",

  // Bridge
  BRIDGE_CREATE: "/api/bridge/create",
  BRIDGE_REQUEST: "/api/bridge/request",
  BRIDGE_USER_REQUESTS: "/api/bridge/user",
  BRIDGE_STATS: "/api/bridge/stats",
  BRIDGE_STATUS: "/api/bridge/status",
  BRIDGE_MINT: "/api/bridge/mint",
  BRIDGE_TOKEN: "/api/bridge/token",

  // BRC20
  BRC20_TOKEN_INFO: "/api/brc20/token",
  BRC20_HISTORY: "/api/brc20/address",
  BRC20_DEPOSITS_STATS: "/api/brc20/deposits/stats",

  // Dark Pool
  DARKPOOL_CURRENT_BATCH: "/api/darkpool/batch/current",
  DARKPOOL_PROCESS_BATCH: "/api/darkpool/batch/process",
  DARKPOOL_CREATE_BATCH: "/api/darkpool/batch/create",
  DARKPOOL_MATCHING_STATS: "/api/darkpool/matching/stats",
} as const;

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};

// Helper function for API requests with proper CORS handling
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const url = buildApiUrl(endpoint);

  const defaultOptions: RequestInit = {
    credentials: "include", // Important for CORS with credentials
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  return fetch(url, { ...defaultOptions, ...options });
};

// Type-safe API request wrapper
export const apiCall = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const response = await apiRequest(endpoint, options);

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
};

export default API_BASE_URL;

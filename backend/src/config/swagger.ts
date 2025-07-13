import swaggerJSDoc from "swagger-jsdoc";
import { SwaggerDefinition } from "swagger-jsdoc";

const swaggerDefinition: SwaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Nocturne Dark Pool API",
    version: "1.0.0",
    description:
      "API documentation for Nocturne Dark Pool Trading System with BRC20 bridging",
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  servers: [
    {
      url: "http://localhost:3001",
      description: "Development server",
    },
    {
      url: "https://3.71.41.71",
      description: "Production server (AWS)",
    },
  ],
  components: {
    schemas: {
      Order: {
        type: "object",
        required: [
          "tokenA",
          "tokenB",
          "amount",
          "price",
          "orderType",
          "userAddress",
        ],
        properties: {
          tokenA: {
            type: "string",
            description: "First token in the pair",
            example: "PEPE",
          },
          tokenB: {
            type: "string",
            description: "Second token in the pair",
            example: "nUSD",
          },
          amount: {
            type: "string",
            description: "Order amount in wei/smallest unit",
            example: "1000000000000000000000",
          },
          price: {
            type: "string",
            description: "Order price in wei/smallest unit",
            example: "1200000000000000",
          },
          orderType: {
            type: "string",
            enum: ["BUY", "SELL"],
            description: "Order type",
          },
          userAddress: {
            type: "string",
            description: "User wallet address",
            example: "0x123456789abcdef...",
          },
        },
      },
      RevealOrder: {
        type: "object",
        required: [
          "orderId",
          "salt",
          "tokenA",
          "tokenB",
          "amount",
          "price",
          "orderType",
        ],
        properties: {
          orderId: {
            type: "integer",
            description: "Order ID to reveal",
            example: 123,
          },
          salt: {
            type: "string",
            description: "Salt used in order commitment",
            example: "random_salt_string",
          },
          tokenA: {
            type: "string",
            description: "First token in the pair",
            example: "PEPE",
          },
          tokenB: {
            type: "string",
            description: "Second token in the pair",
            example: "nUSD",
          },
          amount: {
            type: "string",
            description: "Order amount in wei/smallest unit",
            example: "1000000000000000000000",
          },
          price: {
            type: "string",
            description: "Order price in wei/smallest unit",
            example: "1200000000000000",
          },
          orderType: {
            type: "string",
            enum: ["BUY", "SELL"],
            description: "Order type",
          },
        },
      },
      Batch: {
        type: "object",
        properties: {
          batchId: {
            type: "integer",
            description: "Batch identifier",
            example: 17,
          },
          phase: {
            type: "string",
            enum: ["commit", "reveal", "matching", "execution"],
            description: "Current batch phase",
          },
          orderCount: {
            type: "integer",
            description: "Number of orders in batch",
            example: 5,
          },
          deadline: {
            type: "integer",
            description: "Phase deadline timestamp",
            example: 1752403425000,
          },
        },
      },
      MatchingStats: {
        type: "object",
        properties: {
          totalMatches: {
            type: "integer",
            description: "Total number of matches",
            example: 42,
          },
          totalVolume: {
            type: "string",
            description: "Total trading volume",
            example: "1000000000000000000000",
          },
          activePairs: {
            type: "integer",
            description: "Number of active trading pairs",
            example: 6,
          },
          avgExecutionTime: {
            type: "number",
            description: "Average execution time in milliseconds",
            example: 150.5,
          },
        },
      },
      BRC20Stats: {
        type: "object",
        properties: {
          supportedTokens: {
            type: "array",
            items: {
              type: "string",
            },
            description: "List of supported BRC20 tokens",
            example: ["PEPE", "CTRA"],
          },
          totalDeposits: {
            type: "integer",
            description: "Total number of deposits processed",
            example: 156,
          },
          processedTransfers: {
            type: "integer",
            description: "Number of processed transfers",
            example: 89,
          },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: {
            type: "string",
            description: "Error message",
          },
          code: {
            type: "string",
            description: "Error code",
          },
        },
      },
    },
    responses: {
      NotFound: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
      BadRequest: {
        description: "Invalid request parameters",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
      InternalError: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
    },
  },
  tags: [
    {
      name: "Health",
      description: "System health and status endpoints",
    },
    {
      name: "Dark Pool",
      description: "Dark pool trading operations",
    },
    {
      name: "Orders",
      description: "Order management endpoints",
    },
    {
      name: "Batches",
      description: "Batch processing endpoints",
    },
    {
      name: "BRC20",
      description: "BRC20 token bridge operations",
    },
    {
      name: "Bridge",
      description: "Cross-chain bridge operations",
    },
  ],
};

// Determine API file paths based on environment
const isDevelopment = process.env.NODE_ENV !== "production";
const apiPaths = isDevelopment
  ? ["./src/index.ts", "./src/routes/*.ts"]
  : [
      // In production, try multiple possible paths
      "./src/index.ts",
      "./src/routes/*.ts",
      "../src/index.ts",
      "../src/routes/*.ts",
      "src/index.ts",
      "src/routes/*.ts",
    ];

const options = {
  definition: swaggerDefinition,
  apis: apiPaths,
};

export const swaggerSpec = swaggerJSDoc(options);

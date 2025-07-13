# Swagger API Documentation Setup

This guide explains how to enable comprehensive API documentation for the Citrea Dark Pool backend.

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
npm install swagger-jsdoc swagger-ui-express @types/swagger-jsdoc @types/swagger-ui-express
```

### 2. Enable Swagger in Code

In `src/index.ts`, uncomment the swagger imports:

```typescript
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
```

Then add the swagger middleware (around line 75):

```typescript
// Swagger UI
const swaggerUiOptions = {
  customCss: ".swagger-ui .topbar { display: none }",
  customSiteTitle: "Citrea Dark Pool API",
  swaggerOptions: {
    persistAuthorization: true,
  },
};

app.use("/api-docs", swaggerUi.serve);
app.get("/api-docs", swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Swagger JSON
app.get("/api/swagger.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});
```

### 3. Build and Start

```bash
npm run build
npm start
```

### 4. Access Documentation

- **Swagger UI**: http://localhost:3001/api-docs
- **JSON Spec**: http://localhost:3001/api/swagger.json

## 📋 API Documentation Overview

The documentation covers all major API endpoints:

### **Health & Status**

- `GET /` - API information and status
- `GET /api/health` - Comprehensive system health check

### **Dark Pool Trading**

- `POST /api/darkpool/order/submit` - Submit order commitment
- `POST /api/darkpool/order/reveal` - Reveal committed order
- `GET /api/darkpool/matching/stats` - Matching engine statistics
- `POST /api/darkpool/batch/create` - Create new trading batch
- `POST /api/darkpool/batch/process` - Process revealed orders
- `GET /api/darkpool/batch/current` - Get current batch status

### **BRC20 Bridge**

- `GET /api/brc20/token/{ticker}/info` - Token information
- `GET /api/brc20/deposits/stats` - Deposit statistics
- `POST /api/brc20/deposit/address` - Generate deposit address

### **Cross-Chain Bridge**

- `POST /api/bridge/mint` - Mint wrapped tokens
- `GET /api/bridge/request/{id}` - Get bridge request details
- `GET /api/bridge/user/{userId}/requests` - User bridge history
- `GET /api/bridge/stats` - Bridge statistics
- `GET /api/bridge/status` - Bridge processing status

### **BTC Monitoring**

- `POST /api/btc/monitor/address` - Add address to monitoring
- `GET /api/btc/monitor/status` - Monitor status and current block

## 🔧 Configuration

The Swagger configuration is in `src/config/swagger.ts` and includes:

- **Server URLs**: Development (localhost:3001) and Production (AWS)
- **Comprehensive Schemas**: Order, Batch, MatchingStats, BRC20Stats, etc.
- **Reusable Responses**: NotFound, BadRequest, InternalError
- **Organized Tags**: Health, Dark Pool, Orders, Batches, BRC20, Bridge

## 📊 Schemas

### Key Data Models

**Order Submission**:

```json
{
  "tokenA": "PEPE",
  "tokenB": "nUSD",
  "amount": "1000000000000000000000",
  "price": "1200000000000000",
  "orderType": "BUY",
  "userAddress": "0x123456789abcdef..."
}
```

**Order Reveal**:

```json
{
  "orderId": 123,
  "salt": "random_salt_string",
  "tokenA": "PEPE",
  "tokenB": "nUSD",
  "amount": "1000000000000000000000",
  "price": "1200000000000000",
  "orderType": "BUY"
}
```

**Batch Processing**:

```json
{
  "batchId": 17,
  "orders": [...] // Array of revealed orders
}
```

## 🎯 Features

- **Interactive Testing**: Try API calls directly from the browser
- **Request/Response Examples**: See exact data formats
- **Authentication Support**: Persistent auth (when implemented)
- **Error Documentation**: Comprehensive error response schemas
- **Production Ready**: Configured for both development and production environments

## 🔍 Example Usage

### Testing Order Submission Flow:

1. **Check System Health**:

   ```bash
   curl http://localhost:3001/api/health
   ```

2. **Submit Order**:

   ```bash
   curl -X POST http://localhost:3001/api/darkpool/order/submit \
     -H "Content-Type: application/json" \
     -d '{
       "tokenA": "PEPE",
       "tokenB": "nUSD",
       "amount": "1000000000000000000000",
       "price": "1200000000000000",
       "orderType": "BUY",
       "userAddress": "0x123..."
     }'
   ```

3. **Reveal Order**:

   ```bash
   curl -X POST http://localhost:3001/api/darkpool/order/reveal \
     -H "Content-Type: application/json" \
     -d '{
       "orderId": 123,
       "salt": "your_salt_from_submit_response",
       "tokenA": "PEPE",
       "tokenB": "nUSD",
       "amount": "1000000000000000000000",
       "price": "1200000000000000",
       "orderType": "BUY"
     }'
   ```

4. **Check Matching Stats**:
   ```bash
   curl http://localhost:3001/api/darkpool/matching/stats
   ```

## 🚀 Production Deployment

For production deployment:

1. Update server URLs in `src/config/swagger.ts`
2. Set proper CORS origins for swagger UI
3. Consider authentication/authorization
4. Enable HTTPS for security

## 💡 Tips

- Use the "Try it out" feature in Swagger UI for interactive testing
- Check the JSON schema for exact data types and formats
- All BigInt values are represented as strings in the API
- Most endpoints include example responses
- Error responses follow consistent schema patterns

---

**Ready to explore the API?** Start the server and visit http://localhost:3001/api-docs 🎉

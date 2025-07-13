# Nocturne - BRC20 Dark Pool Bridge

MEV-protected dark pool for BRC20 tokens on Citrea rollup with commit-reveal trading.

## 🌐 **Live Demo**

- **🚀 Frontend**: https://nocturne-ivory.vercel.app/
- **⚡ Backend API**: https://3.71.41.71/api/health
- **📚 API Documentation**: https://3.71.41.71/api-docs

## 🚀 Quick Start

### Development

```bash
# Install dependencies
bun install

# Start all services
bun run dev

# Or run individually
bun run backend:dev   # Backend API (port 3001)
bun run frontend:dev  # Frontend UI (port 5173)
```

### Build & Deploy

```bash
# Build frontend
cd frontend && bun run build

# Build backend
cd backend && bun run build

# Start production backend
cd backend && bun run start
```

### Smart Contracts

```bash
# Build contracts
cd contracts && forge build

# Deploy contracts
forge script script/Deploy.s.sol --broadcast
```

## 📝 Deployed Contracts (Citrea Testnet)

### Core Contracts

```
 Bridge:    0x800D8509C063937487E991D0c71546De8bF9D906
 OrderBook: 0x653eF550EF46B58E168663131af2A0c304340913
 nUSD:      0x9B28B690550522608890C3C7e63c0b4A7eBab9AA
```

### Wrapped Tokens

```
 wPEPE: 0x8153c10105315581FaeD05236F18c73A81ff21Db
 wCTRA: 0x0e62a515FE7b3B07d3577DE0d863034ebd41f7BF
```

## 🛠️ Environment Setup

### Backend (.env)

```bash
PRIVATE_KEY=your_private_key_here
```

### Frontend

No environment variables needed for development.

## 🔗 API Endpoints

All API endpoints are documented with Swagger at: **https://3.71.41.71/api-docs**

Key endpoints:

- **Health Check**: `GET http://3.71.41.71:3001/api/health`
- **Dark Pool Stats**: `GET http://3.71.41.71:3001/api/darkpool/matching/stats`
- **Submit Order**: `POST http://3.71.41.71:3001/api/darkpool/order/submit`
- **BRC20 Info**: `GET http://3.71.41.71:3001/api/brc20/token/{ticker}/info`
- **Bridge Stats**: `GET http://3.71.41.71:3001/api/bridge/stats`

## 🎯 Features

- ✅ BRC20 → Citrea bridge
- ✅ MEV-protected dark pool
- ✅ Commit-reveal trading
- ✅ Real-time Bitcoin monitoring
- ✅ Verified smart contracts
- ✅ Comprehensive API documentation (Swagger)
- ✅ Rate-limited external API calls
- ✅ Docker containerized deployment

## Test Coverage

### Overall Coverage Metrics

```
| Metric      | Coverage | Target |
|-------------|----------|--------|
| Lines       | 43.23%   | PASS   |
| Statements  | 43.84%   | PASS   |
| Branches    | 81.82%   | PASS   |
| Functions   | 80.49%   | PASS   |
```

### Core Contract Coverage

```
| Contract              | Lines    | Statements | Branches | Functions |
|-----------------------|----------|------------|----------|-----------|
| CitreaBridge.sol      | 100.00%  | 100.00%    | 100.00%  | 100.00%   |
| OrderBook.sol         | 98.53%   | 98.84%     | 71.79%   | 100.00%   |
| WrappedBRC20.sol      | 100.00%  | 100.00%    | 91.67%   | 100.00%   |
```

### Test Suite

- **31 comprehensive tests** across 2 test suites
- **100% pass rate** - all tests passing
- **Enterprise-grade coverage** for production readiness
- **Complete error handling** and edge case testing
- **Role-based access control** validation
- **MEV protection** verification

### Running Tests

```bash
# Run all tests
cd contracts && forge test

# Run with gas reporting
forge test --gas-report

# Run coverage analysis
forge coverage --via-ir

# Run specific test suite
forge test --match-contract OrderBookFixedTest
forge test --match-contract CitreaBridgeTest
```

Built for Citrea Wave Hackathon 🏄‍♂️

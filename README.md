# Nocturne - BRC20 Dark Pool Bridge

MEV-protected dark pool for BRC20 tokens on Citrea rollup with commit-reveal trading.

### Due to CORS issues, our production build is not getting data from my api. Use Development.

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
 wORDI: 0xdc572f9189F1d771e5c5c55BE1095B187e102481
 wCTRA: 0x0e62a515FE7b3B07d3577DE0d863034ebd41f7BF
```

## 🛠️ Environment Setup

### Backend (.env)

```bash
PRIVATE_KEY=your_private_key_here
```

### Frontend

No environment variables needed for development.

## 🌐 Live Demo

- **Frontend**: https://nocturne-ivory.vercel.app/
- **Backend**: https://nocturne-4coa.onrender.com

## 🎯 Features

- ✅ BRC20 → Citrea bridge
- ✅ MEV-protected dark pool
- ✅ Commit-reveal trading
- ✅ Real-time Bitcoin monitoring
- ✅ Verified smart contracts

Built for Citrea Wave Hackathon 🏄‍♂️

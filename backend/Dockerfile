# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app
# Copy package files first
COPY package*.json ./
# Install ALL dependencies (including dev) for building
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

FROM node:18-alpine AS production
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./
# Install only production dependencies
RUN npm install --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
# Copy source files for Swagger JSDoc comments
COPY --from=builder /app/src ./src

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001
USER backend

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"] 
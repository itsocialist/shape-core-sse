# Ship APE Core SSE - Multi-tenant MCP Server
# Dockerfile for production deployment

FROM node:20-alpine AS base

# Install dependencies needed for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Development stage
FROM base AS development
RUN npm ci
COPY . .
EXPOSE 3000
ENV NODE_ENV=development
ENV SHAPE_SSE_MODE=true
CMD ["npm", "run", "dev:sse"]

# Build stage (simplified - direct source copy)
FROM base AS build
RUN npm ci --ignore-scripts
COPY . .

# Production stage
FROM node:20-alpine AS production

# Install build dependencies and runtime dependencies
RUN apk add --no-cache \
    sqlite \
    python3 \
    make \
    g++ \
    gcc \
    libc-dev

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Rebuild better-sqlite3 for Alpine Linux
RUN npm rebuild better-sqlite3

# Install tsx globally before switching users
RUN npm install -g tsx

# Copy source files directly (bypassing TypeScript compilation for now)
COPY --chown=nodeuser:nodejs src ./src
COPY --chown=nodeuser:nodejs package.json ./

# Create directories for tenant data
RUN mkdir -p /app/tenant-data && \
    chown -R nodeuser:nodejs /app

# Switch to non-root user
USER nodeuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/health').then(r => r.json()).then(console.log)" || exit 1

# Expose port
EXPOSE 3000

# Environment variables
ENV NODE_ENV=production
ENV SHAPE_SSE_MODE=true
ENV PORT=3000
ENV TENANT_DATA_PATH=/app/tenant-data

# Start the application (using tsx for TypeScript execution)
CMD ["tsx", "src/index.ts"]

# Multi-stage build targets:
# docker build --target development -t ship-ape-core-sse:dev .
# docker build --target production -t ship-ape-core-sse:prod .
# docker build -t ship-ape-core-sse:latest .
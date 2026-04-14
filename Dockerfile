# ==========================================
# FujiTrace Proxy Server
# Multi-stage build for minimal production image
# ==========================================

# --- Stage 1: Build TypeScript ---
FROM node:20-alpine AS builder

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files and install all dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build
COPY tsconfig.json ./
COPY src/ ./src/
COPY api/ ./api/
COPY migrations/ ./migrations/

RUN npm run build

# --- Stage 2: Production dependencies ---
FROM node:20-alpine AS deps

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- Stage 3: Production image ---
FROM node:20-alpine

WORKDIR /app

# Copy production node_modules (with pre-compiled native modules)
COPY --from=deps /app/node_modules ./node_modules

# Copy built JavaScript
COPY --from=builder /app/dist ./dist

# Copy migrations for database setup
COPY --from=builder /app/migrations ./migrations

# Copy static assets (Japanese fonts for PDF generation, etc.)
COPY assets/ ./assets/

# Copy package.json for Node.js module resolution
COPY package.json ./

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/src/index.js"]

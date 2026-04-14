# ==========================================
# FujiTrace Dashboard (React + Vite → Nginx)
# ==========================================

# --- Stage 1: Build React app ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY packages/dashboard/package.json packages/dashboard/package-lock.json ./
RUN npm ci

# Copy source code
COPY packages/dashboard/ ./

# Build-time environment variables (Supabase config)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

RUN npm run build

# --- Stage 2: Serve with Nginx ---
FROM nginx:alpine

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

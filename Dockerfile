# syntax=docker/dockerfile:1

# --- Backend builder ---
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend

# Install backend dependencies
COPY backend/package*.json backend/tsconfig.json ./
RUN npm ci

# Build backend (TypeScript -> dist)
COPY backend/. ./
RUN npm run build

# --- Frontend builder ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

ENV NEXT_TELEMETRY_DISABLED=1

# Install frontend dependencies
COPY frontend/package*.json ./
RUN npm ci

# Build Next.js app
COPY frontend/. ./
RUN npm run build

# --- Runtime image ---
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    NEXT_PUBLIC_BACKEND_URL=http://localhost:3001

# Prepare backend runtime deps (production only)
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend built artifacts
COPY --from=backend-builder /app/backend/dist ./dist

# Prepare frontend runtime deps (production only)
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --omit=dev

# Copy frontend build output and minimal files required by next start
COPY --from=frontend-builder /app/frontend/.next ./.next
COPY --from=frontend-builder /app/frontend/public ./public
COPY frontend/next.config.ts ./next.config.ts

# Copy start script
WORKDIR /app
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 8080

# The container starts Next.js on $PORT and the backend on 3001
CMD ["/bin/sh", "/app/start.sh"]

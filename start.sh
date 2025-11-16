#!/bin/sh
set -e

# Default ports
: "${PORT:=8080}"
BACKEND_PORT=3001

echo "Starting backend on port ${BACKEND_PORT}..."
PORT=${BACKEND_PORT} node /app/backend/dist/index.js &

echo "Starting Next.js frontend on port ${PORT}..."
cd /app/frontend
node node_modules/next/dist/bin/next start -p ${PORT}

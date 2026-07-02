#!/usr/bin/env bash
# Start all local dev services: API → Web
# Database: Windows PostgreSQL 18 at 172.31.112.1:5433
set -e

REPO="$(cd "$(dirname "$0")" && pwd)"
DB_URL="postgres://postgres:root@172.31.112.1:5433/ops_dashboard"

echo "==> Running migrations..."
cd "$REPO"
DATABASE_URL="$DB_URL" bun run scripts/migrate.ts

echo "==> Starting API (port 3001)..."
cd "$REPO/apps/api"
DATABASE_URL="$DB_URL" \
  SESSION_SECRET=dev00000000000000000000000000001 \
  ANTHROPIC_API_KEY= \
  PORT=3001 \
  NODE_ENV=development \
  bun run src/index.ts &>> /tmp/api.log &
echo "    API PID: $!"

echo "==> Starting Web (port 5173)..."
cd "$REPO/apps/web"
bun run dev &>> /tmp/web.log &
echo "    Web PID: $!"

echo ""
echo "Services started. Logs:"
echo "  API  → /tmp/api.log"
echo "  Web  → /tmp/web.log"
echo ""
echo "  API  → http://localhost:3001"
echo "  Web  → http://localhost:5173"
echo "  Login: admin@ops.local / admin123"

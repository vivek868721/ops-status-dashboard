#!/usr/bin/env bash
# Start all local dev services: PostgreSQL → API → Web
set -e

REPO="$(cd "$(dirname "$0")" && pwd)"
PG_BIN="$REPO/node_modules/@embedded-postgres/linux-x64/native/bin"
PG_DATA="$HOME/.pg-data"

echo "==> Starting PostgreSQL..."
$PG_BIN/pg_ctl -D "$PG_DATA" -l "$PG_DATA/postgres.log" start || true

echo "==> Starting API (port 3001)..."
cd "$REPO/apps/api"
DATABASE_URL=postgres://vivek@127.0.0.1:5432/ops_dashboard \
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

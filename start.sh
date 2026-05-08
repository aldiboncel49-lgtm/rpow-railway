#!/bin/sh
set -e

echo "═══════════════════════════════════════"
echo "  rpow2 — Starting services"
echo "═══════════════════════════════════════"

# ─── Fungsi restart miner ───────────────────────────────────────────────────
start_miner() {
  echo "[MINER] Starting auto-miner..."
  while true; do
    node --experimental-strip-types /app/miner-bot/miner.ts
    EXIT_CODE=$?
    if [ "$EXIT_CODE" = "0" ]; then
      echo "[MINER] Mining selesai (supply exhausted). Berhenti."
      break
    fi
    echo "[MINER] Crashed (exit=$EXIT_CODE). Restart dalam 10 detik..."
    sleep 10
  done
}

# ─── Jalankan server di background ─────────────────────────────────────────
echo "[SERVER] Starting rpow2 server..."
node apps/server/dist/server.js &
SERVER_PID=$!

# ─── Tunggu server ready ────────────────────────────────────────────────────
echo "[SERVER] Waiting for server to be ready..."
RETRIES=30
until node -e "fetch('http://localhost:${PORT:-8080}/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))" 2>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" = "0" ]; then
    echo "[SERVER] Server gagal start! Check logs."
    exit 1
  fi
  echo "[SERVER] Belum ready, retry... ($RETRIES)"
  sleep 2
done
echo "[SERVER] ✅ Server ready!"

# ─── Jalankan miner jika RPOW_EMAIL di-set ──────────────────────────────────
if [ -n "$RPOW_EMAIL" ] || [ -n "$RPOW_SESSION_COOKIE" ]; then
  echo "[MINER] Starting miner..."
  # Set server URL ke localhost karena satu container
  export RPOW_SERVER_URL="http://localhost:${PORT:-8080}"
  start_miner &
  MINER_PID=$!
  echo "[MINER] PID=$MINER_PID"
else
  echo "[MINER] RPOW_EMAIL tidak di-set — miner tidak dijalankan"
  echo "[MINER] Set RPOW_EMAIL=kamu@gmail.com untuk aktifkan auto-miner"
fi

# ─── Trap signal untuk graceful shutdown ────────────────────────────────────
trap 'echo "Shutting down..."; kill $SERVER_PID $MINER_PID 2>/dev/null; exit 0' TERM INT

# ─── Tunggu server process ──────────────────────────────────────────────────
wait $SERVER_PID

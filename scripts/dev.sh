#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export ROOT

PIDS=()

start() {
  echo "==> starting $1"
  shift
  "$@" &
  PIDS+=("$!")
}

kill_tree() {
  local pid="$1" child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child"
  done
  kill -TERM "$pid" 2>/dev/null || true
}

cleanup() {
  trap - EXIT INT TERM
  echo
  echo "==> stopping dev processes"
  for pid in "${PIDS[@]:-}"; do
    kill_tree "$pid"
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if ! command -v docker >/dev/null || ! command -v pnpm >/dev/null; then
  echo "docker and pnpm are required" >&2
  exit 1
fi

port_open() {
  (echo > "/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1
}

infra=()
port_open 27017 || infra+=(mongo)
port_open 6379 || infra+=(redis)
port_open 6333 || infra+=(qdrant)

if [ "${#infra[@]}" -gt 0 ]; then
  echo "==> starting ${infra[*]}"
  docker compose up -d "${infra[@]}"
else
  echo "==> mongo, redis, qdrant already running"
fi

echo "==> building @dbnodesfs/shared"
pnpm --filter @dbnodesfs/shared build

if ! .venv/bin/python -c "import fastembed" >/dev/null 2>&1; then
  echo "==> installing embedder deps into .venv (first run only)"
  [ -x .venv/bin/python ] || python3 -m venv .venv
  .venv/bin/python -m pip install --quiet --upgrade pip
  .venv/bin/python -m pip install --quiet -r apps/embedder/requirements.txt
fi

start "embedder :8000" \
  .venv/bin/python -m uvicorn app:app --app-dir apps/embedder --host 0.0.0.0 --port 8000

NODE_COUNT=3
[ -f "$ROOT/.env" ] && NODE_COUNT=$(grep -E '^NODE_COUNT=' "$ROOT/.env" | cut -d= -f2)
NODE_COUNT="${NODE_COUNT:-3}"

for i in $(seq 1 "$NODE_COUNT"); do
  PORT=$((5000 + i))
  start "storage-node node-$i :$PORT" \
    env STORAGE_NODE_ID="node-$i" STORAGE_NODE_PORT="$PORT" \
        STORAGE_NODE_ADVERTISE_URL="http://localhost:$PORT" \
        STORAGE_NODE_DATA_DIR="$ROOT/data/node-$i" \
    pnpm --filter @dbnodesfs/storage-node dev
done

start "coordinator :4000" pnpm --filter @dbnodesfs/coordinator dev
start "worker" pnpm --filter @dbnodesfs/worker dev
start "web :5173" pnpm --filter @dbnodesfs/web dev

echo
echo "  web         http://localhost:5173"
echo "  coordinator http://localhost:4000/health"
echo "  embedder    http://localhost:8000/health"
echo "  nodes       http://localhost:5001/health .. http://localhost:$((5000 + NODE_COUNT))/health  ($NODE_COUNT nodes)"
echo
echo "press ctrl-c to stop (mongo/redis/qdrant stay running)"
echo

wait

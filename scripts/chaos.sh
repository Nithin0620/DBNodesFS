#!/usr/bin/env bash
set -euo pipefail

node="${1:-storage-node-2}"

docker compose stop "$node"
echo "stopped $node; waiting for heartbeat timeout"
sleep 20
curl -s http://localhost:4000/health || true
echo
docker compose start "$node"
echo "restarted $node"

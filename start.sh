#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
python3 server.py >/tmp/roller-tune.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
open "http://127.0.0.1:8000" 2>/dev/null || true
wait "$server_pid"

#!/usr/bin/env bash
# Stop whatever is listening on the given TCP port(s) so a service can start on its static port.
# Usage: spec/harness/free-port.sh 4004 [4001 ...]
set -euo pipefail
[ $# -ge 1 ] || { echo "usage: $0 <port> [port ...]" >&2; exit 2; }
for port in "$@"; do
  pids=$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null || true)
  if [ -z "$pids" ]; then echo "port ${port}: free"; continue; fi
  kill $pids 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 0.5
    lsof -ti "tcp:${port}" -sTCP:LISTEN >/dev/null 2>&1 || break
  done
  if lsof -ti "tcp:${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    kill -9 $(lsof -ti "tcp:${port}" -sTCP:LISTEN) 2>/dev/null || true
  fi
  echo "port ${port}: freed"
done

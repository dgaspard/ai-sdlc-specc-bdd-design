#!/usr/bin/env bash
# Portable: dependency vulnerability audit. Detects whether it's pointed at a
# JavaScript or Python manifest and runs the matching tool — no project
# knowledge beyond "here's a directory with a manifest in it".
#
# Usage: run-dependency-audit.sh <path-with-manifest> <output.json>

set -euo pipefail
TARGET="${1:?usage: run-dependency-audit.sh <path-with-manifest> <output.json>}"
OUT="${2:?usage: run-dependency-audit.sh <path-with-manifest> <output.json>}"

if [ -f "$TARGET/package.json" ]; then
  ( cd "$TARGET" && npm audit --json ) > "$OUT" || true
elif [ -f "$TARGET/requirements.txt" ]; then
  pip-audit -r "$TARGET/requirements.txt" -f json > "$OUT" || true
else
  echo "{\"error\": \"no package.json or requirements.txt found in $TARGET\"}" > "$OUT"
fi

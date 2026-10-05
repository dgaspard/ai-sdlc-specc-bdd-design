#!/usr/bin/env bash
# Portable: duplicate-code detection via jscpd. Takes no project-specific
# knowledge beyond the paths it's pointed at — usable against any JS/TS
# codebase as-is. Mirrors tools/security/portable/run-sast.sh's shape: a
# thin wrapper around the real scanner, not a parallel implementation.
#
# Usage: run-dupe-check.sh <path-to-scan> <output-dir>
#
# Needs real npm-registry access to install jscpd — see
# tools/review/README.md for why this can't run inside an agent sandbox
# with restricted outbound network.

set -euo pipefail
TARGET="${1:?usage: run-dupe-check.sh <path-to-scan> <output-dir>}"
OUT="${2:?usage: run-dupe-check.sh <path-to-scan> <output-dir>}"

npx --yes jscpd "$TARGET" \
  --reporters json,console \
  --output "$OUT" \
  --min-lines 5 \
  --min-tokens 50 \
  --ignore "**/node_modules/**,**/.spike-output/**"

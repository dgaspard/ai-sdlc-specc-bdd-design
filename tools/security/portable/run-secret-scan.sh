#!/usr/bin/env bash
# Portable: secret scanning via detect-secrets. No project knowledge needed.
#
# Usage: run-secret-scan.sh <path-to-scan> <output.json>

set -euo pipefail
TARGET="${1:?usage: run-secret-scan.sh <path-to-scan> <output.json>}"
OUT="${2:?usage: run-secret-scan.sh <path-to-scan> <output.json>}"

detect-secrets scan "$TARGET" > "$OUT" || true

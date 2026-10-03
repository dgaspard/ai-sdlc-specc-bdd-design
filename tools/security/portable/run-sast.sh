#!/usr/bin/env bash
# Portable: static analysis via Semgrep. Takes no project-specific knowledge
# — usable against any JavaScript or Python codebase as-is.
#
# Usage: run-sast.sh <path-to-scan> <output.json>

set -euo pipefail
TARGET="${1:?usage: run-sast.sh <path-to-scan> <output.json>}"
OUT="${2:?usage: run-sast.sh <path-to-scan> <output.json>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

semgrep --config auto --config "$HERE/semgrep-rules" --json "$TARGET" > "$OUT" || true

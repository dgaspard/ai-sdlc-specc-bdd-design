#!/usr/bin/env bash
# ENG-02 calibration, layer L1 (network-dependent gates). Run locally — it
# needs network to install jscpd and Semgrep, which the agent sandbox lacks.
#
#   bash tools/review/project-specific/run-calibration-gates.sh
#
# Scans services/ twice — once clean, once with every CAL-xx defect from
# calibration-manifest.md planted — so a finding only counts as a catch if
# it appears in the planted scan and not the clean one. Both copies are
# throwaway temp dirs; the real tree is never modified.
#
# Output: test-results/eng-02-calibration/ (gitignored). Tell the agent when
# it's done; it reads the JSON and fills in the L1 column.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
OUT="$ROOT/test-results/eng-02-calibration"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$OUT"

python3 -m pip install --user --quiet --break-system-packages semgrep detect-secrets
USER_BIN="$(python3 -m site --user-base 2>/dev/null)/bin"
[ -d "$USER_BIN" ] && export PATH="$USER_BIN:$PATH"
{ semgrep --version; detect-secrets --version; npx --yes jscpd --version; node --version; } > "$OUT/versions.txt" 2>&1

for variant in clean planted; do
  mkdir -p "$WORK/$variant"
  # Only services/ is scanned; tools/ (and this answer key) never enter the copy.
  cp -R "$ROOT/services" "$WORK/$variant/services"
  rm -rf "$WORK/$variant/services/platform/node_modules"
  if [ "$variant" = planted ]; then
    node "$ROOT/tools/review/project-specific/plant-calibration-defects.mjs" "$WORK/$variant"
  fi
  bash "$ROOT/tools/review/portable/run-dupe-check.sh" "$WORK/$variant/services" "$OUT/jscpd-$variant" > "$OUT/jscpd-$variant.txt" 2>&1 || true
  bash "$ROOT/tools/security/portable/run-sast.sh" "$WORK/$variant/services" "$OUT/semgrep-$variant.json"
  bash "$ROOT/tools/security/portable/run-secret-scan.sh" "$WORK/$variant/services" "$OUT/secrets-$variant.json"
done

echo "Done. Results in $OUT"

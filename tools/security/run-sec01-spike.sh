#!/usr/bin/env bash
# SEC-01 security spike runner.
#
# Needs real network access (pip/npm installs, vulnerability databases) — run
# this on a machine with internet, e.g. via Claude Code locally or straight
# from your own terminal. It will not work inside a network-restricted agent
# sandbox. See README.md in this folder.
#
# What it does:
#   1. Installs the scanners: semgrep, bandit, pip-audit, detect-secrets
#      (npm audit uses the npm already on your machine).
#   2. Scans the real builds: services/checkout (JS) + services/platform's
#      dependencies, and the Python Checkout rebuild from a DEMO-01 rehearsal
#      workspace (r1 by default).
#   3. Makes a throwaway scratch copy of both, plants the known calibration
#      defects documented in calibration-defects.md, rescans, and reports
#      which scanner caught which defect.
#   4. Leaves raw JSON output under tools/security/.spike-output/ (gitignored)
#      so you — or a follow-up Claude Code session reading this repo — can
#      turn it into docs/engineering-reviews/sec-01-spike.md. A starting
#      template for that file already exists.
#
# Usage:
#   bash tools/security/run-sec01-spike.sh
#   SEC01_PY_CHECKOUT=/path/to/other/rebuild bash tools/security/run-sec01-spike.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PY_REBUILD="${SEC01_PY_CHECKOUT:-$HOME/petclinic-demo-runs/r1/services/checkout}"
OUT_DIR="$ROOT/tools/security/.spike-output"
CAL="$(mktemp -d)"
trap 'rm -rf "$CAL"' EXIT

mkdir -p "$OUT_DIR"

echo "== Installing scanners (needs network) =="
pip install --user --quiet --break-system-packages bandit pip-audit semgrep detect-secrets
echo "Tool versions:" | tee "$OUT_DIR/versions.txt"
{
  bandit --version 2>&1 | head -1
  pip-audit --version 2>&1
  semgrep --version 2>&1
  detect-secrets --version 2>&1
  npm --version 2>&1 | sed 's/^/npm /'
  node --version 2>&1 | sed 's/^/node /'
  python3 --version 2>&1
} | tee -a "$OUT_DIR/versions.txt"

echo
echo "== Real-build scan: JavaScript Checkout (impl-02) =="
semgrep --config auto --json "$ROOT/services/checkout" > "$OUT_DIR/js-semgrep.json" || true
detect-secrets scan "$ROOT/services/checkout" > "$OUT_DIR/js-secrets.json" || true
( cd "$ROOT/services/platform" && npm audit --json ) > "$OUT_DIR/js-platform-audit.json" || true

echo "== Real-build scan: Python Checkout rebuild ($PY_REBUILD) =="
if [ -d "$PY_REBUILD" ]; then
  bandit -r "$PY_REBUILD" -f json > "$OUT_DIR/py-bandit.json" || true
  semgrep --config auto --json "$PY_REBUILD" > "$OUT_DIR/py-semgrep.json" || true
  detect-secrets scan "$PY_REBUILD" > "$OUT_DIR/py-secrets.json" || true
  if [ -f "$PY_REBUILD/../requirements.txt" ]; then
    REQ="$PY_REBUILD/../requirements.txt"
  else
    REQ="$PY_REBUILD/requirements.txt"
  fi
  if [ -f "$REQ" ]; then
    pip-audit -r "$REQ" -f json > "$OUT_DIR/py-audit.json" || true
  else
    echo "WARNING: no requirements.txt found near $PY_REBUILD, skipping pip-audit" >&2
  fi
else
  echo "WARNING: Python rebuild not found at $PY_REBUILD" >&2
  echo "Set SEC01_PY_CHECKOUT to point at a rehearsal workspace's" >&2
  echo "services/checkout directory (e.g. ~/petclinic-demo-runs/r1/services/checkout)." >&2
fi

echo
echo "== Calibration: planting known defects in a scratch copy =="
echo "See tools/security/calibration-defects.md for the full list and rationale."
mkdir -p "$CAL/checkout-js" "$CAL/checkout-py"
cp -r "$ROOT/services/checkout/." "$CAL/checkout-js/"

cat > "$CAL/checkout-js/scratch-defect-examples.js" <<'EOF'
// SEC-01 calibration only — never imported, never deployed, never committed.
// Standalone examples of planted defect classes; see calibration-defects.md.

// Defect 1: non-constant-time secret/token comparison.
export function badTokenCompare(a, b) {
  return a === b;
}

// Defect 2: secret logged at error level.
export function badErrorLog(err, signingSecret) {
  console.error('checkout failed', err, 'secret=', signingSecret);
}

// Defect 3: injection-shaped string concatenation.
export function badQuery(db, customerId) {
  return db.query("SELECT * FROM visits WHERE customer_id = '" + customerId + "'");
}

// Defect 4: overly broad CORS.
export function badCors(app) {
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
  });
}

// Defect 5: a route that skips the auth hook.
export function badRoute(app, requireAuth, handler) {
  app.post('/internal/replay-payment', handler); // missing requireAuth
}
EOF

if [ -d "$PY_REBUILD" ]; then
  cp -r "$PY_REBUILD/." "$CAL/checkout-py/"
  cat > "$CAL/checkout-py/scratch_defect_examples.py" <<'EOF'
# SEC-01 calibration only — never imported, never deployed, never committed.

import subprocess

# Defect 6: injection-shaped string concatenation (shell form).
def bad_shell(customer_id):
    return subprocess.run("grep " + customer_id + " visits.log", shell=True)

# Defect 7: non-constant-time secret comparison.
def bad_token_compare(a, b):
    return a == b
EOF
fi

echo "-- Defect 8 (dependency with a known CVE) is manual: in the calibration"
echo "   copy only, pin one services/platform dependency in"
echo "   $CAL/checkout-js/../platform/package.json down to a version with a"
echo "   published advisory, run npm audit again, and confirm it's flagged."
echo "   Record the exact package/version/advisory ID in the write-up."

echo
echo "== Re-scanning the calibration copy =="
semgrep --config auto --json "$CAL/checkout-js" > "$OUT_DIR/cal-js-semgrep.json" || true
detect-secrets scan "$CAL/checkout-js" > "$OUT_DIR/cal-js-secrets.json" || true
if [ -d "$PY_REBUILD" ]; then
  bandit -r "$CAL/checkout-py" -f json > "$OUT_DIR/cal-py-bandit.json" || true
  semgrep --config auto --json "$CAL/checkout-py" > "$OUT_DIR/cal-py-semgrep.json" || true
fi

echo
echo "== Done. Raw output saved under: $OUT_DIR =="
echo "Calibration scratch copy (with planted vulnerabilities) was at: $CAL"
echo "— it is deleted now that the scan finished; nothing vulnerable is kept."
echo
echo "Next: open each JSON file in $OUT_DIR and fill in"
echo "docs/engineering-reviews/sec-01-spike.md (template already there) —"
echo "or point a Claude Code session at this repo and ask it to read"
echo "$OUT_DIR and write that file up."

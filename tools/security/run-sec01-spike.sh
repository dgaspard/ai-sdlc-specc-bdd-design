#!/usr/bin/env bash
# SEC-01 security spike runner.
#
# Needs real network access (pip/npm installs, vulnerability databases) — run
# this on a machine with internet, e.g. via Claude Code locally or straight
# from your own terminal. It will not work inside a network-restricted agent
# sandbox. See README.md in this folder.
#
# This script is a thin orchestrator: the actual checks live in
# portable/run-*.sh, the same scripts a real CI job would call. Running the
# spike through them (rather than duplicating tool invocations here) means
# the spike measures exactly what a future required check would measure.
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
PORTABLE="$ROOT/tools/security/portable"
PY_REBUILD="${SEC01_PY_CHECKOUT:-$HOME/petclinic-demo-runs/r1/services/checkout}"
OUT_DIR="$ROOT/tools/security/.spike-output"
CAL="$(mktemp -d)"
trap 'rm -rf "$CAL"' EXIT

mkdir -p "$OUT_DIR"

echo "== Installing scanners (needs network) =="
python3 -m pip install --user --quiet --break-system-packages bandit pip-audit semgrep detect-secrets

# `pip install --user` often lands commands in a directory that isn't on
# PATH (pip prints a warning about this during install, easy to miss in a
# long install log) — resolve it from the same interpreter that just did the
# install and prepend it, instead of assuming the shell's PATH is already
# set up for it.
USER_BIN="$(python3 -m site --user-base 2>/dev/null)/bin"
if [ -d "$USER_BIN" ]; then
  export PATH="$USER_BIN:$PATH"
fi

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
"$PORTABLE/run-sast.sh" "$ROOT/services/checkout" "$OUT_DIR/js-semgrep.json"
"$PORTABLE/run-secret-scan.sh" "$ROOT/services/checkout" "$OUT_DIR/js-secrets.json"
"$PORTABLE/run-dependency-audit.sh" "$ROOT/services/platform" "$OUT_DIR/js-platform-audit.json"
echo "(Compare against tools/security/project-specific/cors-policy.json —"
echo " this app's real CORS config — to confirm defect #4 is genuinely"
echo " absent from the real build, not just unflagged.)"

echo
echo "== Real-build scan: Python Checkout rebuild ($PY_REBUILD) =="
if [ -d "$PY_REBUILD" ]; then
  bandit -r "$PY_REBUILD" -f json > "$OUT_DIR/py-bandit.json" || true
  "$PORTABLE/run-sast.sh" "$PY_REBUILD" "$OUT_DIR/py-semgrep.json"
  "$PORTABLE/run-secret-scan.sh" "$PY_REBUILD" "$OUT_DIR/py-secrets.json"
  if [ -f "$PY_REBUILD/../requirements.txt" ]; then
    REQ_DIR="$(cd "$PY_REBUILD/.." && pwd)"
  else
    REQ_DIR="$PY_REBUILD"
  fi
  "$PORTABLE/run-dependency-audit.sh" "$REQ_DIR" "$OUT_DIR/py-audit.json"
else
  echo "WARNING: Python rebuild not found at $PY_REBUILD" >&2
  echo "Set SEC01_PY_CHECKOUT to point at a rehearsal workspace's" >&2
  echo "services/checkout directory (e.g. ~/petclinic-demo-runs/r1/services/checkout)." >&2
fi

echo
echo "== Calibration: planting known defects in a scratch copy =="
echo "See tools/security/calibration-defects.md for the full list and rationale."
mkdir -p "$CAL/checkout-js" "$CAL/checkout-py" "$CAL/platform"
cp -r "$ROOT/services/checkout/." "$CAL/checkout-js/"
cp -r "$ROOT/services/platform/." "$CAL/platform/"

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

echo "-- Defect 8 (dependency with a known CVE) is manual: pin one dependency"
echo "   in $CAL/platform/package.json down to a version with a published"
echo "   advisory, then run, in another terminal (the scratch copy is still"
echo "   here — it's only deleted when this script exits):"
echo "     tools/security/portable/run-dependency-audit.sh $CAL/platform $OUT_DIR/cal-dependency-audit.json"
echo "   and confirm it's flagged. Record the exact package/version/advisory"
echo "   ID in the write-up."
read -r -p "Press Enter once defect #8 is done (or to skip it) — this deletes the scratch copy: " _

echo
echo "== Re-scanning the calibration copy =="
"$PORTABLE/run-sast.sh" "$CAL/checkout-js" "$OUT_DIR/cal-js-semgrep.json"
"$PORTABLE/run-secret-scan.sh" "$CAL/checkout-js" "$OUT_DIR/cal-js-secrets.json"
if [ -d "$PY_REBUILD" ]; then
  bandit -r "$CAL/checkout-py" -f json > "$OUT_DIR/cal-py-bandit.json" || true
  "$PORTABLE/run-sast.sh" "$CAL/checkout-py" "$OUT_DIR/cal-py-semgrep.json"
fi

echo
echo "== Done. Raw output saved under: $OUT_DIR =="
echo "Calibration scratch copy (with planted vulnerabilities) was at: $CAL"
echo "— run defect #8 manually now if you haven't, then it will be deleted"
echo "when this script exits. Nothing vulnerable is kept around afterward."
echo
echo "Next: open each JSON file in $OUT_DIR and fill in"
echo "docs/engineering-reviews/sec-01-spike.md (template already there) —"
echo "or point a Claude Code session at this repo and ask it to read"
echo "$OUT_DIR and write that file up."

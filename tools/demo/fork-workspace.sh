#!/usr/bin/env bash
# Copy a finished demo workspace so the next rehearsal starts from its rebuilt
# Checkout (for example Python -> JavaScript -> Python). Run from the main repo.
#
#   tools/demo/fork-workspace.sh <from-run> <to-run>     e.g. r1 r2
#
# The source workspace is left untouched as the record of its run. The copy gets
# the main repo's current tools/demo (scripts, prompts, demo baselines).
set -euo pipefail

repo="$(cd "$(dirname "$0")/../.." && pwd)"
runs="${DEMO_RUNS_DIR:-$HOME/petclinic-demo-runs}"
from="$runs/${1:?usage: $0 <from-run> <to-run>}"
to="$runs/${2:?usage: $0 <from-run> <to-run>}"

[ -f "$from/.demo/source-tag" ] || {
  echo "$from is not a demo workspace." >&2
  exit 1
}
[ -d "$from/services/checkout" ] || {
  echo "$from has no services/checkout to start from." >&2
  exit 1
}
[ -e "$to" ] && {
  echo "Refusing to overwrite existing $to" >&2
  exit 1
}
for cmd in claude python3.12 node; do
  command -v "$cmd" >/dev/null || {
    echo "Missing '$cmd' on PATH." >&2
    exit 1
  }
done

cp -R "$from" "$to"
rm -rf "$to/tools/demo"
cp -R "$repo/tools/demo" "$to/tools/demo"
rm -f "$to/.demo/deleted-at" "$to/.demo/direction"
echo "forked from $(basename "$from")" > "$to/.demo/forked-from"

# A copied Python virtual environment keeps paths to the old folder; rebuild it.
if [ -f "$to/services/checkout/requirements.txt" ]; then
  rm -rf "$to/services/checkout/.venv"
  "$to/services/checkout/setup"
fi

echo
echo "Ready: $to"
echo "Next:  cd \"$to\" && npm run demo:journey    # 'before' run"

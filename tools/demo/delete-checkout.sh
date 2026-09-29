#!/usr/bin/env bash
# On-stage step: ask the presenter, then delete the JavaScript Checkout (timed).
# Run inside a workspace created by prepare-rehearsal.sh, never in the main repo.
set -euo pipefail

cd "$(dirname "$0")/../.."
if [ ! -f .demo/source-tag ]; then
  echo "This is not a disposable demo workspace (no .demo/source-tag). Aborting." >&2
  latest=$(ls -td "${DEMO_RUNS_DIR:-$HOME/petclinic-demo-runs}"/*/ 2>/dev/null | head -1)
  [ -n "$latest" ] && echo "Newest workspace: cd \"${latest%/}\"" >&2
  exit 1
fi
if [ ! -d services/checkout ]; then
  echo "services/checkout is already gone." >&2
  exit 1
fi

echo "About to delete services/checkout/ (the JavaScript Checkout service)."
echo "Contracts, features, tests, and the other services stay."
read -r -p "Delete it now? [y/N] " answer
case "$answer" in
  y | Y | yes | YES) ;;
  *)
    echo "Nothing deleted."
    exit 0
    ;;
esac

start=$(date +%s)
rm -rf services/checkout
# From now on the rebuilt service is tracked normally.
sed -i '' '/^services\/checkout\/$/d' .git/info/exclude 2>/dev/null ||
  sed -i '/^services\/checkout\/$/d' .git/info/exclude
end=$(date +%s)

echo "$end" > .demo/deleted-at
echo "Deleted in $((end - start)) s at $(date '+%H:%M:%S')."
echo
echo "Start the rebuild in a fresh Claude Code session:"
echo "  claude \"\$(cat tools/demo/rebuild-checkout-prompt.md)\""
echo "When it reports done:  tools/demo/finish-rehearsal.sh"

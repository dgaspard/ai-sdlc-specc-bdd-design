#!/usr/bin/env bash
# After the rebuild: rerun the visible journey and the full aggregate, and report
# elapsed time since deletion. Appends one line to .demo/run.log.
set -uo pipefail

cd "$(dirname "$0")/../.."
if [ ! -f .demo/deleted-at ]; then
  echo "No deletion recorded (.demo/deleted-at). Run delete-checkout.sh first." >&2
  latest=$(ls -td "${DEMO_RUNS_DIR:-$HOME/petclinic-demo-runs}"/*/ 2>/dev/null | head -1)
  [ -n "$latest" ] && echo "Newest workspace: cd \"${latest%/}\"" >&2
  exit 1
fi

rebuilt=$(date +%s)
deleted=$(cat .demo/deleted-at)

npm run demo:journey
journey=$?
npm test
aggregate=$?
done_at=$(date +%s)

fmt() { printf '%dm%02ds' $(($1 / 60)) $(($1 % 60)); }
result=$([ $journey -eq 0 ] && [ $aggregate -eq 0 ] && echo PASS || echo FAIL)
line="$(date '+%F %T') source=$(cat .demo/source-tag) rebuild=$(fmt $((rebuilt - deleted))) total=$(fmt $((done_at - deleted))) journey=$journey aggregate=$aggregate result=$result"
echo "$line" >> .demo/run.log

echo
echo "Rebuild (deletion → agent done): $(fmt $((rebuilt - deleted)))"
echo "Total including verification:    $(fmt $((done_at - deleted)))"
echo "Result: $result"
[ "$result" = PASS ]

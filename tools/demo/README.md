# Presenter demo tools (A-12)

Not protected and not part of `npm test`. These files only change how the frozen
tests are *shown*; they never change what the tests assert.

## Visible customer journey

```
npm run demo:journey
```

Runs the frozen FE-002 journey (login → book → veterinarian accepts and records
the visit → bill → pay) in a visible Chromium window, slowed so the audience can
follow. It uses `spec/tests/browser/playwright.config.js` unchanged except for:

| Setting | Frozen suite | Demo |
| --- | --- | --- |
| Tests | all FE checks | FE-002 only |
| Browser | headless | visible |
| Action delay | none | 400 ms (`DEMO_SLOWMO_MS`) |
| Test timeout | 30 s | 180 s (slowed actions need more time) |
| Output | `test-results/browser` | `test-results/demo` |
| Screenshot baselines | `spec/frontend/visual-baselines/` | `tools/demo/visual-baselines-headed/` |

Assertions, screenshot tolerances, fixtures, and the test file are the frozen ones.

### Why separate screenshot baselines

The visible Chromium smooths text edges differently from the headless shell used
by `npm test` (first run: 824 differing pixels, all on text edges; layout, colors
and content matched). The demo therefore compares against baselines captured from
the visible browser, with the same frozen tolerance. The frozen headless suite
still checks the original baselines on every `npm test`.

Create or refresh them only on the presenter's Mac, then review the images before
committing:

```
npm run demo:baselines
```

Regenerate only when the frozen baselines in `spec/frontend/visual-baselines/`
change, or after a Chromium upgrade, never to make a failing demo pass.
Change the pace with `DEMO_SLOWMO_MS=700 npm run demo:journey`.
`DEMO_HEADLESS=1` runs the same demo without a window (for checks only).

## Rehearsal and on-stage flow

| Step | Command | Timed |
| --- | --- | --- |
| 1. Prepare a disposable workspace | `tools/demo/prepare-rehearsal.sh [name]` (from the main repo) | no |
| 2. JavaScript "before" run | `npm run demo:journey` (in the workspace) | no |
| 3. Delete Checkout (asks first) | `tools/demo/delete-checkout.sh` | yes, starts the clock |
| 4. Rebuild in fresh Claude Code | `claude "$(cat tools/demo/rebuild-checkout-prompt.md)"` | yes |
| 5. Verify and report | `tools/demo/finish-rehearsal.sh` | yes |

Workspaces go to `~/petclinic-demo-runs/<name>` (override with `DEMO_RUNS_DIR`),
built from tag `demo-01-baseline`. Each has a fresh git history that never
contained the JavaScript Checkout, and all dependencies are preinstalled. Step 5
appends timings and the result to `.demo/run.log` in that workspace.

Disclosed limits: the rebuild prompt is prepared and identical every run; the
shared JavaScript `services/platform/` and project docs (including the JavaScript
engineering review) remain readable; Claude Code's own settings keep it inside the
workspace, but the main repo still exists on the same machine.

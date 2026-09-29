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

Assertions, screenshot tolerances, fixtures, and the test file are the frozen ones.
Change the pace with `DEMO_SLOWMO_MS=700 npm run demo:journey`.
`DEMO_HEADLESS=1` runs the same demo without a window (for checks only).

Demo order: run this before deleting `services/checkout/`, then again after the
Python rebuild, then `npm test` for the full aggregate.

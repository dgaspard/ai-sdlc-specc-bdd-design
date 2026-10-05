# ENG-02 — connected-trace capture, applied across every build

Date: 2026-10-04/05. Supports `BACKLOG.md`'s ENG-02 automated-gates item:
"Connected-trace capture (`npm run trace:payment`) against every build,
including Python."

## What this gate checks

`tools/capture-payment-trace.mjs` drives a real payment through the running
Checkout/Customer/Reservation services and asserts (via
`assertCrossProcessParents` in `spec/tests/support/business-traces.js`) that
the OTel spans it collects form one real cross-process trace — not just
same-process spans that happen to share a trace ID. This is the one gate in
ENG-02's automated set that proves the observability wiring actually works
end-to-end, rather than asserting it statically.

## Builds that ran, in this agent sandbox

| Build | Language | Result |
| --- | --- | --- |
| `main` (this repo, current — includes MVP-02A admin routes) | JS | PASS. Trace `15dd4026...`, 9 spans, cross-process parents assert clean. Exit 0. |
| `~/petclinic-demo-runs/r2` | JS (current state of that workspace) | PASS. Trace `4aa81082...`, same 9-span shape, cross-process parents assert clean. Exit 0. |

Both traces show the identical, expected shape: `petclinic.checkout.pay` →
`petclinic.payment.authorize` (CLIENT) plus two outbound CLIENT calls to
Customer (`account-changes`) and Reservation (`complete`), each with a
matching SERVER span and an INTERNAL business span underneath. No
regression from MVP-02A's changes.

## Builds that did not run here: r1 and r3 (Python)

Both fail the same way, for an environment reason, not a product defect:

```
./start: 4: exec: .venv/bin/python: not found
```

`.venv/bin/python` in both workspaces is a symlink to
`/Library/Frameworks/Python.framework/Versions/3.12/bin/python3.12` — a
macOS host path. It was built on your machine; this agent's Linux sandbox
has no such path (`python3.10` only, at `/usr/bin/python3`). The connected
folders here also don't allow deleting or overwriting existing files, so I
can't repair the symlink or re-run `./setup` from inside the sandbox
(`./setup` itself also hardcodes `python3.12`, and even a bypass needs
`pip install -r requirements.txt`, which can't reach PyPI from here either
— confirmed separately with a direct `pip3 install fastapi` 403 test). This
is the same category of limitation already documented for Playwright/Chromium
and for `tools/security/run-sec01-spike.sh`'s scanners: a real host
environment is required, not a sandbox workaround.

**To complete this gate for r1 and r3, run locally:**

```
cd ~/petclinic-demo-runs/r1 && npm run trace:payment
cd ~/petclinic-demo-runs/r3 && npm run trace:payment
```

Both already have their own copy of `tools/capture-payment-trace.mjs` and
the harness, so no setup beyond what those workspaces already have should
be needed — just a machine where `.venv/bin/python` actually resolves
(i.e., your Mac, where it was built).

## Status

Connected-trace capture is **built and proven working** against both JS
builds in-sandbox. The Python rebuilds need one local run each to close out
full "every build" coverage — flagging this explicitly rather than silently
skipping it, per the standing practice of never asserting a check passed
without actually running it.

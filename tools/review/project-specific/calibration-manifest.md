# ENG-02 calibration manifest

Not protected, not part of `npm test`. This is the answer key for ENG-02
item 5 (calibration). Each defect below is planted into a **throwaway scratch
copy** by `plant-calibration-defects.mjs` (same folder), never into the real
`services/` tree, never committed. The scratch copy deliberately **excludes
this file and the plant script** so the reviewer can't read the answer key.

Committed before any review runs (2026-10-05), so the defect list can't be
quietly adjusted after the score comes in.

## Design (decided 2026-10-05)

- **Target:** `main` at `f86ac60` (JavaScript, MVP-02A + REV-001–005 fixes).
- **Scoring:** per layer. For each defect, record which layers caught it:
  - **L0 frozen tests:** `npm test` minus browser and performance, run once
    per defect *in isolation* so a failure can be attributed.
  - **L1 automated gates:** import-boundary check (`npm run test:engineering`),
    jscpd (`tools/review/portable/run-dupe-check.sh`), Semgrep/Bandit/secret
    scan/dependency audit (`tools/security/portable/`). jscpd and Semgrep need
    network, so they're run locally by Dustin.
  - **L2 reviewer:** a fresh subagent given the unchanged
    `tools/review/review-prompt.md`, **blind** — not told defects were planted.
    Reviews all defects planted at once.
- **Caught** means the layer reports something that points at the defect's
  file and the defect's actual problem. A finding on the right line for the
  wrong reason doesn't count; it's recorded as "adjacent."
- **On a miss:** record the first-run score as is, improve `review-prompt.md`,
  rerun with a *new* fresh reviewer, repeat until 12/12. Report every round.

## Defects

| ID | Class | Source | File | What's planted | Expected to catch |
| --- | --- | --- | --- | --- | --- |
| CAL-01 | Copied business logic across services | ENG-02 #1 | `services/checkout/server.js` | Reservation's `chicago()` Chicago-time formatter copied verbatim into Checkout, used to stamp a local billing date on the finalize span | jscpd (L1), reviewer (L2) |
| CAL-02 | Payment reference leaked into a span | ENG-02 #2 | `services/checkout/server.js` | `paymentAttrs()` adds `payment.method_reference` = `mockMethodReference` | OBS privacy tests (L0)?, reviewer (L2) |
| CAL-03 | Token check skips signature verification | ENG-02 #3 | `services/platform/runtime.js` | `authenticate()` returns early for `role: "service"` tokens after only an expiry check — no HMAC check, so anyone can forge a service token | auth tests (L0)?, reviewer (L2) |
| CAL-04 | Non-constant-time secret comparison | SEC-01 #1 | `services/platform/runtime.js` | `timingSafeEqual` replaced with `s !== expected` | custom Semgrep rule (L1), reviewer (L2) |
| CAL-05 | Cross-service store access | ENG-02 #4 | `services/checkout/server.js` | When the `/fees` call fails, Checkout falls back to reading VeterinarianServices' own seed file (`app.seed("services")`) instead of failing | import-boundary (L1)? — reads data, not an import, so probably not; reviewer (L2) |
| CAL-06 | Admin-only route missing its role check | ENG-02 #6 | `services/platform/runtime.js` | Role gate treats any `veterinarian` as `administrator` on `/veterinarians` routes (roster add/deactivate) | auth tests (L0)?, reviewer (L2) |
| CAL-07 | Missing OBS attribute on an untested rule | ENG-02 #5 | `services/reservation/server.js` | `reservation.id` dropped from the `reassign_veterinarian` span (OBS-048, no dedicated test) | reviewer (L2) only, by design |
| CAL-08 | Flag written but never read | REV-003 shape | `services/reservation/server.js` | `/availability` stops filtering on `v.active`, so deactivated veterinarians offer slots again | BDD (L0)?, reviewer (L2) |
| CAL-09 | Injection-shaped user input | SEC-01 #3 (missed) | `services/customer/server.js` | `GET /customers?search=` builds `new RegExp(userInput)` (ReDoS / regex injection) | Semgrep default registry (L1)?, reviewer (L2) |
| CAL-10 | Overly broad CORS | SEC-01 #4 (missed) | `services/platform/runtime.js` | Any `Origin` is reflected, with `Access-Control-Allow-Credentials: true` | runtime tests (L0)?, Semgrep (L1)?, reviewer (L2) |
| CAL-11 | Route skips the auth hook | SEC-01 #5 (missed) | `services/platform/runtime.js` | `/internal/*` routes skip `authenticate()` when the caller is on loopback, and get a synthetic `service` user | auth tests (L0)?, reviewer (L2) |
| CAL-12 | Payment safety: retry after an uncertain write | Extra (payment-safety checklist) | `services/checkout/server.js` | The `incompleteBills` guard on bill finalization is removed, so a retry after a failed Customer write charges the account again. The comment claiming protection is left in place | BDD fault tests (L0)?, reviewer (L2) |
| CAL-13 | Bearer token logged on the error path | SEC-01 #2 | `services/platform/runtime.js` | `authenticate()`'s catch logs the raw `Authorization` header | secret-in-log Semgrep rule (L1)?, reviewer (L2) |

Thirteen, not twelve: CAL-13 was added while writing the plant script
(overproduce, then curate). Planted comments read like ordinary code
comments — none says "planted" or "calibration."

## Pre-existing issues noticed while planting (not planted, not scored)

Recorded here so they can't be mistaken for reviewer false positives, and
so a reviewer that finds them gets credit in the record:

- **PRE-01 — OBS-047 attribute missing in the real code.** `update_veterinarian`
  (`services/reservation/server.js:97–108`) sets `veterinarian.id` only;
  OBS-047 also requires `petclinic.veterinarian.active`. Real gap on `main`.
- **PRE-02 — path injection into service-token calls.** Route params are
  `decodeURIComponent`-decoded (`runtime.js:525`) and then interpolated into
  downstream URLs that carry a **service** token (e.g. Checkout
  `/visits/{visitId}/checkout` → `${urls.reservation}/visits/${visitId}`).
  An encoded `%2F` lets a caller re-target the downstream GET path with
  service privileges. Impact not yet assessed. Real shape on `main`.
- **PRE-03 — plaintext password comparison with `===`** in `/auth/login`
  (`services/customer/server.js:51–53`). Already disclosed as demo-only
  (A-09); check `threat-model.md` covers it.

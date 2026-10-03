# Auth coverage: why there's no automated engine here yet

SEC-01 defect #5 is "a route that skips the auth hook" — the realistic
failure mode being one endpoint wired up without going through whatever
check the rest of the system depends on.

A read of `services/platform/runtime.js` (2026-10-03) shows this is
structurally harder to introduce silently in this app's current
architecture than in a typical hand-wired Express app: every service routes
every request through one shared dispatcher, which calls `this.authenticate(...)`
for every registered route unless that route's OpenAPI operation explicitly
declares `x-roles: [anonymous]`. There's no per-route opt-in to add — a new
route only skips auth if it's registered *outside* this shared dispatcher
entirely, or if it's mistakenly given the `anonymous` role.

That changes what the real check should be. It isn't "does route X call an
auth function" (every route already does, structurally) — it's "was this
route registered through the shared dispatcher at all, and does its
`x-roles` value match what the API contract says it should be." That's a
cross-check between `spec/contracts/*.openapi.json` and the actual
registered route table, which is a real engine someone could write — but
it's not built yet, on purpose: per this project's own reification
discipline, a check doesn't get built until there's a demonstrated need for
it, and whether this is worth automating depends on what SEC-01's actual
run finds (does any scanner catch a planted instance of this at all, or is
it entirely a manual-review finding). Revisit after the spike runs.

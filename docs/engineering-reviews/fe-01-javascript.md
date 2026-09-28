# FE-01 JavaScript engineering review

Scope: the vanilla JavaScript frontend, its HTTP/static-file server, runtime
configuration, form helpers, appointment/visit/payment modules, and supplemental
engineering checks. The human approved the Cedar & Paw design and protected
structure and ran freeze/check before implementation. Frozen specifications,
reference PNGs, CSS/fonts/logo, and backend implementations were not modified to
make the frontend pass. Specification files still contain their original draft
wording; this record and the successful human freeze establish their approval.

Review status: PASS for the agreed demo scope. Implementation review, final aggregate,
supplemental checks, and payment trace passed. Checkpoint: `fe-01`.

## Findings and dispositions

- **Service boundaries:** frontend calls the four published APIs with the user's
  token. Its server serves an explicit file allowlist and nonsecret URL config;
  it has no service token, signing secret, payment-provider integration, or store
  access. Backend ownership and assigned-veterinarian checks remain authoritative.
- **Retained design:** server reads frozen CSS/font/logo files directly without
  rewriting them. The three visual expectations are independent, approved preview
  renders; no expected image was updated from the application.
- **Payment outcome:** cents are parsed from a decimal string with at most two
  fraction digits; zero, excess precision, unsafe integers, and overpayments are
  rejected. A pending intent contains a UUID and the exact API payload, saved
  before the write. Duplicate submit is blocked synchronously. Known declines
  permit a new intent; uncertain results retain the same one across reloads.
  A zero fetched balance does not override a pending ambiguous outcome.
- **Booking retry gap — fixed during review:** an initial version retained the
  booking key only in a closure. It now retains the exact booking intent in the
  same tab-scoped storage and locks the selected method while uncertain. A past
  appointment rejection is distinguished from a declined booking payment.
- **Accessible validation gap — fixed during review:** native required-field
  bubbles alone did not satisfy the screen contract. Shared form handling now
  displays the summary and associates field errors using aria-invalid and
  aria-describedby. Values are retained, except passwords after failed login.
- **Output safety:** API values become text nodes, never HTML. No tokens or
  passwords are logged. Session storage holds the token and unresolved demo
  payment intentions, not passwords or real card details. CSP restricts scripts,
  assets, and API origins; unknown server paths do not expose repository files.
- **Status announcement race — fixed:** the aggregate exposed simultaneous
  `Bill finalized.` and `Loading…` status elements. Removing loading after render
  alone left that transient overlap. Success messages now appear only after the
  destination page finishes loading. Frozen browser assertions remain unchanged;
  all five passed on the focused rerun in 10.3 seconds.
- **Maintainability:** shared rendering/form and API/session modules support
  separate appointment, visit, and billing modules. The payment code keeps
  persistence, request, known result, and uncertain result handling together.
  Prices and identities come from APIs; the contractual $20 booking-fee copy is
  the only fixed monetary product wording. No new runtime dependencies.

## Verification

Initial frozen browser run: five tests pass in 10.4 seconds, including all three
visual comparisons, the real customer/vet journey, decline/double activation,
ownership routes, and real-response loss/reload/retry. This includes process startup
and teardown on the reference host; it is an observation, not a PERF-01 guarantee.

Supplemental checks in `tools/frontend-engineering.test.mjs` cover required-field
errors without writes, fractional-cent rejection and exact partial payment,
authorized-completion-error display despite a zero fetched balance, and literal
rendering of malicious-looking clinical text. The completion-error check injects
the browser-facing 502 shape after a real payment; it does not claim to reproduce
a backend downstream failure, which remains covered by the backend oracle.

`npm run check`: ESLint and Prettier passed. `npm run test:engineering`: nine tests
passed, including all four frontend checks above. `npm run trace:payment` captured
trace `c588501f8e961ea1be9b7b580c4d1221` with nine connected spans: Checkout pay,
provider authorization, Customer account credit, and Reservation completion.
Cross-process parent relationships were asserted; outcomes were authorized,
applied, and CompletedSettled. This is backend trace evidence, not browser telemetry.
The final aggregate log is `test-results/engineering/fe01-final-validation.log`.

Final `npm test`: all nine suites passed—guard, 45 harness checks, 157 schemas,
52 runtime checks, 242 authentication checks, 113 observability checks, 219 service
scenarios / 1,685 steps, nine backend journeys / 58 steps, and five browser checks.
The browser suite completed in 10.2 seconds, including all three unchanged visual
references. Source hashes are recorded in `test-results/engineering/fe01-source-sha256.txt`.
The protected manifest and reference images remained unchanged during implementation.

## Limits

The five-screen slice is desktop-only, with the fixed Chromium/environment visual
baseline. Broader business workflows remain backend-tested. No production payment
processor, durable recovery, refund, admin, mobile, browser telemetry, or offline
workflow is added. Sign out removes tab-local recovery state as specified; closing
the tab or restarting in-memory services can lose recovery information. The backend
manual-reconciliation limitations still apply to authorized downstream failures.
Passing this review demonstrates the covered demo requirements, not production
readiness or a complete accessibility audit.

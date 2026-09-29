# PERF-01 local demonstration performance contract

Specification draft implementing the user's approved defaults; requires human
review/freeze. No backend implementation or API changes are proposed.

Run `npm --prefix spec run test:performance`. The same frozen HTTP test applies to
JavaScript and Python services. Compare on the same local machine, with normal
telemetry enabled, the same fixtures, and other validation suites stopped.

Five independent customer workers, each with a unique pet, warm up for 2 seconds
and submit traffic during a 10-second measurement window. Each worker starts at
most one iteration every 500 ms and never overlaps its own iterations. This is
a modest paced concurrency check, not a saturation or capacity benchmark. Report
sample counts and actual elapsed time; do not infer a production throughput claim.

Each iteration requests and accepts a unique future appointment, then finalizes
and pays one prepared historical visit. Preparation uses public APIs, with test
clock changes only before warm-up. This split is necessary because all services
share one frozen clinic clock; it avoids moving time during measured work or
violating the two-veterinarian scheduling rules. Existing workflow tests cover the
chronological end-to-end journey. Both warm-up and measured work use distinct data.

Latency is wall time from fetch dispatch through receipt of the complete response
body. Exclude setup, login, schema checking, state assertions, warm-up, and teardown
from latency samples; include all of them in reported total suite/run durations.
Downstream service calls, provider calls, queuing, and enabled telemetry remain
part of the application's work. No browser is launched.

For EACH of request, acceptance, finalization, and payment: nearest-rank p95 must
be strictly below 200 ms, with at least 20 measured samples (normally 100).
Report count, p95, and maximum. An unexpected HTTP status, timeout, invalid schema,
wrong state, incorrect balance, duplicate credit/provider call, or insufficient
sample count fails the run. Expected demo payments all authorize. Request timeout
is 2 seconds; the live test has a 60-second deadlock safeguard. No retries,
automatic threshold adjustment, or pass-by-rerun. In-flight operations may drain
after the measurement window; no new iteration starts beyond it.

The desired total runtime is roughly 20–30 seconds, not a frozen wall-time gate.
Setup prepares 120 visits; warm-up and measurement reuse five asynchronous workers
without resets inside either phase. The JSON report is written outside protected
paths to `test-results/performance/latest.json`, including policy, host details,
raw measured samples, phase durations, failure reason when available, and result.

Gate rehearsal: a temporary HTTP server delays responses by 250 ms; the unchanged
gate must reject its observed p95. A deliberately incorrect paid balance must be
rejected independently of speed. These probes exercise the measurement/gate and
financial assertion, not a simulated production service. They leave real service
code unchanged. The working JavaScript implementation may pass immediately;
deliberate faults provide the failing evidence without inventing missing behavior.

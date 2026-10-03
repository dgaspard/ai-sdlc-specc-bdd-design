# Custom portable Semgrep rules

Only two files here, deliberately. Semgrep's default registry (`--config
auto`) already covers the generic injection-shaped-concatenation patterns
(defect class #3) and most dependency/CORS-adjacent checks reasonably well,
so there's no custom rule for those — writing one would just duplicate what
`--config auto` already provides. These two cover the SEC-01 calibration
defect classes that the default registry doesn't reliably catch because
they depend on naming conventions (`secret`, `token`, `signature`,
`password`) rather than a structural pattern:

- `timing-safe-compare.yml` — defect #1 (non-constant-time secret
  comparison), both JavaScript and Python.
- `secret-in-log.yml` — defect #2 (secret logged at error level),
  JavaScript.

Both use `metavariable-regex` on variable names as a heuristic, which means
they can both miss (a secret stored under an unrelated variable name) and
over-flag (a variable merely named `token` that isn't actually sensitive).
That's expected and worth recording honestly in the SEC-01 write-up — it's
exactly the kind of limitation a calibration run is supposed to surface.

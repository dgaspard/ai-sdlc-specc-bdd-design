# Custom portable Semgrep rules

Two files, deliberately. Semgrep's default registry (`--config auto`) already
covers generic injection-shaped patterns, so there's no custom rule for those.
These two cover SEC-01 calibration defect classes the default registry
doesn't reliably catch:

- `timing-safe-compare.yml` covers defect #1 (non-constant-time secret
  comparison) in JavaScript and Python.
- `secret-in-log.yml` covers defect #2 (a secret written to logs) in
  JavaScript.

## Hardened 2026-10-05 (ENG-02 calibration)

The originals relied only on `metavariable-regex` over variable *names*
(`secret`, `token`, `signature`, `password`). ENG-02 calibration planted both
defect classes with the neutral names an AI agent actually writes:
`s !== expected` (CAL-04) and `console.error(..., header)` (CAL-13). Both
rules missed. SEC-01's 5/8 had counted them as catches, but its snippets used
names chosen to match the rules.

Each file now pairs the name heuristic with a **structural** rule that
doesn't depend on names:

| Rule | Kind | Catches |
| --- | --- | --- |
| `timing-unsafe-secret-compare-js`/`-py` | Name heuristic, broadened | `==`, `===`, `!=` and `!==` on either operand. Skips literals, `null`/`None`, `undefined`, `typeof`, and `.length`/`len()` |
| `timing-unsafe-digest-compare-js`/`-py` | Structural | Any equality comparison against a value produced by `.digest()`/`.hexdigest()`, whatever it's called |
| `secret-logged-js` | Name heuristic, broadened | Every `console.*` method; names including `authorization`, `bearer`, `cookie`, `credential`, and `header` |
| `request-credentials-logged-js` | Taint (intraprocedural) | Request-header values that reach a `console.*` call |

Known limits:

- **Taint is intraprocedural** in Semgrep OSS. A header passed into another
  function and logged there is caught only by the name rule.
- **The name rules can still over-flag**, e.g. a non-secret variable named
  `token`.

## Tests

`../semgrep-rules-tests/` holds annotated positive (`ruleid:`) and negative
(`ok:`) cases, including the exact CAL-04 and CAL-13 shapes. Run:

```
semgrep --test --config tools/security/portable/semgrep-rules tools/security/portable/semgrep-rules-tests
```

`tools/review/project-specific/run-calibration-gates.sh` runs this first.

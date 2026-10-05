# Threat model

Single-purpose record of known, accepted architectural risks — not a log of
findings or activity. Other records (business decisions, contracts,
engineering reviews) reference an entry here by ID (`THREAT-01`, ...) rather
than restating it. Keep each entry short enough to scan; elaboration belongs
in whichever decision record or contract the risk originated from, linked
from the entry below.

| ID | Risk | Status |
| --- | --- | --- |
| THREAT-01 | All services share one `AUTH_TOKEN_SECRET` (HS256). Any one compromised service can forge a valid token for any user or role — there is no per-service key separation. | Disclosed demo limitation, not mitigated. Deliberate shortcut for a local, no-cloud-dependency demo (PROJECT-PLAN A-09); never a production pattern. See `spec/contracts/auth-contract.md`. |
| THREAT-02 | The dual-role (administrator + veterinarian) account carries both roles in a single JWT. A stolen token for this one account grants both privilege levels at once, a larger blast radius than any single-role account's token. | Disclosed, accepted, not engineered around — consistent with THREAT-01's existing posture. See `docs/specs/business-decisions.md` D-44. |

## Adding an entry

A new entry needs: the concrete mechanism that creates the risk (not a vague
category), what it would take to exploit, and whether it's disclosed-and-
accepted or needs a mitigation tracked elsewhere. If a mitigation lands,
update the Status column rather than deleting the row — the history of what
was once true matters as much as what's true now.

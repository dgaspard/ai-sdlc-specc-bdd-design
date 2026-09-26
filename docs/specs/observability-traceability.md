# SPEC-03 — Observability rule-to-test traceability

## Purpose and scope

Keep the human-readable observability requirements and executable assertions
traceable as agents add or reconstruct implementation. This specification defines
documentation and test naming; it does not approve proposed service behavior or
require implementation of the future services.

The rule registry and coverage table live in [observability.md](../observability.md).
Existing cancellation assertions must remain unchanged; adding an ID to their test
title is a metadata change, not a change to their expectations.

## Requirements

1. Assign every registered observability rule a unique ID matching `OBS-NNN`.
   Allocate new IDs after the highest allocated number. Never renumber rules when
   moving sections or reuse an ID after retirement.
2. Keep an ID when clarifying wording without changing the requirement. For a
   materially replaced requirement, retire its ID and document the replacement ID.
   Retired entries remain visible in the registry and coverage table.
3. Include every asserted rule ID in the executable test title, for example
   `[OBS-011] cancelling a visit emits an operationally useful trace`. A test that
   verifies two rules uses both tokens, such as `[OBS-002] [OBS-022] ...`.
   Each claimed ID must be supported by actual assertions; tags or comments alone
   do not establish coverage.
4. If an observability requirement is verified through BDD, place its ID in the
   scenario title so it appears in reports. Business-only scenarios need no OBS ID.
5. Maintain one coverage-table row per registered rule with its meaning, linked
   test file and exact title (or explicitly “No test”), and implementation status.
   List multiple tests when needed to cover branches of a rule. Planned names must
   be labeled as planned and must not link to nonexistent files.
6. Distinguish requirement authority (binding, proposed, retired) from implementation
   status (not implemented, partial, implemented and verified, or deferred).
   An existing failing test is coverage evidence, not implementation completion.
7. Update the rule and its coverage references in the same change as test additions,
   renames, or removals. Do not mark a rule implemented and verified unless the
   relevant assertions passed and cover the entire stated rule. Record the command
   and result in the change report; passing unrelated tests is insufficient.
8. Proposed and conditional rules may have no test. Preserve that visible gap rather
   than creating skipped or assertion-free tests that imply verification.

## Acceptance examples

| Change | Expected result |
| --- | --- |
| Register a new rule | Unique unused ID, rule definition, coverage row with explicit status |
| Add assertions for an existing rule | Test title includes its ID; table links to that file and title |
| Add a title token without checking its requirement | Review rejects the claim of coverage |
| Rename a test | Table reference changes with the title |
| Delete or skip an agreed failing test | Rejected under the existing working agreement |
| Replace a legacy rule | OBS-011 is retired and points to OBS-026; the legacy test stays at tag `1.0` (D-24) |
| Reorder documentation | All IDs stay unchanged |
| Retire a requirement | Old ID is retained as retired and points to any replacement |

## Delivery and verification

Initial delivery assigns IDs to the existing document, adds the coverage table,
and prefixes the existing cancellation test title with OBS-011. It adds no service
implementation and changes no assertions. Run `npm test` and the remaining suites
individually if the intentional BDD failure stops the aggregate command.

For future changes, review ID uniqueness, registry/table completeness, file links,
exact test titles, and whether assertions justify each claimed mapping. An automated
consistency checker is a possible later task; this specification does not claim
that such a checker exists or that static matching proves semantic test coverage.

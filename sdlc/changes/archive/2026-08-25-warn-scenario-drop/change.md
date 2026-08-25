---
id: warn-scenario-drop
tier: standard
status: shipped
---
# Change: say what a MODIFIED requirement carries away
<!-- cap:100 · standard tier. Delta sections ARE the spec change — merged mechanically at ship, never re-narrated. -->

## Why (≤5 lines)
`### MODIFIED Requirement:` replaces the requirement body wholesale, so a rewritten
body that carries over only some of the spec's scenarios drops the rest with no error,
no warning and nothing in the archive output (issue #1: twice in one working day, both
times a guarantee stated in exactly one place, both times found by a human reading the
diff after the change folder had already moved under `changes/archive/`).

## Assumptions
- A warning, not an error: removing a scenario is sometimes the point of the change.
  What is wrong is only that it was silent, so the merge still lands and exits 0.
- A reworded clause reports the same as a deleted one. No mechanical comparison can
  tell "said better" from "promises less", and a false warning costs one re-read while
  a missed one costs a guarantee. Cosmetic churn — indentation, bullet marker, clause
  order, heading case, collapsed whitespace — is normalized away and never warns.
- The warning is emitted by `validate` as well as `archive`, so it is visible while
  the change is still fixable rather than only at the moment the folder is archived.

## Delta: spec-merge

### ADDED Requirement: A MODIFIED body never drops a promise silently
The system SHALL report every scenario that a MODIFIED requirement's replacement body
removes or rewrites relative to the requirement it replaces, before the merge is
written, and SHALL still perform the merge — the report is a warning, not a refusal.

#### Scenario: the scenario name is gone
- WHEN a MODIFIED body omits a scenario the living spec's requirement still carries
- THEN the dropped scenario is named, the merge lands, and the command exits successfully

#### Scenario: the name survives but the promise shrank
- WHEN a MODIFIED body keeps a scenario name but drops WHEN/THEN clauses the spec stated
- THEN each unmatched clause is quoted back, the merge lands, and the command exits successfully

#### Scenario: nothing was lost
- WHEN a MODIFIED body carries every scenario and clause of the requirement it replaces
- THEN nothing is reported, however the text was re-indented, re-ordered or re-cased

#### Scenario: seen before the folder is out of reach
- WHEN a change with such a MODIFIED is validated
- THEN the same report appears as a warning and validation still passes

## Tasks
- [x] T1 `lib/delta.mjs`: `parseScenarios` / `scenarioDrift` / `describeDrift`, `mergeDelta` returns warnings [tier:balanced]
- [x] T2 `bin/cli.mjs`: archive prints the warnings before phase 2 and counts them in the summary [tier:cheap]
- [x] T3 `lib/validate.mjs`: same report as a warn-level issue on every MODIFIED op [tier:cheap]
- [x] T4 tests: unit drift cases + black-box archive/validate; payload doc lines for ship + delta grammar [tier:balanced]

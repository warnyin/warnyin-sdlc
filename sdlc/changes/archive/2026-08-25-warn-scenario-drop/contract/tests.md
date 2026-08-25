# Test contract — warn-scenario-drop
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | given a spec requirement with 3 scenarios / when a MODIFIED body carries 2 / then the third is named as dropped | unit | A MODIFIED body never drops a promise silently |
| 2 | given a kept scenario name / when a WHEN/THEN clause is missing from the new body / then that clause is reported as unmatched | unit | A MODIFIED body never drops a promise silently |
| 3 | given the same scenarios re-indented, re-ordered, re-cased / when compared / then no drift is reported | unit | A MODIFIED body never drops a promise silently |
| 4 | given a shipped spec / when `archive` runs a scenario-dropping MODIFIED / then it warns on stderr, merges, and exits 0 | e2e | A MODIFIED body never drops a promise silently |
| 5 | given the same change / when `validate <id> --strict` runs / then the warning appears and the run still passes | e2e | A MODIFIED body never drops a promise silently |
| 6 | given a MODIFIED that keeps every scenario / when `archive` runs / then no scenario warning is printed | e2e | A MODIFIED body never drops a promise silently |

## Out of scope (explicitly untested + why)
- Semantic equivalence of reworded clauses — no mechanical test can decide it; the
  contract is deliberately to warn on any unmatched clause.
- ADDED/REMOVED bodies — they cannot silently lose a scenario the spec still states.

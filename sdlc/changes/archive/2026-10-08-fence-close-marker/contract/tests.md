# Test contract — fence-close-marker
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | Given a contracted deploy change whose runbook has five sections and then ```, `~~~`, `## Rollback`, ``` · when validated · then an error names Rollback | unit | A fence closes only on its own marker |
| 2 | Given a verified change whose grill.md has the four sections, but `## Mandate` only after ```, `~~~` and before ``` · when `validate` runs · then exit 1 and the output names Mandate | int | A fence closes only on its own marker |
| 3 | Given a runbook whose `## Rollback` sits between ```` and ```` with a ``` line before it · when validated · then an error names Rollback | unit | A fence closes only on its own marker |
| 4 | (guard — green before the change) Given a runbook with a ```md fence closed by ``` and then all six sections · when validated · then no runbook issue | unit | A fence closes only on its own marker |
| 5 | Given a runbook where `## Rollback` follows a ``` fence closed by a line ```` ``` text ```` (closer with trailing text) · when validated · then an error names Rollback | unit | A fence closes only on its own marker |

## Out of scope (explicitly untested + why)
- Indented (4-space) code blocks — not a fence; unchanged behavior, never claimed.

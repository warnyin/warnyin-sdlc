# Test contract — review-provenance-and-cost
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | Given the verify playbook · when read · then it records provenance on the verify note and names both values (independent panel / main loop) | unit | A verify or review record states how it was produced |
| 2 | Given the review playbook · when read · then it records the same provenance field on its review note | unit | A verify or review record states how it was produced |
| 3 | Given the verify and review playbooks · when read · then an unavailable panel is stated as a recorded fact that still proceeds, never a reason to stop | unit | A verify or review record states how it was produced |
| 4 | Given a change whose journal holds a verify event marked self-produced · when the report is built · then that change is reported as self-judged | int | A verify or review record states how it was produced |
| 5 | Given a change whose verify and review events are all marked independent · when the report is built · then it is not reported as self-judged | int | A verify or review record states how it was produced |
| 6 | Given a change whose journal carries no provenance at all (written before this change) · when the report is built · then it is reported as unknown rather than as independent | int | A verify or review record states how it was produced |
| 9 | Given a change with one self-produced outcome and one independent one · when the report is built · then it is reported as self-judged — the weakest link decides | int | A verify or review record states how it was produced |
| 7 | Given a self-judged change · when the report is rendered for a human · then the line says so instead of showing only the verify count | int | The digest names self-produced judgments |
| 8 | Given the ship playbook · when read · then the digest section requires naming self-produced verify or review outcomes | unit | The digest names self-produced judgments |

## Out of scope (explicitly untested + why)
- The constitution rule (T1) — always-loaded content is enforced by the budget check in `validate`, and asserting on prose the user owns would freeze their wording.
- The `prices:` block (T5) — this repo's own config, not payload behaviour; `lib/usage.mjs` already has cost-math coverage.
- Whether a panel actually ran — that is a session policy, not something code can observe; the point of this change is that the record says which happened.

# Test contract — final-gate-confirm-skip
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Doctrine rows read what a playbook REQUIRES, whitespace folded, bounded proximity regexes. Report
rows drive `lib/observe.mjs` through `buildReport`. Whether a run really asks is runtime judgement.

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | Given verify.md's final gate · when read · then a vibe-tier change skips the full run without asking and records `result=skipped by=tier` | unit | The full run is confirmed, and a vibe change skips it |
| 2 | Given verify.md's final gate · when read · then any other tier asks the human to run or skip before running, run recommended, and a skip records `by=human` | unit | The full run is confirmed, and a vibe change skips it |
| 3 | Given verify.md's final gate · when read · then a reused fast-gate full run asks nothing | unit | The full run is confirmed, and a vibe change skips it |
| 4 | Given verify.md's final gate · when read · then a skip still sets `status: verified` | unit | The full suite runs once, after review |
| 5 | Given auto.md · when read · then the escalation table has a final-gate row pre-approvable as run or skip | unit | The full run is confirmed, and a vibe change skips it |
| 6 | Given ship.md · when read · then a `build` note after the last final-gate pass or skip sends the change to /sdlc:verify, and the digest says the full suite never ran before ship | unit | The full suite runs once, after review |
| 7 | Given rules-card.md · when read · then its Verify line says the full run is confirmed and vibe skips it; the card stays ≤ 40 effective lines | unit | The full run is confirmed, and a vibe change skips it |
| 8 | Given a fast pass then a skipped final gate · when `buildReport` runs · then rounds = 1 and first-pass = true | unit | The full run is confirmed, and a vibe change skips it |
| 9 | Given a fast fail, a fast pass, then a skipped final gate · when `buildReport` runs · then rounds = 2 and first-pass = false | unit | The full run is confirmed, and a vibe change skips it |

## Out of scope (explicitly untested + why)
- Whether a run really shows the picker or honours the answer — runtime judgement.
- Exact wording of the question and options — freezing prose tests nothing.
- Existing verify-gates rows stay green (row 29 ship precondition, row 7 final gate).

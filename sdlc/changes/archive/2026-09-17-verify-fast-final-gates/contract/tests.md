# Test contract — verify-fast-final-gates
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Doctrine rows read what a playbook REQUIRES, whitespace folded, with bounded proximity regexes,
never one exact sentence. Report rows drive `lib/observe.mjs` through `buildReport`.
`contract/evals.md` scores whether a run really follows the gates.

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | Given verify.md · when read · then it names a fast gate and a final gate | unit | A fix round runs a fast gate, not the full suite |
| 2 | Given verify.md's fast gate · when read · then it runs the harness `fast test command` when one is named | unit | A fix round runs a fast gate, not the full suite |
| 3 | Given verify.md's fast gate · when read · then with no fast command it runs the tests covering the contract rows and touched paths, falling back to the full test command when no subset can be named | unit | A fix round runs a fast gate, not the full suite |
| 4 | Given verify.md's fast gate · when read · then it exercises the change live when it has a runnable surface, naming what counts (CLI, server or UI) | unit | A fix round runs a fast gate, not the full suite |
| 5 | Given verify.md's fast gate · when read · then it scores evals and lens bars, and does not require the full test command | unit | A fix round runs a fast gate, not the full suite |
| 6 | Given verify.md's gate list (before the gates) · when read · then a fast pass with review signals and no `review blockers=0` note routes to /sdlc:review, status staying `building`; `status: verified` is never set in the fast gate | unit | The full suite runs once, after review |
| 7 | Given verify.md's final gate · when read · then it runs the full test command only after a fast pass and, when review signals exist, a `review blockers=0` note; `status: verified` is set there | unit | The full suite runs once, after review |
| 8 | Given verify.md · when read · then with no review signal the final gate follows the fast pass in the same verify | unit | The full suite runs once, after review |
| 9 | Given verify.md · when read · then a final-gate failure appends fix tasks, counts toward the same 3-round budget, and after build runs the fast gate before the final gate with no repeat review once a `review blockers=0` note is recorded | unit | The full suite runs once, after review |
| 10 | Given verify.md · when read · then fast notes carry `scope=<full\|scoped>`, and the final gate reuses a pass only when the last fast pass has `scope=full` and no `build` note follows, noting `reused=yes` | unit | The full suite runs once, after review |
| 11 | Given review.md · when its pass condition is read · then Next is /sdlc:verify (final gate), not /sdlc:ship | unit | The full suite runs once, after review |
| 12 | Given next.md §2 · when read · then `building` with all tasks ticked maps to /sdlc:verify, or /sdlc:review when a fast pass awaits review; `verified` maps to /sdlc:ship; ship.md's precondition names the final gate | unit | The full suite runs once, after review |
| 13 | Given verify.md · when read · then its journal notes carry `gate=fast` and `gate=final`, and still `mode=` | unit | The journal names the gate and rounds follow the budget |
| 14 | Given a fast pass then a final pass · when `buildReport` runs · then verify rounds = 1 and first-pass = true | unit | The journal names the gate and rounds follow the budget |
| 15 | Given fast fail, fast pass, final pass · when `buildReport` runs · then rounds = 2 and first-pass = false | unit | The journal names the gate and rounds follow the budget |
| 16 | Given a fast pass then a final fail · when `buildReport` runs · then rounds = 2 and first-pass = false | unit | The journal names the gate and rounds follow the budget |
| 17 | Given verify notes with no `gate` field · when `buildReport` runs · then each counts as a round, as before — regression guard, green before implementation by design | unit | The journal names the gate and rounds follow the budget |
| 18 | Given the harness seed template · when read · then it names an optional `fast test command` beside `test command`; a fresh `init --tool claude` seeds it into `sdlc/harness.md` | int | A fix round runs a fast gate, not the full suite |
| 19 | Given rules-card.md, playbook README.md and auto.md flow lines · when read · then a final verify comes after `[review]` and before ship; the card stays ≤ 40 effective lines | unit | The full suite runs once, after review |
| 20 | Given the Claude verify command's description · when read · then it no longer promises full tests on every round | unit | A fix round runs a fast gate, not the full suite |
| 21 | Given a fresh `init --tool claude` · when `sdlc/.playbook/verify.md` is read · then it carries both gates | int | The full suite runs once, after review |
| 22 | Given fresh `init --tool cursor` · when its rules file is read · then the embedded flow line has the final verify after review | int | The full suite runs once, after review |
| 23 | Given review.md · when read · then a review skipped for lack of a signal records `review blockers=0 skipped=no-signal`; verify.md and ship.md name `review.md` for the signals and carry no list of their own that omits `lenses` | unit | The full suite runs once, after review |
| 24 | Given review.md · when read · then a fix review applies itself records a `build` note (`source=review`) | unit | The full suite runs once, after review |
| 25 | Given verify.md's gate list · when read · then a passing verify note with no `gate` counts as a fast pass with `scope=full` | unit | The full suite runs once, after review |
| 26 | Given ship.md's digest step · when read · then a final-gate note with `reused=yes` is named in the digest | unit | The full suite runs once, after review |
| 27 | Given verify notes with gate ` FINAL ` (pass) and `Fast` · when `buildReport` runs · then the final pass adds no round and the fast note counts; an unknown gate value counts as a round | unit | The journal names the gate and rounds follow the budget |
| 28 | Given verify.md's gate list, next.md and ship.md · when read · then verify evaluates the signals itself and a `skipped=no-signal` note never counts as a review | unit | The full suite runs once, after review |
| 29 | Given ship.md's precondition · when read · then a `build` note after the last final-gate pass sends the change back to /sdlc:verify | unit | The full suite runs once, after review |
| 30 | Given fast pass, fast fail, final pass · when `buildReport` runs · then rounds = 2 and first-pass = false | unit | The journal names the gate and rounds follow the budget |
| 31 | Given review.md · when read · then once the journal shows a fast pass since the last build, or the change is verified, review runs its panel and never skips — keyed to the journal, not to who invoked it | unit | The full suite runs once, after review |

## Out of scope (explicitly untested + why)
- Whether a run picks a sensible fast scope or smoke — runtime judgement; scored in evals.md.
- Exact wording of gates and notes — freezing prose tests nothing (clarification-rounds ruling).
- `init.md` interview — unchanged per Assumptions; the seed line explains the key.
- In-flight changes already `verified` under the old flow — ship.md's precondition sends one with
  review signals and no `review blockers=0` note to review first; runtime routing, no migration.
- Review-blocker rounds in observe — they stay in `review` events; the escalation reads the journal.
- Existing guards stay green: lenses row 18 (verify Next routes lenses to review), provenance
  rows 1–3 (`mode=`), payload next.md markers.

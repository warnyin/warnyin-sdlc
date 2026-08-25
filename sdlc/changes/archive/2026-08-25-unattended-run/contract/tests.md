# Test contract — unattended-run
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Pipeline stages = new, design, contract, build, verify, review, ship. Non-pipeline
commands (init, observe, next, steer, converge, feedback) are out of scope.

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | Given every pipeline stage command · when its frontmatter is read · then `argument-hint` advertises `--auto` | unit | Every stage command accepts `--auto` |
| 2 | Given every pipeline stage playbook · when read · then it names `--auto` and hands the run off to auto.md from its own stage onward | unit | Every stage command accepts `--auto` |
| 3 | Given auto.md · when read · then the entry stage comes from the change's status via next.md §2, and a stage typed earlier than that is skipped with an announcement, never re-run | unit | Every stage command accepts `--auto` |
| 4 | Given auto.md · when read · then it states the order gather → confirm → run, with nothing written before confirmation — no change.md, no journal entry, no gate | unit | Everything decidable is asked before any work starts |
| 5 | Given auto.md · when read · then the confirmation must carry scope, tier, every ambiguity, and the escalation decisions being pre-approved | unit | Everything decidable is asked before any work starts |
| 6 | Given auto.md · when read · then declining leaves the repository unchanged and the run revises or stops | unit | Everything decidable is asked before any work starts |
| 7 | Given auto.md · when read · then pre-authorization is stated as valid for that run only — not persisted to config, not inherited by a resume | unit | Pre-authorization is bounded and recorded |
| 8 | Given auto.md · when read · then a condition outside the confirmed set stops the run and asks, as if no flag had been passed | unit | Pre-authorization is bounded and recorded |
| 9 | Given a change journal holding an escalation event marked pre-authorized · when the report is built · then that change counts one pre-authorized escalation | int | Pre-authorization is bounded and recorded |
| 10 | Given a change journal holding an escalation event that was NOT pre-authorized · when the report is built · then it is not counted as pre-authorized | int | Pre-authorization is bounded and recorded |
| 11 | Given a change with no escalation events · when the report is built · then the count is zero and nothing is rendered about pre-authorization | int | Pre-authorization is bounded and recorded |
| 12 | Given an escalation event written by a stage that keeps no note of its own · when the report is built · then it still counts — the record is the event, not a field on another stage's note | int | Pre-authorization is bounded and recorded |
| 13 | Given a change that ran unattended · when the report is rendered · then the human-readable line says how many escalations passed under pre-authorization | int | The digest shows where a human would have stood |
| 14 | Given ship.md · when read · then the digest section requires listing pre-authorized escalations | unit | The digest shows where a human would have stood |
| 15 | Given the CLI · when `--auto` is passed · then it is not consumed as a CLI flag and does not break argument parsing — regression guard, green before implementation by design | unit | Every stage command accepts `--auto` |
| 18 | Given auto.md · when the stop-and-wait rule is read · then it applies only to escalations NOT pre-approved for this run, so no instruction contradicts unattended mode | unit | Pre-authorization is bounded and recorded |
| 16 | Given auto.md · when read · then every escalation condition it can pre-approve is listed by name (ambiguity, verify rounds, review blockers, deep-tier ship, token budget), each as its own item | unit | Everything decidable is asked before any work starts |
| 17 | Given a stage playbook invoked with `--auto` · when read · then the stage still does its own work before the pipeline continues — the flag never skips the stage it was passed to | unit | Every stage command accepts `--auto` |

## Out of scope (explicitly untested + why)
- Whether the run actually stops at an unconfirmed escalation — that is agent behaviour under a live pipeline; the evals rubric scores it and the journal records what happened.
- The wording of the confirmation itself — asserting on prose freezes it; the contract pins what it must carry, not how it reads.
- End-to-end unattended runs — a test that drives new→ship would take the whole suite hostage to LLM latency and non-determinism.

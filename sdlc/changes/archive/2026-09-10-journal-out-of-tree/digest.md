# Digest — journal-out-of-tree
<!-- cap:15 -->
**Shipped** (issue #3). Telemetry the hooks append left the tracked tree: while a change is
open it goes to `sdlc/.state/journal/<id>.ndjson` — already gitignored, so no new entry and no
`git rm --cached` in existing installs — and `archive` seals it into the shipped folder in one
write, so `/sdlc:observe` still reports a teammate's shipped changes after a clone. Legacy
in-tree journals are read alongside the new stream and consumed at ship.
**Specs merged:** `flow-journal`, 3 ADDED requirements. **Files:** 18. **Tests:** 188 green.
**Assumptions:** the archive keeps a tracked journal (one ship-time write has neither failure
mode the issue reports) · legacy telemetry is merged, never discarded, and the only deletion of
a tracked file happens inside the ship commit · tier is deep because this moves a file living
inside other people's projects.
**Verify:** 2 rounds, both `mode=panel`. Round 1 passed tests *and* evals; the review panel then
found 2 blockers neither had caught — sealing before the rename (sealed and legacy are the same
file, so a failed rename doubled every event on retry) and an ungated change id reaching
`cmdArchive`'s path builder. Both fixed with regression tests.
**Pre-authorized escalations — where a human would normally have stood, and this run did not:**
deep-tier/hard-floor ship · verify failing past 3 rounds · review blockers.
**Cost:** 8 sessions, unpriced — `config.yaml` carries no rate for `claude-opus-5`.
**Awaiting you:** the learner proposes routing eval judging to `balanced` for deep-tier changes,
on the evidence that a cheap-tier evaluator scored 5/5 on code holding both blockers. Not
applied — it raises cost per run, which is your call, not mine.

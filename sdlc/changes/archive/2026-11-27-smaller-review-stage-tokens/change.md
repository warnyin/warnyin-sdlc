---
id: smaller-review-stage-tokens
tier: standard
status: shipped
---
# Change: Smaller review panel after the first round, and tokens reported per stage
<!-- cap:100 · standard tier. Delta sections ARE the spec change — merged mechanically at ship, never re-narrated. -->

## Why (≤5 lines)
Issue #16: a standard change costs too many tokens; review runs all four reviewers again after every
fix round, and `observe` shows tokens only per change, so no one can see which stage spends them.
Outcome: a repeated panel calls fewer reviewers, every gate still runs, and tokens per stage are visible.
Done = the next standard change's `review` + `build source=review` stage tokens, read from `observe`, are lower than `scoped-test-commands`' for the same stages; a human compares them, no test does.

## Assumptions
- Evaluator re-scoring is already scoped to what a fix touched (read `verify.md` step 1 Evals, "A line that met the bar keeps its score"); verify is not touched. Read, not run.
- A repeated panel is any `review` run after a review note with `blockers>0`; `review.md` already defines it so. `sdlc-security` always runs in it: its agent file says a repeated panel never narrows what it checks.
- The review note records only `blockers=<n>`, not who raised them; so "raised a blocker last round" is read from the change's fix tasks and, when unsure, the reviewer runs.
- A session record is cumulative, written at Stop; a stage's tokens are the growth of the session total between two stage events, so the last turn of a stage may land in the next (blur). `[UNVERIFIED]` how large on a real journal.
- Stage events are `contract`, `build`, `verify`, `review`, `ship` in the journal (read from the archived `scoped-test-commands` journal). A `review` note carrying `skipped=` records no work and is not a stage event. A `build` with `source=review` is a `build` stage that keeps `source` in its entry, so a reader can add it to `review`.
- Records with no session id are each their own session, as `cost-accounting` already says; stage growth inherits that and may double count them as the change totals already do.
- Stage growth is clamped at 0 after summing sessions, per class. A record at the same time as an event counts as at or before it.
- Existing pins stay green: `gate-moving-target` row 11 pins review.md's "Fan out in parallel…" sentence (kept; P1 decides who runs), `lenses.test.mjs` row needs `every reviewer … each lens` near `mode=panel` (kept in P4).
- Other places naming "four core reviewers": `sdlc/evals/{expert-lenses,skill-inventory}/rubric.md` and the `review` command stub description list the roles, not a rule; left as they are.
- The 20% target is not asserted; the change makes it measurable. Reviewer files and the evaluator are unchanged. Existing installs get the prose through `update`.

## Delta: review-panel

### ADDED Requirement: A repeated panel calls only the reviewers it needs
`payload/playbook/review.md` SHALL state that a repeated panel runs `sdlc-security`, every lens reviewer, and every other reviewer that raised a blocker last round or whose domain the fix diff touches, that it runs when unsure, and that a deep change's repeated panel runs all four. The sentence "the four core reviewers still run", the `mode=panel` words "the four and each lens" and the solo words "through those four lenses" SHALL be reworded to name the reviewers the step calls.

#### Scenario: the quality reviewer raised the only blocker
- WHEN review runs again on a standard change and the fix diff is a prose edit in one playbook file
- THEN `sdlc-security` and `sdlc-quality` run, and `sdlc-architect` and `sdlc-ops` are skipped

#### Scenario: unsure, or a deep change
- WHEN the main loop cannot tell whether a fix touches a reviewer's domain, or the change is deep
- THEN that reviewer runs, or all four run

### ADDED Requirement: A first standard panel is sized by its signals
`payload/playbook/review.md` SHALL state that a first panel on tier standard runs `sdlc-security` and `sdlc-quality`, adds `sdlc-architect` when change.md holds more than one `## Delta:` section or the diff changes more than 10 files, and adds `sdlc-ops` when the diff touches or may touch config, migrations or deploy files or the change has a `runbook.md`; tier deep runs all four.

#### Scenario: a one-capability standard change with 4 files
- WHEN the first panel runs
- THEN only `sdlc-security` and `sdlc-quality` run

#### Scenario: a deep change
- WHEN the first panel runs
- THEN all four core reviewers run

## Delta: expert-lenses

### MODIFIED Requirement: Later stages use the recorded lenses
The system SHALL let the recorded lenses bring design in, add their bars to the contract,
join the review panel alongside the core reviewers it calls, and be scored at verify.

#### Scenario: the stage playbooks
- WHEN the design, contract, review and verify playbooks are read
- THEN design runs when a recorded lens designs, contract carries each lens's bars, review
  adds one per lens to the core reviewers it calls, and verify scores each lens's bars

## Delta: cost-accounting

### ADDED Requirement: Tokens are reported per stage
`lib/observe.mjs` SHALL add to each change's summary a `stages` list: for each stage event in journal time order, `{stage, input, output, cacheRead, cacheWrite}` (plus `source` when the event has one): the growth of the session totals since the previous stage event, summed over sessions, never below 0 per class. A session's total at an event is its latest record at or before it, 0 before its first. The first stage is measured from the journal's first session record when that is at or before the event, else from 0. It SHALL read live and archived journals alike. `renderReport` SHALL print under a change's line one `    · <stage> <in>in/<out>out` line per stage, and `payload/playbook/observe.md` SHALL tell the reader to show them.

#### Scenario: contract, build, review, verify and ship events
- WHEN the journal holds session records between them
- THEN `stages` lists each in order with its own growth, and their output sums to the total at the last event minus the baseline

#### Scenario: no stage event, or only a review skip note
- WHEN the journal holds session records and no stage event
- THEN `stages` is empty and no stage line is printed

#### Scenario: an archived change, a stage before the first record, or two sessions
- WHEN observe reads them
- THEN the archived journal gives the same stages, an event before the first record grows 0, and each session is counted once

## Tasks
<!-- [P] = parallelizable wave · [tier:cheap|balanced|deepest] per the routing table in harness.md -->
- [x] T1 `lib/observe.mjs`: `stages` in `summarizeChange`, shown in `renderReport` [tier:balanced]
- [x] T2 `payload/playbook/review.md`: repeated and first-panel sizing, the three reworded phrases [P] [tier:balanced]
- [x] T3 `payload/playbook/observe.md`: show stage tokens [P] [tier:cheap]
- [x] T4 `CHANGELOG.md` Unreleased entry [tier:cheap]

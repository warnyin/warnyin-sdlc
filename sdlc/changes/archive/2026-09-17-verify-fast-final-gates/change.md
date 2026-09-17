---
id: verify-fast-final-gates
tier: standard
status: shipped
---
# Change: Verify runs a fast gate per fix round and the full suite once, after review
<!-- cap:100 · standard tier. Delta sections ARE the spec change — merged mechanically at ship, never re-narrated. -->

## Why (≤5 lines)
Every `/sdlc:verify` round runs the full test command, so a project with a slow suite pays it
after each fix. Review only runs once verify has passed, so its blockers cost another build and
another full run. Issue #7: a ~25-minute suite ran repeatedly and found nothing the scoped tests
had not; the real defects came from live smoke, reading the code, and review.

## Assumptions
- Tier `standard`: playbook doctrine, the harness seed template and one reporting counter.
  No hook, installer, prune or merge semantics (`harness.md § Tier triage`). Human confirmed.
- Both gates live in verify, chosen from the journal by one ordered list. No new status:
  `lib/caps.mjs` freezes the list, so `verified` now means the final gate passed. Human confirmed.
- Fast scope: the harness `fast test command` when present, otherwise tests covering the
  contract rows and touched paths. Human confirmed. Safe: existing installs never receive the
  new seed line, so doctrine must work without it.
- Evals and lens bars are scored in the fast gate only. Safe: they judge the diff, not the suite.
- One budget of 3 rounds: fast or final failures and review blockers, as before. Observe counts
  fast outcomes and final failures; review blockers stay in their own `review` events.
- Review signals are defined once, in `review.md` Run when; verify, next and ship point to it.
- Pre-split journals: a passing verify note with no `gate` counts as a fast pass that ran the
  full suite. Safe: the old verify always ran the full test command.
- The seed constitution's flow line changes for new installs only; `update` never rewrites it.
  Existing projects read the new flow from the refreshed playbooks. Stated in CHANGELOG.
- Build runs as conductor despite the task count: every edit shares gate wording pinned by one
  test file, so parallel builders would drift. Safe: the tasks are short doctrine edits.
- `init.md` unchanged (the seed comment explains the key; init runs once). No lens: doctrine only.

## Delta: verify-gates

### ADDED Requirement: A fix round runs a fast gate, not the full suite
The system SHALL, in every verify round, run only the tests covering the change's contract
rows and touched areas, exercise the change live when it has a runnable surface (a CLI, server
or UI a person can run), and score the evals and lens bars. It SHALL NOT run the full test
command as a fast-gate requirement, and SHALL record whether the run was the full suite.

#### Scenario: the project names a fast test command
- WHEN the harness names a fast test command and a verify round runs
- THEN that command runs instead of the full test command

#### Scenario: the project names none
- WHEN the harness has no fast test command
- THEN the round runs the tests covering the contract rows and the touched paths, or the full
  test command when no such subset can be named

### ADDED Requirement: The full suite runs once, after review
The system SHALL run the full test command only after the fast gate has passed and, when
review signals are present, after a review with zero blockers. The change SHALL be marked
verified only when that final gate passes. Any code edit after the fast gate, including one
made during review, SHALL send the change through the fast gate again.

#### Scenario: a change with review signals passes the fast gate
- WHEN the fast gate passes and review signals are present with no passed review recorded
- THEN the change routes to review, the full suite has not run, and it is not yet verified

#### Scenario: review passes or is not signalled
- WHEN review ran and recorded zero blockers, or verify itself finds no review signal
- THEN the next verify runs the final gate and marks the change verified on a pass

#### Scenario: a recorded review skip
- WHEN the journal holds a review note marked as skipped for lack of a signal
- THEN verify still evaluates the signals itself, and the skip never stands in for a review

#### Scenario: review after the fast gate
- WHEN review runs and the journal shows a fast pass since the last build, or the change is verified
- THEN the panel runs and does not skip, whoever invoked it and in whichever session

#### Scenario: code changes after the change is verified
- WHEN a build is recorded after the last final-gate pass
- THEN ship sends the change back to verify

#### Scenario: review edits the code
- WHEN review applies a fix itself
- THEN a build is recorded, and verify runs the fast gate before the final gate

#### Scenario: the final gate fails
- WHEN the full test command fails
- THEN fix tasks are appended, the round counts toward the same 3-round budget, and after
  build the fast gate runs before the final gate again, without a repeat review

#### Scenario: the fast gate already ran the full suite
- WHEN the last fast-gate pass is recorded as the full suite and no build follows it
- THEN the final gate records a pass without running it again, marked as reused

### ADDED Requirement: The journal names the gate and rounds follow the budget
The system SHALL record on each verify outcome which gate produced it. It SHALL count verify
rounds from fast-gate outcomes and final-gate failures, and first-pass SHALL be false when
either gate fails before the final gate first passes.

#### Scenario: a report counts rounds
- WHEN a change has one fast-gate pass and one final-gate pass
- THEN its report shows one verify round, first-pass true

#### Scenario: the final gate fails once
- WHEN a fast-gate pass is followed by a final-gate failure
- THEN the report shows two rounds and first-pass false

#### Scenario: a record predates gates
- WHEN a verify record carries no gate field
- THEN it counts as a round, as before

## Tasks
<!-- [P] = parallelizable wave · [tier:x] per the routing table in harness.md -->
- [x] T1 verify.md: fast gate (fast command or derived scope, live smoke, evals, lens bars), final gate once after review, reuse, `gate=` notes, routing [tier:balanced]
- [x] T2 review.md Next → verify final gate; next.md status mapping; ship.md precondition names the final gate [P] [tier:cheap]
- [x] T3 Flow lines: auto.md, playbook README, rules-card (flow + Verify line), verify command description [P] [tier:cheap]
- [x] T4 harness seed template: optional `fast test command` line [P] [tier:cheap]
- [x] T5 lib/observe.mjs: rounds and first-pass ignore `gate=final` [P] [tier:balanced]
Review 1 (blockers=4): signal-list loop; review edits skip fast gate; final failures hidden; reuse from memory.
- [x] T6 verify.md one ordered gate list; signals point to review.md; `scope=` on fast notes; reuse needs `scope=full` + no build, notes `reused=yes`; gateless pass = fast full [tier:balanced]
- [x] T7 review.md: skip records `review blockers=0 skipped=no-signal`; applied fixes record `build source=review`; next.md building → review when awaiting it; ship.md signals pointer + digest names reuse [P] [tier:cheap]
- [x] T8 lib/observe.mjs: final failures count as rounds and clear first-pass; gate normalized, unknown counts [P] [tier:balanced]
- [x] T9 contract rows + tests for T6–T8; CHANGELOG Unreleased entry names the seed-constitution gap [tier:cheap]
Review 2 (blockers=1): a skip note stood in for a review. Also: build after verified; first-pass; Next list.
- [x] T10 verify/next/ship: verify evaluates `review.md` signals itself; only a real review's `blockers=0` counts, never `skipped=` [tier:balanced]
- [x] T11 ship.md: a `build` note after the last final-gate pass → /sdlc:verify; verify Next points to review.md only [P] [tier:cheap]
- [x] T12 lib/observe.mjs: any gated failure before the final gate passes clears first-pass [P] [tier:cheap]
- [x] T13 contract rows 28–30 + tests [tier:cheap]
- [x] T14 Review 3 (blockers=1, human approved round 4): skip loop — review sent by verify or ship never skips; drop verify's dead re-score clause; next.md counts a gateless pass; ship.md orders its checks [tier:cheap]
- [x] T15 contract row 31 + test [tier:cheap]
- [x] T16 Review 4 (blockers=1, human approved round 5): no-skip keyed to the journal, not the caller; row 31 [tier:cheap]

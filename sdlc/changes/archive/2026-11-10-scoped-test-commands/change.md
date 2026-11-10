---
id: scoped-test-commands
tier: standard
status: shipped
---
# Change: Scoped test commands, so a monorepo does not run its full suite by default
<!-- cap:100 · standard tier. Delta sections ARE the spec change — merged mechanically at ship, never re-narrated. -->

## Why (≤5 lines)
In a large monorepo the agent keeps running the whole suite while developing, and each run costs
minutes. The stages already say "scoped", but the harness names no command for it, a single fixed
fast command cannot follow what changed, and the fast gate's fallback goes straight to the full
command, unrecorded. Scoped must be the easy path and a full run must leave a stated reason.

## Assumptions
- Scope is items A and B of the proposal. Detecting a monorepo in `/sdlc:init` and an
  affected-only final gate are left out; the final gate stays the full test command.
- Added beyond the request: `contract.md` step 3 runs the harness test command for the red check, so
  every contract would still run the full suite. Read at `payload/playbook/contract.md:20-21`. It
  uses the same single-test rung, because leaving it would defeat the change's outcome.
- `sdlc/harness.md` is a seed, never refreshed by `update` (`seed('harness.md', ...)` at
  `bin/cli.mjs:436`, CLAUDE.md § Ownership), so existing projects will not get the new line. Every
  rung therefore has to work with only `test command` present.
- `reason=` needs no journal change: `note` stores any `k=v` (`payload/hooks/journal.mjs:92-97`).
  Its values are a closed set, so no prose reaches a shell (constitution). No code reads `scope`:
  a grep of `lib`, `bin` and `payload/hooks` for `scope=` and `.scope` returned nothing, so the
  addition cannot change what observe counts or what the final gate reuses.
- The rule is doctrine, not enforced by a hook: a pre-split or older `scope=full` note has no
  reason and must stay valid for reuse. The journal records the reason; nothing rejects its absence.
- `reason=` is a claim the agent makes about itself; only the evals line checks it against the diff.
- Reuse stays as it is: a passing fast round that ran the full suite means the final gate asks nothing.
- Lenses: no lens signal fires. The delta is playbook prose and a seed, with no screen, API, stored
  data or rollout. Deploy signal absent, so no `deploy` lens.

## Delta: verify-gates

### MODIFIED Requirement: A fix round runs a fast gate, not the full suite
The system SHALL, in every verify round, run only the tests covering the change's contract
rows and touched areas, exercise the change live when it has a runnable surface (a CLI, server
or UI a person can run), and score the evals and lens bars. It SHALL NOT run the full test
command as a fast-gate requirement, and SHALL record whether the run was the full suite. It SHALL
take the first rung that can run: the harness's fast test command, the tests related to the touched
files, the tests of the touched packages, and the full test command only when none of those can be
named, the diff is cross-cutting, or the human asks. A fast-gate note from a full run, pass or fail,
SHALL record why, as one value of a closed set: `no-subset`, `cross-cutting` or `human`.

#### Scenario: the project names a fast test command
- WHEN the harness names a fast test command and a verify round runs
- THEN that command runs instead of the full test command

#### Scenario: the project names none
- WHEN the harness has no fast test command
- THEN the round runs the tests related to the touched files and the contract rows, or failing that
  the tests of the touched packages

#### Scenario: nothing narrower can be named
- WHEN no rung narrower than the full test command can be named
- THEN the full test command runs and the note records `scope=full` with a `reason=` from the set

#### Scenario: the diff is cross-cutting
- WHEN the diff edits a root config, a lockfile or a test helper every package loads
- THEN the full test command may run, and the note records `reason=cross-cutting`

#### Scenario: a scoped run misses a contract row
- WHEN a scoped command passes without running the test of a contract row
- THEN that row's test is run directly, and the row does not count as covered until it passes

### ADDED Requirement: A harness test command may name what to scope to
The system SHALL let the harness name a test command at each of three levels: the full `test
command`, a `fast test command` that may carry `{changed}`, and a `single test command` that may
carry `{files}`. A placeholder SHALL be expanded before the command is run or handed to a
subagent, except that `{files}` handed to the contractor is expanded by it over the files it
writes. Each expanded path SHALL be within `[A-Za-z0-9._/-]` and not start with `-`, to keep a file
name from acting as shell syntax or a runner flag; `{changed}` SHALL mean the files this
change edited that still exist, since a deleted path breaks a runner. `/sdlc:init` SHALL fill the
commands the project has. A command left as the seed's `<cmd>`
SHALL count as not named. A placeholder with nothing to expand into, or with a path outside that
set, SHALL make that rung unusable, never a run with the placeholder removed or a path left out,
since many runners read no arguments as "everything".

#### Scenario: a new project gets all three lines
- WHEN `init` seeds `sdlc/harness.md`
- THEN it has a test command, a fast test command and a single test command line

#### Scenario: a project only has the old harness lines
- WHEN the harness has no `single test command` line, or leaves it as `<cmd>`
- THEN the stage narrows the run with the test runner's own file filter, not the full test command

#### Scenario: the change has no files to expand
- WHEN `{changed}` would expand to nothing
- THEN the fast test command does not run and the next rung is taken

#### Scenario: a touched file has an unsafe name
- WHEN a path handed to a runner holds a space, a shell character or a leading `-`
- THEN that rung is unusable and the next rung is taken

### ADDED Requirement: A self-check and a red check run only their own tests
The system SHALL run a build task's self-check, and the contract stage's red check, through the
`single test command` or the test runner's own file filter on the test files concerned. A self-check
SHALL NOT run the full test command. A red check SHALL NOT run it either, unless the runner has no
file filter, and then the contract note SHALL record `scope=full reason=no-subset`.

#### Scenario: a builder checks its task
- WHEN a task's tests are ready to run in `/sdlc:build`
- THEN only those test files run, plus lint

#### Scenario: a builder has no file filter
- WHEN the task has no test files, or the runner has no file filter
- THEN the task runs lint only and leaves its tests to `/sdlc:verify`

#### Scenario: the contract checks its tests are red
- WHEN `/sdlc:contract` has generated the failing tests
- THEN only the generated test files run

#### Scenario: the contractor wrote no test file
- WHEN `/sdlc:contract` gets no generated test file back
- THEN it stops and reports that, running nothing

## Tasks
<!-- [P] = parallelizable wave · [tier:cheap|balanced|deepest] per the routing table in harness.md -->
- [x] T1 Seed: three levels in `payload/templates/harness.md`; filling them in `payload/playbook/init.md` [tier:balanced]
- [x] T2 Fast gate: the ladder, unnamed `<cmd>`, the missed-row rule, `reason=` and the failure note in `payload/playbook/verify.md`; expanded placeholders and uncovered rows in `payload/playbook/routing.md` [tier:balanced]
- [x] T3 Self-check and red check: `payload/playbook/build.md`, `payload/playbook/contract.md`, `payload/adapters/claude/agents/sdlc-builder.md`, `payload/adapters/claude/agents/sdlc-contractor.md` [tier:balanced]
- [x] T4 CHANGELOG entry; the "works without the new key" line of `sdlc/evals/verify-gates/rubric.md` no longer scores falling back to full as best; `npm run setup:dogfood` so the local commands carry the payload [tier:cheap]
- [x] F1 F2 Review round 1, closed: an allowlist rule for expanded paths; the contractor expands `{files}` itself (Delta, V3, V4, V8, B1, B2, C0 to C3, BA, CA, CB, tests)
- [x] F3 Review round 2 blocker: a leading `@` or `+` slipped through. The set is now `[A-Za-z0-9._/-]`, no leading `-`, across payload, tests, tests.md, Delta, CHANGELOG. Re-sweep for the old set over payload, tests, CHANGELOG and the change = 0 hits [tier:balanced]
- [x] F4 Review round 2 blocker: contract.md step 5 now adds `scope=full reason=no-subset` to the contract note, pinned by C5 in tests.md and the test file; `note contract|contract note` re-sweep: step 5 and C3 agree [tier:balanced]
<!-- review improvements recorded for the digest: Delta names no file (constitution); C2 lacks "running nothing"; zero-test false pass of a scoped run; no source for the build `{files}`; who runs the red check; `{changed}` has no stored base; a harness with no such line is not pinned; `reason=` paste `<|>` and no validator; stale `verify.md:55-57` cite; dogfood harness lacks the new lines; CHANGELOG needs a customized-install note; release needs `npm run shipped-hashes` and a version heading; `inOrder` and a duplicate `oneLine` can shrink; round 2: scope/reason are never read by observe or the digest; the set rejects `()[]`, `~`, non-ASCII and `\`, so monorepo routes fall to full; check every path before expanding any; a runner with no file filter has no rule for rungs 2-3 or for CB; the unsafe-name scenario is pinned only by V3/V4; `{files}` in a fast and `{changed}` in a single command have no stated source; the CHANGELOG entry can shrink to 6 lines and lacks a rollback line; F1 hit counts are stale; one named "safe path" term would cut the repeated set text; the "No code reads scope" claim rests on a one-time grep -->
<!-- round 3 (tree 305cc62c, 0 blockers) improvements: the set admits a directory, `.`, a leading `/` and `..`, so say "a file inside the project"; a very long list should split or take the next rung; the step 3 and step 5 notes state the no-subset rule twice; no Delta scenario for the contract-stage scope=full note or for a harness with no single-command line; R1 says pass/fail while the runner returns pass|fail|uncovered; CA, CB and C3 disagree on a runner with no filter; row 2 test title is stale; one "safe path" term would shrink the repeated set text; the living spec verify-gates still has the old fallback until ship merges the delta -->

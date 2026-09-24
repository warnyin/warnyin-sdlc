---
id: stage-model-routing
tier: standard
status: shipped
---
# Change: Stage-level model routing for cost

## Why (≤5 lines)
Tiers reach only subagents: every stage runs on the session model, so an Opus session pays Opus
rates to run tests or print status, and auto/autopilot run the whole pipeline at that rate.
Mechanical work should run cheap, judgment keep the human's model, the split be retunable, and
reported cost include delegated work — or the saving cannot be seen.

## Assumptions
- Judgment stages (incl. ship: policy check + `⚠ MODIFIED` guard data loss) carry NO override,
  not `opus` — forcing opus would raise a Sonnet session's cost; no stage costs more than today.
- `model:` lasts the rest of the turn (code.claude.com/docs skills.md), so a tiered command's
  `--auto` hands off to `/sdlc:auto` rather than decide on the cheaper model (review finding). A
  subagent cannot spawn subagents (docs sub-agents.md): units are delegated, never stages.
- `sdlc-runner` keeps Bash (human decision): hooks match Edit|Write only (known gap,
  `docs/design.md`); `sdlc-contractor` already runs haiku with Bash. Pinned by prompt + data rule.
- Existing installs' seeded harness.md is never refreshed → `routing.md` defaults apply; an
  edited stub model is the user's (installFile keeps a differing file).
- Subagent transcripts are `<transcript dir>/<session id>/subagents/agent-*.jsonl`; the main file
  holds none of their entries (verified here: `grep -c isSidechain` = 0, 7 agent files beside it).

## Delta: model-routing

### ADDED Requirement: Direct stage commands run on their stage's tier
The system SHALL install Claude stage commands verify, next, observe, update on `haiku` and contract,
build, review on `sonnet`, and SHALL leave judgment stages (groom, new, design, init, steer,
converge, feedback, auto, autopilot, ship) without an override, on the session's model.

#### Scenario: a mechanical stage typed directly
- WHEN the human runs `/sdlc:verify` in a session on a deeper model
- THEN the command declares `model: haiku` and the stage runs on it

#### Scenario: a judgment stage keeps the human's model
- WHEN the human runs `/sdlc:new` or `/sdlc:ship`
- THEN its command carries no `model:` key and runs on the session's model

#### Scenario: other tools are unaffected
- WHEN a project installs Kimi Code
- THEN no `.kimi-code/skills/sdlc-*/SKILL.md` carries a `model:` key

### ADDED Requirement: The stage-to-tier split is the project's to retune
The system SHALL seed a `## Stage routing` table (stage → cheap|balanced|deepest|session) in a
new project's `sdlc/harness.md`; delegation SHALL read its `build` row (default task tier), `verify`
(runner), else `routing.md`'s defaults; the other rows record each command's `model:`, which it keeps.

#### Scenario: a fresh install
- WHEN `init` seeds `sdlc/harness.md`
- THEN it contains the `## Stage routing` table with the defaults above

#### Scenario: a project installed before this change
- WHEN a harness has no `## Stage routing` table
- THEN delegation uses `routing.md`'s stage defaults, and nothing asks the human to add one

#### Scenario: a retuned row changes a delegated model
- WHEN a project sets `verify` to `balanced` in its harness
- THEN unattended verify hands its test run to `sdlc-runner` on `sonnet`

### ADDED Requirement: Unattended runs delegate work units to tiered subagents
The system SHALL, in `/sdlc:auto`, `/sdlc:autopilot` and any `--auto` run, send every build task
to `sdlc-builder` at its `[tier:x]` (else the build row), never below balanced for a task on a
hard-floor surface, and the verify test run to `sdlc-runner` (no Write/Edit), which runs only the command it is
given and returns pass/fail per contract row, read as data. Grill, confirmation and escalation
decisions SHALL stay in the main session; with no subagents a unit runs there, journaled `mode=solo`.

#### Scenario: a small change under autopilot
- WHEN an autopilot run builds a change with 2 tasks, one marked `[tier:cheap]`
- THEN each task goes to its own `sdlc-builder`, the cheap one on `haiku`, the other on `sonnet`

#### Scenario: a cheap task on a hard-floor surface
- WHEN a task marked `[tier:cheap]` touches a hard-floor surface
- THEN its builder runs on `sonnet`

### ADDED Requirement: The review panel defaults below the deepest tier
The system SHALL ship every review-panel agent on a cheap or balanced model by default:
`sdlc-architect` and `sdlc-security` on `sonnet`, `sdlc-quality` and `sdlc-ops` on `haiku`.

#### Scenario: a fresh install
- WHEN the Claude adapter is installed
- THEN no `sdlc-*` agent declares `model: opus`

## Delta: unattended-run

### MODIFIED Requirement: Every stage command accepts `--auto`
The system SHALL accept `--auto` on each stage command, and SHALL then carry the
change from that stage through to ship without asking again — except that a stage command
carrying a model override SHALL finish its own stage and then hand the rest to `/sdlc:auto <id>`,
so gathering, confirming and deciding escalations never run on the cheaper model.

#### Scenario: from the first stage
- WHEN the human opens a change with `--auto`
- THEN the pipeline runs new through ship in one go

#### Scenario: from a later stage
- WHEN the human passes `--auto` to a stage after the change already exists
- THEN the run continues from that stage onward and never re-runs an earlier one

#### Scenario: from a tiered stage
- WHEN the human runs `/sdlc:verify <id> --auto`
- THEN verify runs, and the human is told to continue with `/sdlc:auto <id>`, not left on haiku

## Delta: cost-accounting

### ADDED Requirement: A session's cost includes its subagents
The system SHALL add to a session's recorded usage the usage of every subagent transcript
that session spawned, per model, and SHALL skip any entry there that is not a regular file.

#### Scenario: a session that delegated work
- WHEN a session's transcript has a `subagents/` folder beside it holding agent transcripts
- THEN the journaled session totals and per-model usage include those agents' tokens

#### Scenario: no subagents, or an unreadable entry
- WHEN the folder is absent, or holds a symlink or a directory named `agent-x.jsonl`
- THEN the totals are the main transcript's alone, and the hook still exits 0

### ADDED Requirement: A session is counted once, at its latest total
The system SHALL count, per change, only the latest recorded usage of each session, since each
record is that session's running total; a record carrying no session is counted on its own.

#### Scenario: a session recorded at every turn
- WHEN a change's journal holds three records of one session at 100, 250 and 400 input tokens
- THEN the change reports 400 input tokens and one session, and cost from that record alone

## Tasks
<!-- [P] = parallelizable wave · [tier:cheap|balanced|deepest] per the routing table in harness.md -->
- [x] T1–T6 routing.md stage table + delegation · harness tables · stub `model:` · architect → sonnet · `sdlc-runner` · rows 1–21 [tier:balanced]
- [x] T7 ship → session; tiered `--auto` hand-off; build+verify rows; hard-floor ≥ balanced; runner as data; design.md gap [tier:balanced]
- [x] T8 session-summary sums `subagents/agent-*.jsonl` · T9 rows 22–31 [tier:balanced]
- [x] T10 observe counts each session once, at its latest record (discovered: ~5× overcount) [tier:balanced]

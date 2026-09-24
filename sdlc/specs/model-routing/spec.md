# Spec: model-routing

## Purpose
<!-- one or two lines; commands grep this header first (progressive disclosure) -->

## Requirements

### Requirement: Direct stage commands run on their stage's tier
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

### Requirement: The stage-to-tier split is the project's to retune
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

### Requirement: Unattended runs delegate work units to tiered subagents
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

### Requirement: The review panel defaults below the deepest tier
The system SHALL ship every review-panel agent on a cheap or balanced model by default:
`sdlc-architect` and `sdlc-security` on `sonnet`, `sdlc-quality` and `sdlc-ops` on `haiku`.

#### Scenario: a fresh install
- WHEN the Claude adapter is installed
- THEN no `sdlc-*` agent declares `model: opus`
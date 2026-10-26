---
id: progress-percent
tier: standard
status: shipped
---
# Change: a change's progress as one figure — tasks done and an overall percent (#13)
<!-- cap:100 · standard tier. Delta sections ARE the spec change — merged mechanically at ship, never re-narrated. -->

## Why (≤5 lines)
During `/sdlc:auto` on a deep change the human sees stage names and task ticks but no single figure
for how far along the run is, so they cannot judge how much remains while waiting (#13). `status`
and `/sdlc:next` show only `[tier/status]`.

## Assumptions
- Formula (human chose it): new 10% · contracted 25% · building 25% + 50% × ticked/total (all
  ticked = verify/review under way, 75%) · verified 90% · shipped 100%, rounded with `Math.round`;
  no tasks while building → 25%; any other status (including readChanges's `?` for a missing or
  frontmatter-less change.md) has no figure.
- The task count is shown beside the percent whenever the change has tasks; with none, the percent
  stands alone.
- The figure can fall: verify appends unchecked fix tasks to `## Tasks` while status is building
  (verify.md), so 4/4 · 75% can become 4/5 · 65%. That is the honest reading of remaining work.
- Tasks are bullet lines `- [ ]`/`- [x]`/`- [X]` (or `*`, any indent) under every unfenced
  heading that starts `## Tasks` (so `## Tasks (fix 1)` counts; `### Tasks` does not), summed across
  such sections, read with lib/fences.mjs's section rule (CRLF-aware). A multi-line HTML comment is
  not special; an unclosed fence hides what follows it, as it does for every section reader.
- The figure lives in a new `lib/progress.mjs` (imports only `node:*` and sibling lib modules, so a
  hook may use it later); `status` is its only caller now. Installing it changes shipped hashes:
  the release step regenerates `bin/shipped-hashes.json` as usual.
- The text line gains the figure right after the title; nothing before it moves. `status --json`
  gains `progress` per change after the existing keys (additive, like the relations fields).
- Wave starts/finishes come from the orchestrator, not from files, so the figure moves on the
  next task tick, not mid-wave.

## Delta: cli-surface

### ADDED Requirement: Status gives each change one progress figure
The system SHALL give every open change in `status` a progress figure computed from its status and
its ticked tasks by the formula in this change's Assumptions, printed as ` · tasks <done>/<total> ·
<p>%` after the title (` · <p>%` alone when there are no tasks, nothing when there is no figure), and
in `status --json` as `progress: { done, total, percent }` (`percent: null` when there is no figure).

#### Scenario: a change part way through its tasks
- WHEN a standard change is `building` with 2 of 4 tasks ticked
- THEN its status line shows `· tasks 2/4 · 50%` and its JSON `progress` is `{ done: 2, total: 4, percent: 50 }`

#### Scenario: checkboxes outside the Tasks sections
- WHEN Assumptions or a fenced block inside Tasks holds `- [x]` lines
- THEN they are not counted

#### Scenario: a change with no figure
- WHEN a change folder has no change.md, or its status is not one of the five
- THEN its status line carries no figure and its JSON `progress.percent` is `null`

## Delta: unattended-run

### ADDED Requirement: Every progress update states the figure
The system SHALL tell the agent, in `payload/playbook/auto.md`, `payload/playbook/build.md` and
`payload/playbook/next.md`, that every progress update — a stage change, a wave started or finished,
a task ticked — states the change's figure from `status`.

#### Scenario: an unattended run moves to the next wave
- WHEN the orchestrator reports a wave finished
- THEN the report carries `tasks d/t · p%` from `status`

## Tasks
- [x] T1 lib/progress.mjs: parse ticked/total from the `## Tasks` sections; percent by status [tier:balanced]
- [x] T2 bin/cli.mjs cmdStatus: text suffix and JSON `progress` [tier:balanced]
- [x] T3 auto.md, build.md, next.md: the progress-update sentence [P] [tier:cheap]
- [x] T4 CHANGELOG Unreleased entry [tier:cheap]

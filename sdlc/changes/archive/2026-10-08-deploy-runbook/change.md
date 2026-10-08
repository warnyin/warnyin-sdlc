---
id: deploy-runbook
tier: standard
status: shipped
---
# Change: a change that needs a migration, several environments or complex settings ships a runbook
<!-- cap:100 · standard tier: one capability, behavior change. -->

## Why (≤5 lines)
A change that runs a migration, deploys to several environments or adds config/secrets ships
today with at most one "migration plan with rollback" design line (`data` lens) and an ops
review of the diff. Nothing gives the person who deploys it an ordered list of steps per
environment, the settings to put in place, how to check it worked and how to back out.

## Assumptions
- Shape, contents and enforcement were settled with the human in the autopilot grill: a new
  `deploy` lens, a `runbook.md` with six fixed sections, required once the lens is recorded.
- `grep -rli runbook payload lib bin docs sdlc/specs` returned nothing: no runbook concept
  exists to extend or conflict with.
- `lenses.md` is 56 effective lines of its 60 cap (`countEffectiveLines`); a fourth lens does
  not fit, so `CAPS.lensCatalog` rises to 70 together with the catalog's `cap:` comment.
- Runbook cap is 60 effective lines (`CAPS.runbook`): six sections with per-env steps; a
  rollout that needs more belongs in the project's own ops docs, linked from the runbook.
- Section headings are frozen English parser keys, like Delta keywords; prose may be localized.
- The runbook is required from `status: contracted` on: design writes it, and every later
  stage (contract, review, ship) can rely on it existing. Before that it is not checked.
- The archive moves the whole change folder (`cmdArchive` phase 2), so `runbook.md` travels
  into `changes/archive/<date>-<id>/` with no archive code change — proven by row 12.
- "Secrets are named, never valued" is doctrine (template + lens + `sdlc-ops`), not a
  validator rule: no pattern separates a value from a placeholder reliably.
- Recording why a signalled change skipped the lens is playbook prose in `new.md`; the
  validator cannot see a signal that was never recorded.
- No hook or prune behavior changes; `runbook.md` lives inside the change folder, which the
  installer never owns. Tier stays standard.

## Delta: deploy-runbook

### ADDED Requirement: A deploy lens is chosen for changes that are hard to deploy
The system SHALL offer a `deploy` lens, described in `payload/playbook/lenses.md` and accepted
by `lib/lenses.mjs`, whose signals are a migration, configuration that differs per environment,
or new environment variables, secrets, feature flags or infrastructure.

#### Scenario: the lens is accepted
- WHEN a change records `deploy@builtin`
- THEN validation reports no lens issue and the catalog describes `deploy` with all four parts

### ADDED Requirement: A deploy change carries a runbook with fixed sections
The system SHALL require `runbook.md` in the change folder of any change that recorded the
`deploy` lens once its status is `contracted` or later, with the sections Pre-checks,
Config & Secrets, Steps, Migration order, Verify and Rollback, within its line cap, as a
regular file with no template placeholder left outside code and comments.

#### Scenario: runbook missing
- WHEN a contracted change recorded `deploy` and has no `runbook.md`
- THEN validation reports an error naming the missing runbook

#### Scenario: a section missing
- WHEN the runbook lacks one of the six sections
- THEN validation reports an error naming that section

#### Scenario: an unfilled template
- WHEN the runbook still holds a `<…>` placeholder from the template
- THEN validation reports an error naming the placeholder

#### Scenario: over the cap
- WHEN the runbook exceeds its line cap
- THEN validation reports an error with its line count and the cap

#### Scenario: no deploy lens
- WHEN a change did not record `deploy`
- THEN no runbook is required, and a runbook.md it holds is not checked

### ADDED Requirement: The runbook is written, reviewed and handed over by the stages
The system SHALL have design write the runbook from `payload/templates/runbook.md` with secrets
named but never valued, have the ops reviewer (`payload/adapters/claude/agents/sdlc-ops.md`)
check it, have the ship digest (`payload/playbook/ship.md`) link it, and have the opening stage
(`payload/playbook/new.md`) record one Assumptions line when a deploy signal is present but the
lens is not recorded.

#### Scenario: the stage files
- WHEN `design.md`, `review.md`, `ship.md`, `new.md`, `sdlc-ops.md` and the runbook template are read
- THEN each states its part of writing, reviewing, linking or skipping the runbook

## Tasks
- [x] T1 `lib/lenses.mjs` + `lenses.md` deploy lens (+ `tests/lenses.test.mjs` list); `CAPS.lensCatalog` 70 + `CAPS.runbook` 60 [tier:balanced]
- [x] T2 `payload/templates/runbook.md` with the six sections and `cap:60` [P] [tier:cheap]
- [x] T3 `lib/validate.mjs`: runbook required/sections/cap when `deploy` is recorded [tier:balanced]
- [x] T4 playbooks `new`, `design`, `review`, `ship` + `sdlc-ops` agent + conventions skill [P] [tier:cheap]
- [x] T5 `docs/design.md` ledger row for `runbook.md` [P] [tier:cheap]
- [x] R1 review blocker (class: lens whose verify bars have no contract source): deploy lens got
  `contract —` bars + `contract` stage. Sweep `grep -nE "^- stages:|contract —" lenses.md` → 4/4
  lenses carry both. Also applied: placeholders rejected, link/non-file/oversized runbook refused,
  `hasLens` in lenses.mjs, checks gated on the lens, template per-env step ids + expand/contract +
  IRREVERSIBLE, design.md 1b wording [tier:balanced]
- follow-up (review, not applied): mixed ```/~~~ fences in the shared `linesOutsideFences`
  (grill.md too); release note — a project that kept an edited design.md/lenses.md gets the
  runbook requirement without the prose, and an older CLI rejects `deploy@…`; lenses.md is 69/70.

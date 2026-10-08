# Spec: deploy-runbook

## Purpose
<!-- one or two lines; commands grep this header first (progressive disclosure) -->

## Requirements

### Requirement: A deploy lens is chosen for changes that are hard to deploy
The system SHALL offer a `deploy` lens, described in `payload/playbook/lenses.md` and accepted
by `lib/lenses.mjs`, whose signals are a migration, configuration that differs per environment,
or new environment variables, secrets, feature flags or infrastructure.

#### Scenario: the lens is accepted
- WHEN a change records `deploy@builtin`
- THEN validation reports no lens issue and the catalog describes `deploy` with all four parts

### Requirement: A deploy change carries a runbook with fixed sections
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

### Requirement: The runbook is written, reviewed and handed over by the stages
The system SHALL have design write the runbook from `payload/templates/runbook.md` with secrets
named but never valued, have the ops reviewer (`payload/adapters/claude/agents/sdlc-ops.md`)
check it, have the ship digest (`payload/playbook/ship.md`) link it, and have the opening stage
(`payload/playbook/new.md`) record one Assumptions line when a deploy signal is present but the
lens is not recorded.

#### Scenario: the stage files
- WHEN `design.md`, `review.md`, `ship.md`, `new.md`, `sdlc-ops.md` and the runbook template are read
- THEN each states its part of writing, reviewing, linking or skipping the runbook
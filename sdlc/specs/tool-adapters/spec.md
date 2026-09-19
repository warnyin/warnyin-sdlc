# Spec: tool-adapters

## Purpose
What `init`/`update` installs into a project for each supported coding tool — a dedicated
rules file pointing at the playbook for a lite-tier tool, versus Claude's fuller hooks,
skills, agents and commands — and how a tool is detected and kept in sync with what it owns.

## Requirements

### Requirement: Kimi Code is installable as a lite adapter
The system SHALL, when `kimi` is selected or detected as a tool, install a dedicated rules
file at `.kimi-code/AGENTS.md` carrying the shared rules-card and a pointer to
`sdlc/.playbook/`, owned by the installer's manifest like every other lite-tier adapter.

#### Scenario: fresh install selects kimi
- WHEN `init --tool kimi` runs in a project with no `.kimi-code/` directory
- THEN `.kimi-code/AGENTS.md` is written with the rules-card and the playbook pointer, and the
  manifest records it as sdlc-owned

#### Scenario: a user's own file at that path is preserved
- WHEN `.kimi-code/AGENTS.md` already exists with content the installer did not write
- THEN `init --tool kimi` leaves it untouched and does not claim it in the manifest

#### Scenario: update refreshes what it owns
- WHEN a later `update` runs after the framework's rules-card text has changed, and the on-disk
  file still matches the old manifest hash
- THEN `.kimi-code/AGENTS.md` is rewritten to the new text and the manifest hash is refreshed

### Requirement: Kimi Code is detected like the other directory-marker tools
The system SHALL treat a project's `.kimi-code/` directory as evidence Kimi Code is already in
use, pre-selecting it in the interactive picker; its absence never blocks a manual selection.

#### Scenario: existing .kimi-code directory
- WHEN a project already has a `.kimi-code/` directory and `init` runs interactively with no
  `--tool` given
- THEN Kimi Code is listed under "Detected in this project" and pre-selected in the picker

#### Scenario: no directory yet, explicit selection still works
- WHEN a project has no `.kimi-code/` directory
- THEN `init --tool kimi` still installs the adapter
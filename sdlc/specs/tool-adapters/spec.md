# Spec: tool-adapters

## Purpose
What `init`/`update` installs into a project for each supported coding tool: a rules file
carrying the shared card, stage shortcuts where the tool has them, and hooks only for Claude —
enforcement is what separates the tiers, not invocation — plus how a tool is detected and how
what it owns stays in sync and reclaimable.

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

### Requirement: A project's recorded tool list stays in sync with what init installs
The system SHALL, when `init` runs against a project whose `sdlc/config.yaml` already exists,
record every tool it installs this run in that file's `tools:` line, added to whatever was
already recorded there — never removing a tool that isn't part of this run's selection.

#### Scenario: adding a tool to an existing install
- WHEN a project's `config.yaml` records `tools: [claude]` and `init --tool kimi` runs
- THEN `config.yaml` records `tools: [claude, kimi]`, and a later plain `update` keeps both
  instead of pruning either

#### Scenario: re-running init for an already-recorded tool changes nothing
- WHEN `config.yaml` already records a tool and `init --tool <that same tool>` runs again
- THEN the recorded list is unchanged — no duplicate entry, no reordering

#### Scenario: unchecking an already-installed tool in the picker does not remove it
- WHEN a project already has `.cursor/` (detected, pre-selected) and the person interactively
  deselects it before confirming
- THEN `init` does not touch `.cursor/`'s files, and `config.yaml` still records `cursor` in
  `tools:` — only `update --tool` can shrink that list

#### Scenario: a config predating the tools key is left as it is
- WHEN `config.yaml` exists but carries no `tools:` line at all
- THEN `init` does not add one, same as `update` already behaves in that situation

### Requirement: init preserves the ownership it already recorded
The system SHALL, when `init` runs against a project that already carries a manifest, keep every
recorded entry it does not rewrite during that run, so files installed by an earlier run stay
owned. `init` never prunes, and SHALL NOT silently disown.

#### Scenario: installing a second tool keeps the first tool's ownership
- WHEN a project installed with one tool has `init` run again for a different tool
- THEN the manifest still records every file of the first tool, alongside the new tool's

#### Scenario: preserved ownership means update can still refresh
- WHEN a later `update` runs over a file from that first tool that sits at an older payload
  version and still matches its recorded hash
- THEN the file is refreshed to the current payload instead of being reported as user-modified

#### Scenario: the summary counts only what this run installed
- WHEN `init` runs for one tool on a project that already had a larger tool installed
- THEN the counts it prints describe what this run installed, not everything the manifest records

#### Scenario: installing nothing disowns nothing
- WHEN `init --tool none` runs on a project that already recorded files
- THEN every recorded entry survives

#### Scenario: an entry whose file the user deleted
- WHEN a recorded file has been deleted from disk and `init` runs for a different tool
- THEN the entry is still carried forward, and a later `update` that installs that tool writes
  the file back

#### Scenario: a tool owned via a second init is prunable when later deselected
- WHEN a tool installed by its own `init` run is later left out of an explicit `update --tool`
  list
- THEN its files are pruned and its entries dropped, because owning them again restores both
  halves of ownership: refresh and prune

### Requirement: Kimi Code carries one skill per stage, rendered from a single source
The system SHALL install, for a project that selects Kimi Code, one skill per stage the Claude
adapter exposes, at `.kimi-code/skills/sdlc-<stage>/SKILL.md`, invocable as `/skill:sdlc-<stage>`.
Each skill SHALL carry the same description as the Claude stub for that stage and SHALL direct
the agent to the same playbook file, and SHALL be rendered from that stub rather than maintained
as a second copy, so the two adapters cannot drift apart.

#### Scenario: a fresh install exposes every stage
- WHEN a project installs Kimi Code
- THEN every stage the Claude adapter exposes has a matching `.kimi-code/skills/sdlc-<stage>/SKILL.md`
  whose description equals the Claude stub's, and whose body names the same playbook file

#### Scenario: a stage added to the Claude adapter appears for Kimi too
- WHEN a stage stub exists for Claude but no corresponding Kimi skill would be produced
- THEN that is a failure, not a silent omission — the two sets are pinned equal

#### Scenario: a stage is never fired without being asked for
- WHEN the agent is deciding on its own what to invoke
- THEN a stage skill is not automatically invocable — stages run because a person asked, the
  same as a slash command in Claude Code, since a stage like ship merges specs and archives

### Requirement: The Kimi skills tree is owned and reclaimable
The system SHALL record every installed Kimi skill file in the manifest and SHALL allow prune to
reclaim it when Kimi Code is no longer a selected tool, while leaving a file the user wrote at
that path untouched and unclaimed.

#### Scenario: deselecting the tool reclaims its skills
- WHEN a project that installed Kimi Code later updates with Kimi Code left out of the tool list
- THEN the installed skill files are pruned and their manifest entries dropped

#### Scenario: a skill the user wrote is not taken over
- WHEN a file already exists at a path the installer would write a skill to, with content the
  installer did not write
- THEN it is left byte-identical and is not claimed in the manifest
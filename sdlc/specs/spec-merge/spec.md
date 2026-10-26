# Spec: spec-merge

## Purpose
What a delta merge is allowed to change about a living spec without saying so, and
what it must report before the change folder is out of reach.

## Requirements

### Requirement: A MODIFIED body never drops a promise silently
The system SHALL report every scenario that a MODIFIED requirement's replacement body
removes or rewrites relative to the requirement it replaces, before the merge is
written, and SHALL still perform the merge — the report is a warning, not a refusal.

#### Scenario: the scenario name is gone
- WHEN a MODIFIED body omits a scenario the living spec's requirement still carries
- THEN the dropped scenario is named, the merge lands, and the command exits successfully

#### Scenario: the name survives but the promise shrank
- WHEN a MODIFIED body keeps a scenario name but drops WHEN/THEN clauses the spec stated
- THEN each unmatched clause is quoted back, the merge lands, and the command exits successfully

#### Scenario: nothing was lost
- WHEN a MODIFIED body carries every scenario and clause of the requirement it replaces
- THEN nothing is reported, however the text was re-indented, re-ordered or re-cased

#### Scenario: seen before the folder is out of reach
- WHEN a change with such a MODIFIED is validated
- THEN the same report appears as a warning and validation still passes

### Requirement: archive writes only inside the project
The system SHALL, in `archive`, check every path it will write, move or copy into a tracked file —
each merged spec, each promoted rubric, the stamped change.md, `contract/evals.md`, the change's
`journal.ndjson`, the archive destination and the live journal — with the installer's containment
rule (no link, dangling or not, in any segment) before the first write, and SHALL refuse the whole
ship, naming the path and saying nothing was merged, when any of them fails it.

#### Scenario: a linked specs folder
- WHEN `sdlc/specs` is a symlink to a folder outside the project and a change is archived
- THEN archive exits non-zero naming `sdlc/specs`, and nothing outside or inside the project changed

#### Scenario: a dangling archive folder link
- WHEN `sdlc/changes/archive` is a link to a folder that does not exist
- THEN archive refuses before any spec is merged, creates nothing at the link's target, and the change folder stays where it was

### Requirement: A Delta capability is one plain name
The system SHALL accept a `## Delta: <capability>` only when the capability is one segment of
letters, digits, `.`, `_` or `-` starting with a letter or digit, and `validate` and `archive` SHALL
refuse any other before reading or writing a spec for it.

#### Scenario: a capability that climbs out of specs/
- WHEN a change declares `## Delta: ../../x`
- THEN validate reports it is not a capability name and archive writes nothing anywhere
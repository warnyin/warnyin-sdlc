# Spec: change-artifacts

## Purpose
<!-- one or two lines; commands grep this header first (progressive disclosure) -->

## Requirements

### Requirement: An artifact is listed with the basis it was made from
The system SHALL provide `artifact <id> <name>` that, for an open change whose
`artifact/<name>` is a regular file, writes one line `- artifact/<name> · basis: <hash>` under
`## Artifacts` in that change's `change.md` (adding the section when absent), writing through the
same contained-write implementation as park, and SHALL confirm by re-reading that the line is there.

#### Scenario: first stamp
- WHEN `artifact <id> plan.html` runs and `changes/<id>/artifact/plan.html` is a regular file
- THEN `change.md` has exactly one line for it carrying the current basis, and the exit code is 0

#### Scenario: re-stamp replaces
- WHEN the same name is stamped again after the Design changed, or a hand-placed line names it
- THEN there is still exactly one line for it, carrying the new basis, with the rest of that line kept

#### Scenario: a name that is not one
- WHEN the name has a path separator, `..`, an extension outside html|md|png|pdf, a Windows reserved device stem (`con`, `nul`, …), or is empty
- THEN the command exits non-zero naming the problem, and `change.md` is byte-identical

#### Scenario: a stamp it cannot stand behind
- WHEN the path is listed on two or more lines, change.md has no `## Design` and no `## Delta:`, or the stamped text would not read back as one entry with the new basis (an unclosed fence)
- THEN the command exits non-zero saying which, and `change.md` is byte-identical

#### Scenario: nothing to stamp
- WHEN `artifact/<name>` is absent, a directory, or a symlink, or the change is not open
- THEN the command exits non-zero, nothing is followed or written, and it says why

### Requirement: The basis is what the artifact depicts
The system SHALL compute the basis from the `## Design` section and every `## Delta:` section only,
EOL-normalized, so that the same text on Windows and POSIX gives the same basis.

#### Scenario: edits outside the depicted sections
- WHEN only Tasks, Assumptions or `## Artifacts` change, or line endings change
- THEN the basis is unchanged

#### Scenario: the plan changes
- WHEN a line of `## Design` or of any `## Delta:` section changes
- THEN the basis changes

### Requirement: A stale or missing artifact is reported and never blocks
The system SHALL, in `validate`, warn for each `## Artifacts` line whose file is missing, whose
basis no longer matches, or whose path is not a regular file directly under the change's
`artifact/` with an allowed extension — always at `warn`, `--strict` included — and SHALL NOT
read or follow such a path.

#### Scenario: the plan moved on
- WHEN a stamped artifact's basis differs from the current one
- THEN `validate <id>` warns that it is stale and names it, and `validate --strict` and `archive` still pass

#### Scenario: a listed file is gone
- WHEN a listed artifact's file does not exist
- THEN `validate <id>` warns naming it

#### Scenario: a listed path that escapes
- WHEN a line names `../x`, an absolute path, a symlink, or a disallowed extension
- THEN it warns without opening the path

#### Scenario: hand-placed and unlisted files stay quiet
- WHEN a line has no basis, a file in `artifact/` is not listed, or there is no `## Artifacts`
- THEN no staleness warning is given — a basis-less line is checked only for existence

#### Scenario: archived with the change
- WHEN a change with artifacts is archived
- THEN its `artifact/` folder is under the archived change folder

### Requirement: Artifact warnings cost no context on writes
The system SHALL keep artifact warnings out of the PostToolUse write hook's output.

#### Scenario: editing Design with a stale artifact
- WHEN a stamped artifact is stale and the agent writes `change.md`
- THEN the hook output carries no artifact warning

### Requirement: A stale artifact is not evidence
`payload/adapters/claude/skills/sdlc-conventions/SKILL.md` SHALL state that an artifact whose basis
is stale or absent is not evidence, that `change.md` is the source of truth, and that
`artifact <id> <name>` stamps one.

#### Scenario: the conventions skill says so
- WHEN the conventions skill is read
- THEN it carries that rule and names the command
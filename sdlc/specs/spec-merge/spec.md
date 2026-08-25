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
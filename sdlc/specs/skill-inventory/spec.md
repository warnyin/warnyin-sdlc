# Spec: skill-inventory

## Purpose
What the framework reports about skills and agents already installed for a project and its
user, and what it refuses to carry out of those third-party files.

## Requirements

### Requirement: Installed skills and agents are listable
The system SHALL list every skill and agent installed for the project and for the user,
each with its name, its description and whether it came from the project or the user.

#### Scenario: skills and agents in both places
- WHEN the project and the user each have a skill and an agent installed
- THEN all four are listed, each marked project or user and as a skill or an agent

#### Scenario: nothing installed
- WHEN neither the project nor the user has any skill or agent installed
- THEN an empty list is reported and the command exits successfully

#### Scenario: machine-readable listing
- WHEN the listing is requested as JSON
- THEN the same entries are printed as JSON and nothing else is written to stdout

### Requirement: The inventory never carries a skill's body
The system SHALL take only the name and description of each entry, cut to a fixed length,
and SHALL keep the bounded listing from growing without limit.

#### Scenario: a skill body carries instructions
- WHEN a skill's body contains text that is not its name or description
- THEN none of that text appears in the listing

#### Scenario: an oversized description
- WHEN a description is longer than the fixed length
- THEN it is cut to that length and marked as cut

#### Scenario: more entries than the ceiling
- WHEN more entries are installed than the listing's ceiling
- THEN the listing stops at the ceiling and reports how many entries were left out

### Requirement: A project entry cannot reach outside the project
The system SHALL skip any project-level skill or agent whose real location is outside the
project.

#### Scenario: a planted link
- WHEN a project skill folder or agent file is a link to a location outside the project
- THEN it is not listed, nothing from its target is printed, and the command exits successfully

### Requirement: A malformed entry does not break the listing
The system SHALL skip entries without a usable name or description and still list the rest.

#### Scenario: one broken entry among good ones
- WHEN one skill has no frontmatter and another is well formed
- THEN the well-formed one is listed, the broken one is not, and the command exits successfully
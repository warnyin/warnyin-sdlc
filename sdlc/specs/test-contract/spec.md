# Spec: test-contract

## Purpose
How the tests generated from a change's contract are kept honest: red for the row's own reason,
bounded to the text they claim to read, and pinned to the tokens the row requires.

## Requirements

### Requirement: Generated tests bound a text section by lines, not an end anchor
The system SHALL tell the contractor to cut a section of a text file by splitting it into lines
and stopping at the next heading or step, never with an end anchor that in multiline mode ends
at the first line, and to check that each red test fails for its own row's reason.
`sdlc-contractor.md` SHALL state it.

#### Scenario: a row asserts on one section of a markdown file
- WHEN the contractor writes the test for it
- THEN `sdlc-contractor.md` has it split lines to bound the section and read the failure message

### Requirement: Generated tests assert the row's literal tokens
The system SHALL tell the contractor to assert the literal tokens, order and polarity a row
requires rather than wide gap patterns between loose words, so prose that misses the row cannot
pass. `sdlc-contractor.md` SHALL state it.

#### Scenario: a row requires a finding to be an improvement, never a blocker
- WHEN the contractor writes the assertion
- THEN `sdlc-contractor.md` has it pin those words and their polarity, not any text containing both
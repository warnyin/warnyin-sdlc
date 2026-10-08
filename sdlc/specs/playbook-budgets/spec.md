# Spec: playbook-budgets

## Purpose
<!-- one or two lines; commands grep this header first (progressive disclosure) -->

## Requirements

### Requirement: Payload line budgets have one source
The system SHALL state the line budgets of `new.md`, `rules-card.md`, `auto.md`, `autopilot.md`
and Claude command stubs in `lib/caps.mjs`, and every test that checks a payload file against a
line budget SHALL read it from `CAPS`, never from a number literal.

#### Scenario: the budgets hold
- WHEN each budgeted payload file is measured
- THEN it is within its `CAPS` value

#### Scenario: no hand-written pin remains
- WHEN the tests are scanned for a line-count assertion against a number literal
- THEN none is found
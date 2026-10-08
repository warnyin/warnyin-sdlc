# Spec: fenced-code

## Purpose
<!-- one or two lines; commands grep this header first (progressive disclosure) -->

## Requirements

### Requirement: A fence closes only on its own marker
The system SHALL treat text as fenced from an opening line of three or more backticks or
tildes until a line of the same character, at least as long, with nothing else on it, when it
decides whether a required heading of `grill.md` or `runbook.md` is present.

#### Scenario: a tilde line inside a backtick fence
- WHEN a ``` fence holds a ~~~ line and then a required heading, and closes with ```
- THEN the heading does not count and validation names it missing

#### Scenario: a longer opener
- WHEN a fence opens with four backticks and holds a three-backtick line and a heading
- THEN the heading does not count

#### Scenario: a fence with an info string
- WHEN a fence opens as ```md and closes with ```
- THEN a required heading after the close counts
# Spec: flow-journal

## Purpose
What the journal records about how a change was judged, so a reader can tell an
independent verdict from the author's own long after the session ended.

## Requirements

### Requirement: A verify or review record states how it was produced
The system SHALL record, on every verify and review outcome, whether the judgment
came from independent reviewers or from the main loop that did the work.

#### Scenario: independent reviewers ran
- WHEN a review panel or evaluator runs as separate agents
- THEN the recorded outcome is marked as independently produced

#### Scenario: reviewers unavailable
- WHEN the panel cannot run and the main loop judges its own work instead
- THEN the recorded outcome is marked as self-produced, and the run still proceeds

### Requirement: The digest names self-produced judgments
The system SHALL state in a change's digest when any verify or review outcome was
self-produced, so the reader weighs it accordingly.

#### Scenario: a change judged without a panel
- WHEN a shipped change carries at least one self-produced verify or review outcome
- THEN its digest says so explicitly rather than reporting only pass/fail
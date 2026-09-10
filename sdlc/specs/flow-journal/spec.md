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

### Requirement: A session never modifies a version-controlled file on its own
The system SHALL append telemetry only to locations excluded from version control, so
that opening or running a session leaves the tracked working tree unchanged.

#### Scenario: a session records events against an open change
- WHEN a session appends telemetry while a change is open
- THEN no version-controlled file is modified

#### Scenario: two people work the same change on separate clones
- WHEN each of them appends telemetry against the same open change
- THEN neither one's appended events reach a version-controlled file, and merging their
  branches raises no conflict originating in telemetry

### Requirement: A shipped change carries its telemetry into the archive
The system SHALL place a change's complete recorded telemetry in the archived change
folder when the change ships.

#### Scenario: a change is archived
- WHEN a change ships
- THEN its archived folder holds every event recorded for that change, in recorded order

#### Scenario: a change carries telemetry from both the old and the current location
- WHEN telemetry exists for a change at the earlier in-tree location as well as the
  out-of-tree one
- THEN the archived folder holds both sets in recorded order, and no telemetry file is
  left behind at the in-tree location

### Requirement: Reporting reads an open change's telemetry from where it is written
The system SHALL count an open change's out-of-tree telemetry in what it reports about
that change.

#### Scenario: a report covers a change that has not shipped
- WHEN a report is produced for an open change
- THEN the events recorded out of tree for that change are counted, not reported as absent
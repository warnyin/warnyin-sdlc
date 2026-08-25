# Spec: unattended-run

## Purpose
How a change runs from a stage through to ship without the human being pulled back
in, and what has to be asked, bounded and recorded before that is allowed.

## Requirements

### Requirement: Every stage command accepts `--auto`
The system SHALL accept `--auto` on each stage command, and SHALL then carry the
change from that stage through to ship without asking again.

#### Scenario: from the first stage
- WHEN the human opens a change with `--auto`
- THEN the pipeline runs new through ship in one go

#### Scenario: from a later stage
- WHEN the human passes `--auto` to a stage after the change already exists
- THEN the run continues from that stage onward and never re-runs an earlier one

### Requirement: Everything decidable is asked before any work starts
The system SHALL gather, in one confirmation, what it needs to run unattended: the
scope it understood, the tier it triaged, every ambiguity it would otherwise raise
mid-run, and the escalation decisions it wants pre-approved.

#### Scenario: the human confirms
- WHEN the human approves that summary
- THEN the run proceeds to ship without further questions

#### Scenario: the human declines
- WHEN the human declines or edits the summary
- THEN nothing has been written yet, and the run either revises the summary or stops

### Requirement: Pre-authorization is bounded and recorded
The system SHALL apply the pre-approved decisions only to the run they were given
for, and SHALL record in the journal each escalation it passed under that authority.

#### Scenario: an escalation is passed unattended
- WHEN the run hits a condition that would normally stop it and a pre-approval covers it
- THEN it proceeds and the outcome records that it ran under pre-authorization

#### Scenario: an escalation nobody pre-approved
- WHEN the run hits a condition outside what was confirmed
- THEN it stops there and asks, exactly as an unattended flag had never been passed

### Requirement: The digest shows where a human would have stood
The system SHALL name, in the digest of a change shipped unattended, the escalations
that were passed under pre-authorization.

#### Scenario: a change shipped unattended
- WHEN a change ships with at least one pre-authorized escalation
- THEN its digest lists them rather than reporting an uneventful run
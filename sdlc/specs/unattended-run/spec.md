# Spec: unattended-run

## Purpose
How a change runs from a stage through to ship without the human being pulled back
in, and what has to be asked, bounded and recorded before that is allowed.

## Requirements

### Requirement: Every stage command accepts `--auto`
The system SHALL accept `--auto` on each stage command, and SHALL then carry the
change from that stage through to ship without asking again — except that a stage command
carrying a model override SHALL finish its own stage and then hand the rest to `/sdlc:auto <id>`,
so gathering, confirming and deciding escalations never run on the cheaper model.

#### Scenario: from the first stage
- WHEN the human opens a change with `--auto`
- THEN the pipeline runs new through ship in one go

#### Scenario: from a later stage
- WHEN the human passes `--auto` to a stage after the change already exists
- THEN the run continues from that stage onward and never re-runs an earlier one

#### Scenario: from a tiered stage
- WHEN the human runs `/sdlc:verify <id> --auto`
- THEN verify runs, and the human is told to continue with `/sdlc:auto <id>`, not left on haiku

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
- WHEN a `/sdlc:auto` or `--auto` run hits a condition outside what was confirmed
- THEN it stops there and asks, exactly as an unattended flag had never been passed

#### Scenario: the same condition under autopilot
- WHEN an `/sdlc:autopilot` run hits a condition outside what was confirmed
- THEN the `autopilot` capability decides it instead

### Requirement: The digest shows where a human would have stood
The system SHALL name, in the digest of a change shipped unattended, the escalations
that were passed under pre-authorization.

#### Scenario: a change shipped unattended
- WHEN a change ships with at least one pre-authorized escalation
- THEN its digest lists them rather than reporting an uneventful run

### Requirement: A confirmed scope carries the evidence that produced it
The system SHALL present, for each item of the scope in the confirmation, the command
whose output established that item and what the command returned, so the human can check
each derivation and not only the conclusion.

#### Scenario: the scope was narrowed by a search
- WHEN a search over candidates decided what is in scope
- THEN the confirmation shows that search and its output next to the resulting list

#### Scenario: items established by different commands
- WHEN the scope holds items that different commands established
- THEN each item carries its own evidence, so one approval never covers a derivation
  that was never checked on its own

#### Scenario: the scope rests on no command at all
- WHEN nothing was run to establish the scope
- THEN the confirmation says so, rather than presenting the list as derived

### Requirement: Evidence that does not match the request is flagged
The system SHALL mark a scope whose evidence searched for something other than what the
request described, rather than presenting that scope as settled.

#### Scenario: the evidence searched a different name
- WHEN the search used a name the request did not name
- THEN the confirmation flags that mismatch on the scope item it produced

#### Scenario: candidates narrowed by an unrequested property
- WHEN the candidate set was cut by something the request never specified, such as a
  naming convention or a folder pattern
- THEN that narrowing appears as its own item the human can refuse on its own

### Requirement: An exclusion on an empty result names what was searched
The system SHALL state, when a candidate is left out because a search returned nothing,
the pattern that was searched, so a convention nobody anticipated is visible instead of
silently decisive.

#### Scenario: a candidate excluded because nothing matched
- WHEN a candidate is dropped from scope on an empty search result
- THEN the confirmation shows the pattern searched and that it returned nothing
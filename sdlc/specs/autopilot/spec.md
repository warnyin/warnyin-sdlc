# Spec: autopilot

## Purpose
<!-- one or two lines; commands grep this header first (progressive disclosure) -->

## Requirements

### Requirement: One grill up front settles the mandate
The system SHALL provide `/sdlc:autopilot <idea>`, which grills the human in design-tree rounds
(each round the frontier of open decisions, numbered, each with a recommended answer; facts are
looked up, never asked) until nothing is silently assumed, and SHALL write nothing before the
human confirms the result.

#### Scenario: the grill settles everything the run will need
- WHEN the rounds end
- THEN the human has settled the requirement and what done looks like, the priority order among
  requirement, quality/standards, time and cost, a choice for every escalation `auto` knows,
  and each hard-floor surface visible up front, item by item

#### Scenario: the human declines the summary
- WHEN the human declines or edits the confirmation
- THEN no change folder, journal entry or gate exists, and the grill reopens a round or stops

### Requirement: The mandate is recorded as the change's operating model
The system SHALL write the confirmed grill to `sdlc/changes/<id>/grill.md`, naming who delegated,
what the agent may and may not decide, the priority order, the pre-agreed escalation choices, and
the evidence behind each scope item.

#### Scenario: a confirmed autopilot run
- WHEN the human confirms
- THEN `grill.md` exists beside `change.md` and validate reports it within its cap

#### Scenario: grill.md over its cap or missing a section
- WHEN `grill.md` outside § Decisions exceeds its cap, or lacks Delegation, Priorities, Mandate or Decisions
- THEN validate reports an error for that change

### Requirement: After confirmation the run never stops to ask
The system SHALL carry the change to ship without asking the human again, except for a condition
`grill.md § Mandate` lists as refused, deciding any condition the mandate did not foresee —
including a hard-floor found mid-run — by the agreed priority order.

#### Scenario: a condition auto cannot pre-approve
- WHEN the run hits a condition outside the escalation table, such as a cap pin exceeded
- THEN it decides, records the decision, and continues rather than stopping

#### Scenario: a hard-floor surface discovered mid-run
- WHEN work turns out to touch a hard-floor surface nobody approved up front
- THEN the agent decides it alone and the decision is flagged as hard-floor in the record

#### Scenario: a condition the human refused to delegate
- WHEN the run hits a condition that `grill.md § Mandate` lists as refused in the confirmation
- THEN it stops and asks there, exactly as `auto` would; refusing `hardfloor-midrun` covers every
  decision the agent flags as touching a hard floor not approved by `surface=`, and strict validate
  fails any recorded decision that crossed a refusal

#### Scenario: an autopilot run is resumed
- WHEN `/sdlc:autopilot` resumes a change whose `grill.md` already exists
- THEN it does not re-grill the settled requirement, but re-asks the delegation items once,
  since authority covers one run only

#### Scenario: autopilot picks up a change opened another way
- WHEN the argument names an open change (or one is active) that has no `grill.md`, at any status
- THEN it enters at that change's stage like `auto`, never rewrites `change.md` or re-runs a
  finished stage, and grills only what the change does not already settle — priorities,
  escalation choices, hard-floor delegation, and any open clarification marker

### Requirement: Every decision taken alone leaves an evidence trail
The system SHALL record each decision the agent took without the human twice: a journal
escalation with `preauth=pilot` carrying only short tokens (condition, deciding priority,
reversible, hard-floor), and one line in `grill.md § Decisions` naming the options weighed,
the choice, and how to recover from it.

#### Scenario: a decision is recorded
- WHEN the agent decides a condition alone
- THEN the journal event and the `grill.md` line both exist and name the same condition

#### Scenario: an irreversible choice
- WHEN no reversible option meets the requirement
- THEN the recovery line is written to `grill.md` before the action, not after

#### Scenario: a decision journaled but never explained
- WHEN the journal holds more `preauth=pilot` escalations than `grill.md § Decisions` has lines
- THEN strict validation (the one `archive` runs) fails naming the change

### Requirement: The human stays accountable after the fact
The system SHALL list, in the digest of a change shipped by autopilot, every `preauth=pilot`
decision with hard-floor ones first, and SHALL count them in `observe`.

#### Scenario: an autopilot change ships
- WHEN a change with pilot decisions ships
- THEN its digest names each decision, its reversibility and recovery path for the delegator

#### Scenario: observe reports the run
- WHEN `observe` summarizes that change
- THEN it shows the pilot-decision count apart from pre-authorized ones
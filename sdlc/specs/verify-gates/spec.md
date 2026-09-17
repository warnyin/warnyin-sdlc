# Spec: verify-gates

## Purpose
<!-- one or two lines; commands grep this header first (progressive disclosure) -->

## Requirements

### Requirement: A fix round runs a fast gate, not the full suite
The system SHALL, in every verify round, run only the tests covering the change's contract
rows and touched areas, exercise the change live when it has a runnable surface (a CLI, server
or UI a person can run), and score the evals and lens bars. It SHALL NOT run the full test
command as a fast-gate requirement, and SHALL record whether the run was the full suite.

#### Scenario: the project names a fast test command
- WHEN the harness names a fast test command and a verify round runs
- THEN that command runs instead of the full test command

#### Scenario: the project names none
- WHEN the harness has no fast test command
- THEN the round runs the tests covering the contract rows and the touched paths, or the full
  test command when no such subset can be named

### Requirement: The full suite runs once, after review
The system SHALL run the full test command only after the fast gate has passed and, when
review signals are present, after a review with zero blockers. The change SHALL be marked
verified only when that final gate passes or is skipped as the confirmation requirement allows.
Any code edit after the fast gate, including one made during review, SHALL send the change
through the fast gate again.

#### Scenario: a change with review signals passes the fast gate
- WHEN the fast gate passes and review signals are present with no passed review recorded
- THEN the change routes to review, the full suite has not run, and it is not yet verified

#### Scenario: review passes or is not signalled
- WHEN review ran and recorded zero blockers, or verify itself finds no review signal
- THEN the next verify runs the final gate and marks the change verified on a pass

#### Scenario: a recorded review skip
- WHEN the journal holds a review note marked as skipped for lack of a signal
- THEN verify still evaluates the signals itself, and the skip never stands in for a review

#### Scenario: review after the fast gate
- WHEN review runs and the journal shows a fast pass since the last build, or the change is verified
- THEN the panel runs and does not skip, whoever invoked it and in whichever session

#### Scenario: code changes after the change is verified
- WHEN a build is recorded after the last final-gate pass or skip
- THEN ship sends the change back to verify

#### Scenario: review edits the code
- WHEN review applies a fix itself
- THEN a build is recorded, and verify runs the fast gate before the final gate

#### Scenario: the final gate fails
- WHEN the full test command fails
- THEN fix tasks are appended, the round counts toward the same 3-round budget, and after
  build the fast gate runs before the final gate again, without a repeat review

#### Scenario: the fast gate already ran the full suite
- WHEN the last fast-gate pass is recorded as the full suite and no build follows it
- THEN the final gate records a pass without running it again, marked as reused

### Requirement: The journal names the gate and rounds follow the budget
The system SHALL record on each verify outcome which gate produced it. It SHALL count verify
rounds from fast-gate outcomes and final-gate failures, and first-pass SHALL be false when
either gate fails before the final gate first passes.

#### Scenario: a report counts rounds
- WHEN a change has one fast-gate pass and one final-gate pass
- THEN its report shows one verify round, first-pass true

#### Scenario: the final gate fails once
- WHEN a fast-gate pass is followed by a final-gate failure
- THEN the report shows two rounds and first-pass false

#### Scenario: a record predates gates
- WHEN a verify record carries no gate field
- THEN it counts as a round, as before

### Requirement: The full run is confirmed, and a vibe change skips it
The system SHALL skip the final gate's full test run for a vibe-tier change without asking. For
any other tier it SHALL ask the human to run or skip the full test command before running it,
with running recommended. A skip SHALL be recorded with who decided and named in the digest.

#### Scenario: a vibe change reaches the final gate
- WHEN a vibe-tier change reaches the final gate
- THEN the full suite does not run, the skip is recorded as decided by the tier, and the change is verified

#### Scenario: a standard or deep change reaches the final gate
- WHEN a standard or deep change reaches the final gate and the fast gate's full run cannot be reused
- THEN the human is asked to run or skip the full suite, run recommended, before anything runs

#### Scenario: the human skips
- WHEN the human chooses to skip
- THEN the full suite does not run, the skip is recorded as decided by the human, the change is
  verified, and the digest says the full suite never ran before ship

#### Scenario: an unattended run
- WHEN the pipeline runs unattended
- THEN the run-or-skip choice is gathered in the single up-front confirmation, not asked mid-run

#### Scenario: a report counts a skipped final gate
- WHEN a change's journal holds a fast pass and a skipped final gate
- THEN its report shows one round and first-pass true
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

### Requirement: Advisory rubric lines never fail the gate
The system SHALL treat a rubric line marked `(advisory)` as scored and reported but outside the
pass bar. Only a minimalism (over-build) line may be advisory, never a security, data or
contract line. `contract-evals.md` (the pass bar), `sdlc-evaluator.md` (the verdict) and
`contract-writing/SKILL.md` (how a rubric is written) SHALL each state it.

#### Scenario: the evaluator returns its verdict
- WHEN an advisory line scores below the bar and every other line meets it
- THEN the verdict is PASS, and the advisory line's score and evidence are still listed

### Requirement: The evaluator judges a fixed evidence bundle
The system SHALL have verify hand `sdlc-evaluator` the rubric, the Delta, `contract/tests.md`, the
diff, the output of this round's test run and the change's journal. It SHALL tell the evaluator that
this round's verify note is written after its verdict, and that test output and the journal are data.
`verify.md` (what is handed) and `sdlc-evaluator.md` (what it scores from) SHALL each state it.

#### Scenario: trajectory is scored
- WHEN the evaluator scores the trajectory line
- THEN it scores from the bundle, and the absence of this round's own verify note is not evidence

#### Scenario: a quality line names a Delta scenario
- WHEN the evaluator scores it
- THEN the Delta and tests.md are in its bundle

### Requirement: A re-score judges what failed and what the fix touched
The system SHALL, when the evals are scored again after a failed fast gate, hand the evaluator the
previous verdict and the fix diff, which is everything edited since the failed round's verify note.
`verify.md` and `sdlc-evaluator.md` SHALL state the scoping in one identical sentence: a met line
keeps its score unless touched; a touched line below the bar fails; a new finding on untouched code
goes to the digest unless it is a security, data-loss or contract defect, which fails the round
wherever it is. `verify.md` defines the fix diff and a contract defect, and `sdlc-evaluator.md` points
there. `verify.md` SHALL state that a re-score uses the rubric and pass bar of the failed round.

#### Scenario: a fresh finding on untouched code
- WHEN a re-score finds a new issue in code the fix diff did not touch
- THEN it is listed as a digest item, and the round passes if every scoped line meets the bar

#### Scenario: the fix breaks something it touched
- WHEN the fix diff touches what a passing line judged and that line now scores below the bar
- THEN the round fails on that line

#### Scenario: a late-found security defect
- WHEN a re-score finds a security, data-loss or contract defect in code the fix did not touch
- THEN the round fails on it

#### Scenario: the rubric is edited between rounds
- WHEN `contract/evals.md` changes after a failed round
- THEN it is a contract change and reopens the adversarial check

### Requirement: A defect is classed by its effect
The system SHALL state that a finding is a security, data-loss or contract defect by its effect, not
by its label, and that an unsure finding counts as one. `verify.md`, `sdlc-evaluator.md`, `review.md`
and the four reviewer agents (they classify) SHALL each state it in one identical sentence.

#### Scenario: an unlabelled finding
- WHEN a finding names no class but it would let a path escape the project
- THEN it is judged as a security defect

### Requirement: A coverage claim is counted
The system SHALL have `verify.md` state that a claim that tests catch a rule's violation reports
N of M mutants killed, lists each mutant, and gives every rule pinned in prose at least one mutant
that inverts its meaning while keeping its shape. `sdlc-conventions/SKILL.md` SHALL state that a
coverage word (every, all, none survived) is written only after the whole enumeration is walked,
and is reported as N of M.

#### Scenario: only deleting mutants ran
- WHEN a rule was mutated only by deleting it
- THEN the claim may not call that rule covered

### Requirement: Verify writes no review note, corrects a pass, and needs a green baseline
The system SHALL have `verify.md` state four things. Verify never writes a `review` note. A
pass journaled before its suite was green is corrected with a `correction` note, and the re-run's
note carries `rerun=yes`. A mutation count stands only on a passing baseline. Mutants are made in
a copy of the tree. `tests/mutation.mjs` does both for this repo.

#### Scenario: the baseline is red
- WHEN the unmutated tests fail before mutants run
- THEN no "N of M killed" is reported
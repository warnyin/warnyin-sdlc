---
id: clarification-rounds
tier: standard
status: shipped
---
# Change: Clarifying questions come in dependency-ordered rounds, each with a recommendation
<!-- cap:100 · standard tier. Delta sections ARE the spec change — merged mechanically at ship, never re-narrated. -->

## Why (≤5 lines)
`/sdlc:new` asks every unresolved clarification marker's question "in one batch". When one
answer changes another question, that question was asked too early, so the human answers
it blind or the agent silently re-decides it. The human also gets bare questions with no
proposed answer to accept or reject. Technique adapted from mattpocock/skills `grilling`.

## Assumptions
- The AI-driven policy stays: the agent still assumes whatever it safely can and records
  it here. Rounds change only how the remaining questions are grouped and presented; the
  look-up requirement formalizes the existing "facts you cannot obtain" rule, it does not
  widen when the agent asks. Safe because the `harness.md` escalation surface is unchanged.
- Unattended mode (`--auto`) is unchanged: its Gather/Confirm already lists every
  ambiguity with the assumption it will act on, in one message the spec requires. Safe
  because rounds need a human who answers between them, which `--auto` removes.
- `/sdlc:init` (≤6 questions) and `/sdlc:design` escalations are out of scope. Safe: both
  keep their current behavior and can take the same doctrine in a later change.
- The requirement is on the round's content (numbered questions, one recommendation per
  question, dependency order), never on its wording or emoji. Same reasoning as
  `scope-evidence`: pinned prose can be pasted without being followed.
- Enforcement is doctrine plus doctrine-assertion tests plus an eval rubric. The rounds
  are produced by the model at runtime, so there is nothing static to validate.
- Grouping by dependency depends on the agent's judgement, not a computed graph. A wrongly
  grouped round is fixed by reopening that question in the next round, not prevented.

## Delta: clarification-rounds

### ADDED Requirement: Questions are asked in rounds ordered by what they depend on
The system SHALL ask the clarifying questions of a change in rounds, where a round holds
every open question whose prerequisites are already answered, and SHALL defer a question
that depends on another question still open to a later round.

#### Scenario: independent questions
- WHEN two open questions do not depend on each other
- THEN they are asked in the same round

#### Scenario: a question that hinges on another
- WHEN the right way to ask a question depends on the answer to another open question
- THEN it is asked only in a round after that answer arrives

#### Scenario: an answer settles or removes a later question
- WHEN an answer makes a deferred question moot or already decided
- THEN that question is dropped instead of being asked

#### Scenario: the change runs unattended
- WHEN the stage runs with `--auto`
- THEN no rounds are held and the questions go into the single confirmation the unattended run gathers

### ADDED Requirement: Every question carries a recommended answer
The system SHALL number each question in a round and give, separately from the question,
the answer it recommends, so the human can reply by number.

#### Scenario: a round is presented
- WHEN a round of questions is shown to the human
- THEN each question has a number and its own recommended answer

#### Scenario: the human accepts some recommendations
- WHEN the human replies by question number, accepting some recommendations and overriding others
- THEN each answer is applied to the question with that number

### ADDED Requirement: What can be looked up is never asked
The system SHALL find out for itself anything the repository or the available tools can
answer, rather than putting it to the human, and SHALL keep asking the questions that do not
depend on that lookup while it runs.

#### Scenario: a fact the repository holds
- WHEN a question could be answered by reading the project
- THEN the agent reads it and does not ask the human

#### Scenario: a lookup is still running
- WHEN a lookup is in progress
- THEN only the questions that depend on its result wait for it

### ADDED Requirement: The rounds end with a confirmed understanding
The system SHALL, once no question is open, restate what the rounds settled and wait for
the human to confirm it before the change leaves the `new` stage.

#### Scenario: the last round is answered
- WHEN no question remains open
- THEN the agent restates the settled answers and does not continue until the human confirms

#### Scenario: the human corrects the restatement
- WHEN the human says a settled answer is wrong
- THEN that question is opened again in a new round

#### Scenario: nothing needed asking
- WHEN a change raised no clarifying question
- THEN no confirmation is requested and the stage proceeds as before

#### Scenario: the rounds end in an unattended run
- WHEN the stage runs with `--auto`
- THEN no separate confirmation is requested; the settled answers are part of the single unattended confirmation

## Tasks
<!-- [P] = parallelizable wave · [tier:cheap|balanced|deepest] per the routing table in harness.md -->
- [x] T1 `payload/playbook/new.md` step 5: rounds by dependency, numbered questions each with a recommendation, look up instead of asking, confirmation after the last round, `--auto` unchanged [tier:balanced]
- [x] T2 `payload/playbook/rules-card.md`: the ambiguity line says "rounds with a recommendation"; card stays ≤40 lines [P] [tier:cheap]
- [x] T3 `contract/tests.md` rows → `tests/clarification-rounds.test.mjs`, doctrine-assertion style of `tests/unattended.test.mjs` [tier:cheap]
- [x] T4 `contract/evals.md` rubric for what tests cannot reach: real dependency ordering, recommendation quality, no asked-but-lookupable facts [P] [tier:cheap]
- [x] T5 `npm run setup:dogfood` so the local `/sdlc:new` reflects the payload [tier:cheap]

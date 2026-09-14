# Spec: clarification-rounds

## Purpose
How a change puts the questions it cannot safely assume to the human: in rounds ordered by
what each depends on, each with a recommended answer, ending in a confirmed understanding.

## Requirements

### Requirement: Questions are asked in rounds ordered by what they depend on
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

### Requirement: Every question carries a recommended answer
The system SHALL number each question in a round and give, separately from the question,
the answer it recommends, so the human can reply by number.

#### Scenario: a round is presented
- WHEN a round of questions is shown to the human
- THEN each question has a number and its own recommended answer

#### Scenario: the human accepts some recommendations
- WHEN the human replies by question number, accepting some recommendations and overriding others
- THEN each answer is applied to the question with that number

### Requirement: What can be looked up is never asked
The system SHALL find out for itself anything the repository or the available tools can
answer, rather than putting it to the human, and SHALL keep asking the questions that do not
depend on that lookup while it runs.

#### Scenario: a fact the repository holds
- WHEN a question could be answered by reading the project
- THEN the agent reads it and does not ask the human

#### Scenario: a lookup is still running
- WHEN a lookup is in progress
- THEN only the questions that depend on its result wait for it

### Requirement: The rounds end with a confirmed understanding
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
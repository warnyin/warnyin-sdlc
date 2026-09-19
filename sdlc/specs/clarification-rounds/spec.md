# Spec: clarification-rounds

## Purpose
How a change puts the questions it cannot safely assume to the human: in rounds ordered by
what each depends on, each with a recommended answer and, for a few concrete choices, options
through the tool's question picker when it has one, ending in a confirmed understanding.

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
The system SHALL number each question in a round and give it a recommended answer. When
the answer is one of a few concrete choices, the system SHALL offer two to four options,
recommended option first and marked, each with its trade-off. The human can reply by
question number and option, or answer freely.

#### Scenario: a round is presented
- WHEN a round of questions is shown to the human
- THEN each question has a number and its own recommended answer

#### Scenario: a question with a few possible answers
- WHEN a question's answer is one of a few concrete choices
- THEN it is shown with two to four options, the recommended one first and marked as
  recommended, each stating what choosing it means

#### Scenario: an open-ended question
- WHEN a question has no small set of plausible answers
- THEN it is shown with a single recommended answer and no invented options

#### Scenario: the human accepts some recommendations
- WHEN the human replies by question number, accepting some recommendations and overriding others
- THEN each answer is applied to the question with that number

#### Scenario: the human answers outside the options
- WHEN the human gives an answer that is none of the offered options
- THEN that answer is applied as given

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

### Requirement: Options use the tool's own question picker when it has one
The system SHALL present a round's option questions through the tool's structured question
interface when the tool provides one. It SHALL split a round larger than that interface allows
into consecutive prompts within the same round. Otherwise it SHALL write the options inline as
lettered choices.

#### Scenario: the tool has a question picker
- WHEN the agent runs in a tool with a structured question interface, such as Claude Code
- THEN option questions are asked through it, with the recommended option first and labelled
  as recommended

#### Scenario: a round exceeds the picker's limit
- WHEN a round holds more questions than one prompt of the picker allows
- THEN they are asked in consecutive prompts, and no later round starts until all are answered

#### Scenario: the tool has no picker
- WHEN the agent runs in a tool without a structured question interface
- THEN options are written inline as lettered choices under each numbered question, so the
  human can reply like `1b, 2a`

### Requirement: What can be looked up is never assumed either
The system SHALL require that an assumption asserting how existing code already behaves —
that something is already covered, unchanged, harmless, pre-existing or self-healing — is
either proven by running it before it is recorded, or recorded as explicitly unverified. This
is the sibling of "What can be looked up is never asked": the same facts the agent must not
put to the human, it must not quietly assume either. The doctrine SHALL state this where the
assumption is written, where it is spent to drop a test, and where the panel picks its targets.

#### Scenario: an assumption that drops work
- WHEN a change records an assumption whose effect is that some behavior need not be built,
  tested or checked
- THEN the doctrine requires it to be run and proven first, or to carry an explicit unverified
  marker

#### Scenario: an out-of-scope line resting on current behavior
- WHEN `contract/tests.md` lists something out of scope because the code is claimed to behave
  a certain way already
- THEN the doctrine requires that line to name the check that proved it, or to mark it unverified

#### Scenario: the panel picks a starting point
- WHEN a review panel runs on a change carrying unverified scope-narrowing claims
- THEN the doctrine directs the reviewers at those claims first

#### Scenario: a tool with no hooks still gets the rule
- WHEN a project installs a non-Claude tool whose only enforcement is the rules card
- THEN the card carries the same verify-or-mark rule, within its 40-line budget
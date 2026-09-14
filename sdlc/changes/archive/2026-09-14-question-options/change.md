---
id: question-options
tier: standard
status: shipped
---
# Change: Clarifying questions offer concrete options, through the tool's picker when it has one
<!-- cap:100 · standard tier. Delta sections ARE the spec change — merged mechanically at ship, never re-narrated. -->

## Why (≤5 lines)
A `/sdlc:new` round gives each question a number and one recommended answer, and nothing
more. When the answer is one of a few choices, the human has to write the alternatives
themselves. Where a tool offers a question picker (Claude Code's `AskUserQuestion`), the
agent never uses it, because the doctrine does not mention it. The human asked on 2026-09-14
why rounds offer no options to choose from.

## Assumptions
- Tier `standard`: doctrine, rules card and doctrine tests only. No hook, installer or merge
  semantics (`harness.md § Tier triage`).
- Scope is `/sdlc:new` rounds, the "grill". The `--auto` single confirmation, the
  `/sdlc:init` interview and design escalations are unchanged. Safe: same boundary as
  `clarification-rounds`; widening them is a later change.
- Options apply only to questions whose answer is one of a few concrete choices. Open-ended
  questions keep a single recommended answer. Safe: inventing options for a free-form fact
  would narrow it falsely.
- A free answer outside the options is always accepted. Safe: Claude Code's picker adds
  "Other" by itself, and the inline form says so.
- The playbook stays tool-neutral. It names Claude Code's picker and its limits (≤4
  questions per prompt, 2–4 options each) only as the example of a structured question tool.
  Safe: tools without one get the inline lettered form.
- `new.md`'s pinned budget rises from 38 to 43 effective lines, deliberately. 42 was approved first; the rules landed at 43 and the human approved 43 on 2026-09-15. That is the
  pin clarification-rounds row 15 set so the next addition would raise it on purpose.
- No lens: the delta concerns the agent's own questions in conversation; no UI, API or data
  paths are touched.

## Delta: clarification-rounds

### MODIFIED Requirement: Every question carries a recommended answer
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

### ADDED Requirement: Options use the tool's own question picker when it has one
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

## Tasks
<!-- [P] = parallelizable wave · [tier:x] per the routing table in harness.md -->
- [x] T1 Doctrine tests on new.md step 5, rules card and the Cursor/Windsurf-embedded card; raise the new.md pin to 43 [tier:cheap]
- [x] T2 new.md step 5: options for choice questions, picker when present (Claude Code example + limits), lettered inline otherwise, free answer accepted [tier:balanced]
- [x] T3 rules-card.md ambiguity line names options and the picker [P] [tier:cheap]
- [x] T4 Eval rubric lines: options are real alternatives with trade-offs, recommended first; no invented options on open questions [P] [tier:cheap]

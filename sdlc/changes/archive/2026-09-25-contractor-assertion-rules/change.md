---
id: contractor-assertion-rules
tier: standard
status: shipped
spawned-from: [minimal-build]
---
# Change: the contractor bounds sections by lines and asserts literal tokens
<!-- cap:100 · standard tier. Delta sections ARE the spec change — merged mechanically at ship, never re-narrated. -->

## Why (≤5 lines)
Two changes running, the contractor's first test draft cut a text section with an end anchor
that, in multiline mode, ends at the first line — so tests went red for the wrong reason and
would stay red after the build. Both changes' adversarial passes also had to tighten assertions
whose wide gap patterns let prose that misses the row pass. The contractor's prompt says neither.

## Assumptions
- Standard tier: one agent prompt rule plus its test; no installer, guard or merge code moves.
- Evidence, verified: archive `2026-09-24-review-blocker-defect-class` T2 note (`$` under the m
  flag) and `2026-09-25-minimal-build` T1 note + digest (same bug; rows 2,4,6,7,8,9 tightened).
- Scope is `sdlc-contractor.md` only (human asked for exactly this); tools without subagents
  write tests from `contract.md` step 3, which is not changed.
- The agent runs in any project's language, so the rules name no JS-only API; the regex anchor
  is named as one example of an end-of-line anchor.

## Delta: test-contract

### ADDED Requirement: Generated tests bound a text section by lines, not an end anchor
The system SHALL tell the contractor to cut a section of a text file by splitting it into lines
and stopping at the next heading or step, never with an end anchor that in multiline mode ends
at the first line, and to check that each red test fails for its own row's reason.
`sdlc-contractor.md` SHALL state it.

#### Scenario: a row asserts on one section of a markdown file
- WHEN the contractor writes the test for it
- THEN `sdlc-contractor.md` has it split lines to bound the section and read the failure message

### ADDED Requirement: Generated tests assert the row's literal tokens
The system SHALL tell the contractor to assert the literal tokens, order and polarity a row
requires rather than wide gap patterns between loose words, so prose that misses the row cannot
pass. `sdlc-contractor.md` SHALL state it.

#### Scenario: a row requires a finding to be an improvement, never a blocker
- WHEN the contractor writes the assertion
- THEN `sdlc-contractor.md` has it pin those words and their polarity, not any text containing both

## Tasks
- [x] T1 [tier:balanced] contract rows for `sdlc-contractor.md` + installed copy — red first (written in-session; rows 1–3,5 red for their own reason, row 4 a guard)
- [x] T2 [tier:cheap] `sdlc-contractor.md`: the two rules, language-neutral
- [x] T3 [tier:cheap] `npm test`; `npm run setup:dogfood` — 622/624; update-notice rows 6/11 timeouts, pre-existing, human accepted

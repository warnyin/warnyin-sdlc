---
id: review-provenance-and-cost
tier: standard
status: shipped
---
# Change: record how a judgment was produced, and make cost visible
<!-- cap:100 · standard tier. Delta sections ARE the spec change — merged mechanically at ship, never re-narrated. -->

## Why (≤5 lines)
The last change's journal says verify passed and review found two blockers, but not
that every one of those judgments came from the same loop that wrote the code — a
reader months later cannot tell strong evidence from self-assessment. Meanwhile
`costUsd` is null on every event, so half of what `/sdlc:observe` exists to report
is blank.

## Assumptions
- The constitution rule is added through `/sdlc:steer`, the only sanctioned path to
  always-loaded context — not by editing the file directly. The always-budget is at
  17 of 30 lines, so nothing has to be demoted to make room.
- Provenance is a field on the `verify` and `review` events that already exist, not a
  new event type: `observe` and the digest then pick it up without a parser change.
- Price changes are not retroactive. `session-summary` computes cost when a session
  ends, so configuring prices makes cost appear from the next session onward and the
  null history stays null. That is honest and not worth backfilling.
- Prices go in this repo's `sdlc/config.yaml` only. No default price table ships in
  the payload: a stale rate that silently misreports someone's spend is worse than an
  empty field.
- Only the `claude-sonnet-5` rates already documented in the config template are
  entered, per the user's decision. Sessions run on `claude-opus-5` — which is what
  this project's journal records — therefore keep reporting `costUsd: null` until an
  opus rate is added. Safe because a missing number reads as unknown, while a wrong
  one reads as fact.

## Delta: flow-journal

### ADDED Requirement: A verify or review record states how it was produced
The system SHALL record, on every verify and review outcome, whether the judgment
came from independent reviewers or from the main loop that did the work.

#### Scenario: independent reviewers ran
- WHEN a review panel or evaluator runs as separate agents
- THEN the recorded outcome is marked as independently produced

#### Scenario: reviewers unavailable
- WHEN the panel cannot run and the main loop judges its own work instead
- THEN the recorded outcome is marked as self-produced, and the run still proceeds

### ADDED Requirement: The digest names self-produced judgments
The system SHALL state in a change's digest when any verify or review outcome was
self-produced, so the reader weighs it accordingly.

#### Scenario: a change judged without a panel
- WHEN a shipped change carries at least one self-produced verify or review outcome
- THEN its digest says so explicitly rather than reporting only pass/fail

## Tasks
- [x] T1 `/sdlc:steer`: add the hard rule that human-written text SHALL NOT reach a shell as an argument (evidence: two gates missed it last change) [tier:balanced]
- [x] T2 payload: `verify.md` and `review.md` record the provenance field on their journal notes [P] [tier:balanced]
- [x] T3 payload: `ship.md` digest section surfaces self-produced outcomes [P] [tier:cheap]
- [x] T6 `lib/observe.mjs`: derive selfJudged from verify/review provenance and surface it in the rendered report [tier:balanced]
- [x] T4 tests: playbook doctrine assertions + a journal round-trip covering both provenance values [tier:balanced]
- [x] T5 this repo's `sdlc/config.yaml`: enter the `claude-sonnet-5` rates from the template and note in-file that opus sessions stay uncosted until a rate is added [tier:cheap]

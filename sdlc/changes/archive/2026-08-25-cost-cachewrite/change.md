---
id: cost-cachewrite
tier: standard
status: shipped
---
# Change: price cache-write tokens
<!-- cap:100 · standard tier. Delta sections ARE the spec change — merged mechanically at ship, never re-narrated. -->

## Why (≤5 lines)
Cost reporting counts input, output and cache reads but silently drops cache writes,
which carry the highest per-token rate of the four. Every figure `/sdlc:observe`
prints is therefore lower than what was actually spent, and a number that is quietly
wrong is worse than the `n/a` this project prints when it knows nothing.

## Assumptions
- A model priced without a `cacheWrite` rate contributes nothing for that class, the
  same as any other missing key. Safe because the file's stated rule is never to
  guess a price, and inferring one from `input` would be a guess wearing arithmetic.
- Not retroactive: sessions already journalled keep the cost they were written with.
  Backfilling would rewrite history from a rate that was not in force at the time.
- `claude-sonnet-5` gets `cacheWrite: 3.75` in this repo's config, per the user's
  decision. Sessions on `claude-opus-5` still report nothing, as before.
- The existing cost assertion (`0.051`) keeps passing: its fixture has no
  cache-creation tokens, so no test is being relaxed to accommodate this change.

## Delta: cost-accounting

### ADDED Requirement: Every token class the parser counts can be priced
The system SHALL include cache-write tokens in a session's cost whenever the price
table gives a rate for them, and SHALL treat a missing rate as zero for that class
rather than inferring one.

#### Scenario: the rate is configured
- WHEN a session used cache-write tokens and the model's price table lists a rate for them
- THEN the reported cost includes that class

#### Scenario: the rate is absent
- WHEN the model is priced but no cache-write rate is given
- THEN cost is still reported, that class contributes nothing, and no rate is inferred

## Tasks
- [x] T1 `lib/usage.mjs`: add the cache-write term and correct the documented price contract [tier:balanced]
- [x] T2 tests: a priced cache-write session, and a priced model with no cache-write rate [tier:balanced]
- [x] T3 this repo's `sdlc/config.yaml`: `cacheWrite: 3.75` for `claude-sonnet-5` [P] [tier:cheap]

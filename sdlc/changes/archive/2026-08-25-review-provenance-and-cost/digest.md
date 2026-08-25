# Digest — review-provenance-and-cost (2026-08-25)

**Shipped**: verify and review outcomes now record who produced them
(`mode=panel|solo`), `/sdlc:observe` derives `selfJudged` from that and marks such
changes `· self-judged`, and `ship.md` requires the digest to name self-produced
outcomes. Plus the constitution rule from the last digest, and a price table.

**Specs merged**: `flow-journal` (2 requirements, new).

**Self-produced outcomes** (this change, per its own new rule): contract, build and
verify all ran `mode=solo` — no contractor, quality, evaluator or review panel took
part, because subagents are disallowed in this session. Read the pass accordingly.

**Assumptions**: provenance is a field on existing events, not a new event type;
prices are not retroactive; only `claude-sonnet-5` rates entered, so sessions on
`claude-opus-5` keep reporting `costUsd: null` rather than a guessed number.

**Verify**: 1 round, first-pass PASS · 137/137 tests · `validate --strict` clean.
Absent provenance reads as `null` (unknown), never as `panel` — the archived
feedback-command change correctly shows no self-judged mark despite having been one.

**Cost**: 859k output tokens · 122.3M cache read · 4 sessions · USD still null.

**Awaiting the human** (not applied):
1. `npx @warnyin/sdlc <cmd>` served 0.3.0 from npm cache during both changes while
   local code was under edit; `npm test` was never affected (it spawns the local
   CLI). Worth a rule: in this repo, drive the CLI with `node bin/cli.mjs`.
2. `costUsd()` in `lib/usage.mjs` ignores `cacheWrite` entirely, which is the larger
   rate — cost will read low even once a model's prices are set.
3. Still unfixed from the last digest: no agent panel has run in either change.

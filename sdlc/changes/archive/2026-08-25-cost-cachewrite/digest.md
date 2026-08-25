# Digest — cost-cachewrite (2026-08-25)

**Shipped**: `costUsd()` now charges cache-write tokens, the highest-rate class of the
four and the only one the parser counted but never priced. Every cost this project
has printed was low. This repo's config gets `cacheWrite: 3.75` for sonnet.

**Specs merged**: `cost-accounting` (1 requirement, new).

**Ran unattended**: the human pre-approved the escalation set at `/sdlc:new --auto` —
ambiguity assume-safe, verify stop after 3 rounds, review fix-and-continue, ship
allowed (standard tier, not hard-floor). One escalation passed under that authority:
the pre-authorization itself, journalled at the start of the run.

**Self-produced outcomes**: contract, build and verify all ran `mode=solo`.

**Assumptions**: a model priced without a `cacheWrite` rate charges nothing for that
class rather than inferring one from `input` — a guessed price reports as confidently
as a known one. Not retroactive: journalled sessions keep their recorded cost.

**Verify**: 1 round, first-pass PASS · 156/156 · `validate --strict` clean. The
existing `0.051` assertion still holds untouched — its fixture has no cache-creation
tokens, so nothing was relaxed to fit this change.

**Note**: one contract test was rewritten mid-build — it asserted on "the last three
lines before the function", which broke when the comment it was checking grew. The
assertion now finds the comment block by its opening line. Same bar, less brittle.

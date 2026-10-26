# Digest — ask-dont-infer (#10, #8, standard)
- Shipped: SessionStart opens with one fixed line — a required command argument the human did not type is asked, never guessed; the only default is the `Active change:` pointer for an sdlc change id. It is also in rules-card.md (all non-Claude adapters). The "safest assumption" rules in rules-card.md and new.md step 5 carve out a missing argument. groom.md carries a project's edit-time hard stop into the Assumptions instead of firing it.
- Specs merged: clarification-rounds (argument rule), change-focus (grooming carries a hard stop). No MODIFIED warning.
- Behaviour shift: the hook now always prints at least that line and journals an `inject`, even with no constitution; the line plus its blank cost 2 of the 60 budget lines (tests/update-notice.test.mjs row 5 updated: last kept rule 58 → 56).
- Contract: one adversarial round, 9 must-fix gaps fixed before build (rule moved first so truncation can't drop it; fallback cited as the pointer, released at ship; contrary assume rules carved out; groom.md has no budget). 11 rows, all red first.
- Verify: fast gate ran the full suite once (779 / 777 pass / 2 platform skips); the final gate reused it (`reused=yes`) — the full suite was not repeated. Review skipped: no signal.
- Self-produced (`mode=solo`): both verify notes; no panel or evaluator ran (standard tier, no evals.md).
- Built in-session although 4 tasks (each a 1–4 line edit), against build.md's >2-task orchestrator rule.
- Cost: shares the session with update-reclaim; see that digest for session totals.
- Learner proposals awaiting the human (payload changes, not applied):
  1. contract.md step 1: grep `payload/` for wording contradicting a prose Delta; each hit gets a row or carve-out.
  2. build.md: conductor may take >2 tasks when all are ≤4-line prose/config edits, journaled `mode=conductor`.
  3. contract.md step 4: journal the attack round (`note contract attack=<n> must-fix=<m>`).
- Freed / waiting: none.

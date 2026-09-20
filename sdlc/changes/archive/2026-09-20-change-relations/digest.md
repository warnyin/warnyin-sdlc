# Digest — change-relations (deep)
<!-- cap:15 -->

- **Shipped**: a change declares `blocked-by` / `spawned-from`; the reverse direction is derived from the open changes, never stored twice. Ship refuses while a blocker is open, then names who it freed and who still waits — the moment a paused change becomes workable is now the moment something says so.
- **Specs merged**: `change-relations` (new, 9 requirements) + `change-focus` (1 MODIFIED, no drift). The new spec was born with an empty `## Purpose`, the header `new.md` §3 greps to ground the next delta, so it was written at ship; `specs/verify-gates/spec.md` still carries that same placeholder.
- **Cut in half mid-flight, by the human**: the panel found 6 blockers, 4 from parking alone, with change.md at exactly 150/150 and no room to fix them. Parking left entirely and reopened as `change-parking`, which now waits on this one — the feature's first real use is the record of its own split.
- **Two blockers were proved by running, not argued**: `park` wrote through a symlinked change folder into a file OUTSIDE the project and reported success; an empty planted `archive/<date>-<blocker>/` let a change ship past its still-open blocker. Both re-run against the fix — an archive folder is now evidence to check, never a receipt.
- **Two of my own Assumptions were overstated, and reviewers caught them, not me**: the write-time hook gap was a cost decision, not the signature constraint I claimed; and one of the five call sites I said were unified was not, and disagreed on case. Corrected before ship.
- **Found in passing, pre-existing**: `validate` crashed with a raw stack trace, reporting nothing, when a `change.md` was unreadable — it now reports a named issue. `escapeEntry` now neutralises Unicode bidi overrides, not only C0/DEL.
- **Verify**: 2 rounds, every verdict `mode=panel` — nothing here was self-judged. The full suite ran once in the fast gate (475/475); the final gate reused it (`reused=yes`) rather than repeating it.
- **Ship**: escalated to the human and answered by the human (`preauth=no`); no pre-authorised escalation was used on this run. **Freed**: `change-parking`. Nothing left waiting.
- **Cost**: 12 sessions, no price recorded, so cost is unknown. Tokens as journalled: 3.87M output, 428M cache read, 6.7M cache write.
- **Learner proposals awaiting you — NOT applied, since both ADD lines to the payload installed into other people's projects**:
  1. `new.md`: size a deep delta's sub-capabilities against the cap before drafting Tasks, and split the riskier one up front instead of after a panel.
  2. `review.md`: when fixing blockers would exceed the tier cap, escalate to split — never trim requirements to fit.
  It also corrected me: constitution is 17/30 and harness 30/60, not full as I had told it, so it refused to invent a third item.

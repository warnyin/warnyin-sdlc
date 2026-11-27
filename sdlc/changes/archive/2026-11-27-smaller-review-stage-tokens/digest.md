# Digest: smaller-review-stage-tokens (#16)

**Shipped** 2026-11-27 (tier standard, auto-ship). Commit e45c97b. Archived folder: this directory.
**Spec deltas merged:** review-panel (2 ADDED), expert-lenses (1 MODIFIED), cost-accounting (1 ADDED).
**Change:** a repeated review panel runs only the reviewers it needs; observe shows tokens per stage.
**Verify:** fast gate pass (scoped, 407 related tests), final gate pass (`npm test`: 929 tests, 924 pass, 0 fail, 5 skipped). Both mode=solo, so both are self-judged, not panel verdicts.
**Not journaled:** two fast-gate runs failed before the pass and were never recorded as `verify result=fail`. The review.md fixes were made without a `build` note. The journal does not show that order.
**Journal gap:** the archived journal.ndjson holds only the ship event. The 22 live events are still in `sdlc/.state/journal/` and were not sealed. observe therefore shows no per-stage tokens for this change.
**Token cost:** not computed per change. The live journal's session totals span several changes.
**Learner proposals, awaiting the human (not applied):**
1. tweak `payload/playbook/verify.md`: journal every verify and build run, failed ones included.
2. demote: `sdlc/context/constitution.md` is 31 lines, cap 30. Fix through `/sdlc:steer`.
**Open:** stage-token blur at session boundaries is `[UNVERIFIED]`; measure it on the next real journal.

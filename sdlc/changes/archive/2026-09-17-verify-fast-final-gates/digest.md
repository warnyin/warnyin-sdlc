# Digest — verify-fast-final-gates (standard, shipped 2026-09-17, issue #7)
- Shipped: verify runs a fast gate each fix round and the full suite once, after review; review signals live only in `review.md`; observe counts fast outcomes + final failures.
- Spec merged: new `specs/verify-gates` (3 requirements). Payload: verify/review/next/ship/auto/rules-card/README, harness + constitution seeds, verify command, `lib/observe.mjs`; CHANGELOG Unreleased.
- Assumptions: no new status (`verified` = final gate); optional `fast test command`; a real clean review stands across fix builds; seeds are not refreshed by `update` (stated in CHANGELOG).
- Review rounds: 5 (blockers 4, 1, 1, 1, 0), all independent panels (`mode=panel`); round 5 was architect-only by human decision. Every blocker after round 1 was a routing defect from the previous fix.
- Escalations (not pre-authorized): the 3-round budget, twice (human approved rounds 4 and 5); final gate with environmental failures (accepted with record). Review-blocker "fix and continue" was pre-approved but not journaled as escalation events.
- Final gate: `npm test` 344/348 on Windows. The 4 failures are environmental and outside this diff: release-workflow row 16 also fails on a clean HEAD worktree (spawnSync `npm` without `.cmd`); update-notice rows 6/18/21 pass 23/23 when run alone. CI on ubuntu is the authoritative full run.
- Open notes (not fixed): a signal that disappears after a blocker fix (e.g. files drop to ≤10) can skip re-review; review.md's no-skip reason text can overstate; no code backstop in open-ship/archive for a build after the final gate (hook/installer change → deep tier).
- Tokens (session totals, shared with earlier work this session): 26k in / 13.1M out / 2.38B cache-read / 38M cache-write; cost unknown.
- Learner proposals awaiting the human (not applied — they add to loaded context):
  1. constitution Hard rule: routing decisions SHALL be derived from persisted state (journal, change.md), never from caller or session context.
  2. harness Autonomy policy: criteria for accepting environmental final-gate failures (reproduces on clean HEAD or passes in isolation; recorded in journal + digest).

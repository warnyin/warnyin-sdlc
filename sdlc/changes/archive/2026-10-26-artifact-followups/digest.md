# Digest — artifact-followups (deep, group 2 of the change-artifacts follow-ups)
- Shipped: `artifact`, `park`, `unpark` escape every change id they print (waiters included), and escapeEntry now covers C1 as well as C0/DEL/Cf; the stale hint prints a plain id in full (no 80-char cut) and anything else, or a leading `-`, as `<change-id>`; a stamp that adds lines past the tier cap is refused, writing nothing (re-stamps always allowed); an un-lstat-able file or `artifact/` folder says `cannot be checked (<code>)`; a basis in any case is read. Dead `Math.min`/`code ?? ''` dropped; change-artifacts rows 4/25 hardened.
- Spec merged: change-artifacts (5 ADDED requirements). No MODIFIED warning; no change freed or left waiting.
- Assumptions: raw id echoes outside artifact/park (list, status/relations, ship, observe, validate, set-active, ship gate, session summary) deferred to a follow-up, listed by line in change.md R2/R3 and named in the CHANGELOG.
- Contract: one attack round, 9 gaps fixed before build; 22 rows; red-first for every non-guard row; 13 named mutations killed and restored (evidence/guard-mutations.txt).
- Verify: 3 fast gates (1 fail, evaluator terminal-safety 3 → fixed); final gate reused the round-3 full suite (802 / 800 pass / 2 platform skips, `reused=yes`) — not repeated.
- Review: 3 panels, blockers 5 / 2 / 2. Round 3 exceeded the budget (journaled `escalation review-over-budget`); closed by HUMAN (`closed=human`): fix both — the hint sweep widened to every code point (ESC mutation now killed) and the deferral list completed (session-summary.mjs:66) — and ship without another panel, so those two fixes were not panel-reviewed.
- Built in-session (`mode=conductor`) against build.md's >2-task orchestrator rule.
- Advisory: the unknown-tier → standard cap rule is duplicated in cmdArtifact and validate (architect, evaluator).
- Cost: shares the session with update-reclaim and ask-dont-infer; see the update-reclaim digest for session totals.
- Learner proposals awaiting the human (payload changes, not applied):
  1. contract.md: a row pinning a character class, range or closed set sweeps every member, never a sample.
  2. review.md: a written deferral lists its sweep's hits without a variable-name filter; a later-found omission is recorded as a miss.

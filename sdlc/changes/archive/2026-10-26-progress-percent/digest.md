# Digest — progress-percent (#13, standard)
- Shipped: `status` ends each change's title with ` · tasks d/t · p%` (` · p%` with no tasks, nothing for an unknown status or missing change.md); `status --json` adds `progress: { done, total, percent }` after the existing keys. New `lib/progress.mjs` (node:* + siblings). auto.md, build.md and next.md state the same figure in every progress update.
- Formula (human's choice): new 10 · contracted 25 · building `Math.round(25 + 50·done/total)` (25 with no tasks; verify/review run at 75) · verified 90 · shipped 100. It can fall when verify appends fix tasks.
- Specs merged: cli-surface (status figure), unattended-run (progress updates state it). No MODIFIED warning; nothing freed or left waiting.
- Contract: one attack round, 7 must-fix gaps fixed before build (rounding swept over every share 1–12, unknown-status text, CRLF and bullet variants, a dynamic-import scan, a false budget claim). One row's expectation contradicted lib/fences.mjs's section rule (`###` ends no `##` section) and was corrected in build, before any code relied on it.
- Verify: fast gate ran the full suite once (814 / 812 pass / 2 platform skips); the final gate reused it (`reused=yes`). Review skipped: no signal.
- Self-produced (`mode=solo`): both verify notes; no evaluator (standard, no evals.md) and no panel.
- Built in-session (`mode=conductor`, 4 tasks) against build.md's >2-task orchestrator rule.
- Release: lib/ and three playbooks changed, so `npm run shipped-hashes` must run after the commit (as for update-reclaim).
- Cost: shares the session with update-reclaim, ask-dont-infer and artifact-followups; see the update-reclaim digest.
- Learner proposals awaiting the human (not applied):
  1. contract.md step 1: a Delta formula or status mapping gets one row per input class — the fallback class and the rounding rule included — pinning the exact output.
  2. constitution: extend the prove-or-[UNVERIFIED] rule to an assumption about how an existing reader or parser behaves (same line, net 0).

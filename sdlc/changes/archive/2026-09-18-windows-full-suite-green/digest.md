# Digest — windows-full-suite-green (vibe)
<!-- cap:15 -->

- **Shipped**: `npm pack` no longer fails with ENOENT on Windows (one fixed command string with
  `shell: true` — an args array would raise Node 24's DEP0190). The update-notice tests' positive
  waits went from 5 s to 20 s. Tests only; no spec delta merged.
- **Did NOT make the full suite green on Windows** — 5 failures became 2–3, all in
  `tests/update-notice.test.mjs`. Reproduced under load: the checker's own 3 s fetch timeout gives
  up as designed, a live child blocks cleanup (EPERM), and the hook's spawn breaks a 1 s latency
  bound. Split into a separate deep change; `update-from-the-notice`'s final gate stays held.
- **Verify**: 1 fast-gate pass on the touched paths (44/44). **The full suite never ran before
  ship** — the final gate was skipped by tier (vibe). Both verify outcomes are **self-produced**
  (`mode=solo`): no independent agent judged this change; no evals applied to a vibe.
- **Cost: not reliably known.** The journal's figure (1,153,365 output tokens) is wrong:
  `lib/observe.mjs:64` sums every `session` event, and each is a cumulative whole-session snapshot
  (`payload/hooks/session-summary.mjs:25,39`), so it double-counts. Affects every archived digest.
- **Learner**: no proposals.

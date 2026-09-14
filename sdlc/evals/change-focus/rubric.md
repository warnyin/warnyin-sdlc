# Eval contract — next-this-session
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: the contract table was written and its tests seen red before any
  implementation; `npm test` was run and read before a task was called done.
- Quality — one rule, one place: the CLI's `status` and every installed hook resolve the
  active change through the same `lib/` function; no hook or playbook re-derives it from
  `.state/` by hand.
- Quality — degrade, never break: with no session identity, a malformed pointer, or the
  undocumented env var absent, behavior is exactly today's project-wide pointer and every
  hook still exits 0.
- Quality — the id is refused, not repaired: an unsafe session id produces no session file
  and reads none, using the same single-safe-segment rule as change ids rather than a new
  sanitizer.
- Quality — no false claim of ownership: `status` never marks a change as this session's
  unless this session set it, and never promotes the most-recently-edited fallback to
  "current".
- Quality — tests do not depend on who runs them: helpers scrub the inherited session env,
  so the suite gives the same result inside Claude Code and in CI.
- Quality — `lib/` stays installable: the new module imports only `node:*` and assumes no
  repo-relative path.
- Quality — token residency: `next.md` stays within its brevity rule (≤5-line answer), and
  `docs/design.md` records `.state/sessions/` once.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

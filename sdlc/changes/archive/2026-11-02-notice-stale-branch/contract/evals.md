# Eval contract — notice-stale-branch
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: tests.md and red tests existed before `lib/update-notice.mjs` or `payload/playbook/update.md` changed.
- Trajectory: the hook spawns no git; `payload/hooks/*` and `lib/` gain no `child_process` use.
- Quality — base branch: B1–B10 make a behind branch withhold the choice, name the default branch's
  version as of the last fetch, recommend syncing, and run no fetch; every failure path offers the choice.
- Quality — fail closed: "newer" is a numeric `X.Y.Z` comparison; a non-`X.Y.Z` or CRLF-mangled value
  cannot suppress the offer (it counts as a failed command → the choice is offered).
- Quality — wording: the notice line names the checkout, not the project, and no longer orders an
  unconditional offer that step 3 can withhold.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

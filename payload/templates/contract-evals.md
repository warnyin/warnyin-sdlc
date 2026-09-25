# Eval contract — <change-id>
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: did the agent read the contract before writing code? run tests before claiming done?
- Over-build: did it take the lowest rung that holds on `principles.md` § Minimalism's ladder, and add no unrequested abstraction, dependency or file? (review's `delete:`/`stdlib:`/`native:`/`yagni:`/`shrink:` lines are evidence)
- Quality: <change-specific bars>

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

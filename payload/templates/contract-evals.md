# Eval contract — <change-id>
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: did the agent read the contract before writing code? run tests before claiming done?
- Over-build (advisory): did it take the lowest rung that holds on `principles.md` § Minimalism's ladder, and add no unrequested abstraction, dependency or file? (review's `delete:`/`stdlib:`/`native:`/`yagni:`/`shrink:` lines are evidence)
- Quality: <change-specific bars>

## Pass bar
- all non-advisory scores ≥ 4; an `(advisory)` line is outside the bar and its findings go to the change for the digest; only a minimalism line may be advisory, never a security, data or contract line · failures route back to `/sdlc:build` with a cluster note

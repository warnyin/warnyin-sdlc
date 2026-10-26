# Eval contract — digest-backlog
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: did the agent see every row not marked a green guard (8, 9, 12) red first, and prove the green guards by mutation?
- Over-build (advisory): one place for the atomic write (writeFileContained), no new module or dependency, prose added only where the human picked it.
- Quality (write safety): can any failure between the temp's creation and the rename leave the target changed, a temp file behind, or a write outside the project?
- Quality (doctrine): does each new playbook sentence say one rule, in the step a reader is in when the rule applies, without contradicting a neighbouring line?

## Pass bar
- all non-advisory scores ≥ 4; an `(advisory)` line is outside the bar and its findings go to the change for the digest; only a minimalism line may be advisory, never a security, data or contract line · failures route back to `/sdlc:build` with a cluster note

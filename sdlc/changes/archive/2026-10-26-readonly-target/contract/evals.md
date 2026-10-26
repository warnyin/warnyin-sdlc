# Eval contract — readonly-target
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: was the failure reproduced on the platform where it happens (POSIX) before the fix, and the full suite run there after it?
- Over-build (advisory): one check in writeFileContained, no new module or dependency.
- Quality (write safety): is a read-only existing target refused before any temp file exists, on both platforms, with the old error?

## Pass bar
- all non-advisory scores ≥ 4; an `(advisory)` line is outside the bar and its findings go to the change for the digest; only a minimalism line may be advisory, never a security, data or contract line · failures route back to `/sdlc:build` with a cluster note

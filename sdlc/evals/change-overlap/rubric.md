# Eval contract — overlap-warning
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: did the agent see every row not marked a green guard red first, run the full suite on Linux (WSL) as well as Windows before claiming done, and prove each added guard by a mutant?
- Over-build (advisory): one pure comparison in lib/overlap.mjs and one git reader in bin/; no feature grouping, no fetch, no path matching, no new dependency.
- Quality (git safety): can any configured value or any text read from another ref reach a git argument, a shell, a file path or the terminal unchecked? Ref names pass the closed pattern; paths go on stdin; ids and capabilities are escaped in text output.
- Quality (blast radius): is it impossible for a hook, `archive` or any command except `overlap` and CLI `validate` to start git, and does a project without `overlapBranches` behave byte-for-byte as before?
- Quality (honesty): does a skipped ref, a stale ref and a malformed blob say so instead of reading as "no overlap"?

## Pass bar
- all non-advisory scores ≥ 4; an `(advisory)` line is outside the bar and its findings go to the change for the digest; only a minimalism line may be advisory, never a security, data or contract line · failures route back to `/sdlc:build` with a cluster note

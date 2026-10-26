# Eval contract — followups-finish
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: did the agent see every row not marked a green guard (13) or † red first, prove the green guard and the † rows by mutation, and run the full suite before claiming done?
- Over-build (advisory): did it take the lowest rung on `principles.md` § Minimalism's ladder — no new module, no new dependency, reuse of `pathIsContained`/`writeInProject`/`escapeEntry`?
- Quality (write discipline): does `archive` check every write and move target before its first write, so a refusal leaves specs, rubrics, the change folder and the journals byte-identical?
- Quality (terminal safety): does every print site the enumeration lists go through `escapeEntry` (or `formatIssues`), with `--json` unchanged, and does a re-run of the enumeration find none left?
- Quality (install order): is the order derived from the payload's own imports, deterministic, and safe on a cycle?

## Pass bar
- all non-advisory scores ≥ 4; an `(advisory)` line is outside the bar and its findings go to the change for the digest; only a minimalism line may be advisory, never a security, data or contract line · failures route back to `/sdlc:build` with a cluster note

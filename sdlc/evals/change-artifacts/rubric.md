# Eval contract — change-artifacts
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: did the agent read the contract before writing code? run tests before claiming done?
- Over-build: did it take the lowest rung that holds on `principles.md` § Minimalism's ladder, and add no unrequested abstraction, dependency or file? (review's `delete:`/`stdlib:`/`native:`/`yagni:`/`shrink:` lines are evidence)
- Quality: the extraction (T0) changed no behaviour — park and fenced-code code paths read the same, only moved; no second copy of the fence or change-file guard exists.
- Quality: no always-loaded text grew — playbooks, constitution, harness and templates are untouched; the only prose added is one conventions-skill line and the ledger row.
- Quality: every artifact check in validate is `warn` by construction (rows 16–17 pass with --strict; row 25's grep), and no code path opens, reads or follows an artifact's path or content.
- Quality: every refusal message names the change and the offending name, and says why.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

# Eval contract — artifact-followups
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: did the agent read the contract before writing code, see every row not marked a green guard (9, 13, 14; review-1 rows 4b, 4c, 8b proven by mutation instead) red first, and run the tests before claiming done?
- Over-build (advisory): did it take the lowest rung that holds on `principles.md` § Minimalism's ladder, and add no unrequested abstraction, dependency or file? (review's `delete:`/`stdlib:`/`native:`/`yagni:`/`shrink:` lines are evidence)
- Quality (terminal safety): does every message that echoes a change id — refusal, hint, success line — go through `escapeEntry` or the placeholder, with no path in `artifact` or park/unpark left that prints it raw? (sweep `changeId` / `basename(changeDir)` over bin/cli.mjs cmdArtifact, lib/artifacts.mjs, lib/change-file.mjs, lib/park.mjs; echoes elsewhere are the recorded follow-up)
- Quality (write discipline): does the cap refusal sit before the single write, so a refused stamp leaves change.md byte-identical, and does the cap come from `capForChange` + `countEffectiveLines` only?
- Quality (consistency): do the stamp and validate read a basis by one rule (case-insensitive, compared lower-cased), and report an un-lstat-able artifact with the same words?

## Pass bar
- all non-advisory scores ≥ 4; an `(advisory)` line is outside the bar and its findings go to the change for the digest; only a minimalism line may be advisory, never a security, data or contract line · failures route back to `/sdlc:build` with a cluster note

# Eval contract — change-relations
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: did the agent read `contract/tests.md` and the delta before writing code, and run
  `npm test` before claiming a task done, rather than reasoning that it should pass?
- Trajectory: was each claim that removed work proved by a run — a golden `status --json` on a
  relation-free project, and the two review exploits (a planted archive folder, an unreadable
  neighbour) re-run against the fix — not by a read alone?
- Quality — ship stays atomic: the refusal and the read of the waiting changes both land before
  the merge, and only the rendering sits after the rename, so a done ship never reports failure.
- Quality — the report counts rather than announces: nothing is called resumable while another
  blocker is still open, and the remaining blockers are named.
- Quality — one source of truth: the waiting direction is stored once and the reverse is derived
  from what the open changes declare; no second copy and no new state file appear.
- Quality — `lib/relations.mjs` imports only `node:*` and assumes no repo-relative path, so the
  copy installed into a user project behaves identically.
- Quality — every refusal names the offending change: an error that says only that relations are
  invalid, or a park refusal that does not name who would be left waiting, scores 2 or below.
- Quality — a blocker is retired only by a change that really shipped: an archive folder is
  treated as a claim to check, never as a receipt, since it is ordinary repo content.
- Quality — doctrine and code agree: `new.md`, `next.md` and `ship.md` describe exactly the
  behaviour the tests assert, no stage is told to do something the CLI refuses, and the freed
  report reaches the human rather than dying in the terminal.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

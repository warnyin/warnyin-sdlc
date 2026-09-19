# Eval contract — init-manifest-carryover
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: `tests.md` and failing tests existed before `bin/cli.mjs` was touched.
- Trajectory: the fast gate ran the touched-file tests plus the live repro (`init` twice, then
  `update` over a staged ours-but-older file); the full suite stayed the final gate's job.
- Quality — ownership is never silently lost: no path added here drops a manifest entry, and a
  user-edited file keeps its entry so prune's disk-hash guard still protects it.
- Quality — `cmdUpdate` is untouched: its wholesale replace still drives prune, and a tool
  dropped from the recorded set is still pruned.
- Quality — the install summary still describes only what that run installed; carried-forward
  entries do not inflate its counts.
- Quality — honest supersede: the previous change's "self-heals, no data loss" note is corrected
  rather than quietly left standing, since it is now known to be wrong.
- Quality — the fix is proven by the exact failure the bug produced (a frozen file falsely
  labelled user-modified), not only by counting manifest lines.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

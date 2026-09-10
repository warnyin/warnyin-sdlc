# Eval contract — journal-out-of-tree
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: the contract table was written before any implementation; `npm test` was
  run and read before a task was called done.
- Quality — the symptom is proven, not assumed: the clean-tree behaviour is asserted
  against a real git repository, so the test would fail if the file were merely renamed
  inside the tracked tree.
- Quality — no recorded event is lost: legacy in-tree telemetry is read alongside the
  live stream and carried into the archive, and the only deletion of a tracked file
  happens inside the ship write.
- Quality — one source of truth for the path: the CLI, the report builder and the
  installed hook all resolve the journal through the same `lib/` module rather than
  each rebuilding the path.
- Quality — the installed hook stays importable: nothing added to `lib/` reaches beyond
  `node:*`, and nothing assumes a repo-relative path, so the copy under
  `sdlc/.hooks/lib/` still runs with no `node_modules/`.
- Quality — the guard is not weakened: the machine-owned lock still denies a hand edit
  of the telemetry file at its new location, by prefix and not by luck.
- Quality — vacated assertions are replaced, not deleted: a test that stopped guarding
  anything because the file moved now guards the equivalent property at the new path.
- Quality — token residency: the delta and the ledger say where telemetry lives once;
  the change does not restate the path in prose that will drift.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

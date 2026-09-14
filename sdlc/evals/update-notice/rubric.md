# Eval contract — update-notice
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: tests.md and failing tests existed before `check-update.mjs`, the lib helpers or the inject-context change.
- Trajectory: full `npm test` green before build claimed done; no commit, push or publish.
- Quality — notice only: nothing in the change runs `update`, writes outside `sdlc/.state/`
  at session time, or phrases the line as an instruction to act; the line tells the agent to
  inform the user and not run the command.
- Quality — fail open: every hook path (no network, bad cache, missing version.json,
  unwritable `.state/`) exits 0 without stderr; the spawned checker cannot surface errors.
- Quality — untrusted input: registry text is size-capped before parsing, only a strictly
  validated version is ever persisted or printed, and the cache is re-validated on read.
- Quality — cost: at most one line of residency, only when outdated; one request per 24 h;
  `docs/design.md` records the residency.
- Quality — boundaries: `lib/` helpers import only `node:*` and stay pure (no network, no
  fs); I/O lives in the hook scripts.
- Quality — docs: CHANGELOG states default-on for existing installs and how to turn it off.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

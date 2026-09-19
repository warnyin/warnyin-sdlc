# Eval contract — kimi-code-adapter
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: `tests.md` and failing tests existed before `bin/detect.mjs`, `bin/cli.mjs` or
  `payload/adapters/kimi.md` were touched.
- Trajectory: the fast gate ran the touched-file tests plus a live `init --tool kimi` smoke
  check; the full suite stayed the final gate's job, not build's.
- Quality — consistency: the adapter file, detection marker and `TOOLS` wiring follow the
  exact same shape as `cursor`/`windsurf` (dedicated `installFile`-owned file, directory
  marker) rather than inventing a new pattern for one tool.
- Quality — no scope creep: no hook, skill or subagent translation was added for Kimi Code;
  the change stayed lite-tier as decided.
- Quality — no duplication: the rules-card content stays the single shared
  `payload/playbook/rules-card.md`, never copied into `kimi.md`.
- Quality — honest docs: nothing written claims Kimi's hooks/skills/agents are supported;
  the change's Assumptions accurately name what is unverified.
- Quality — fixture parity: every existing test that enumerates `cursor`/`windsurf` (detection,
  picker, marker-append idempotency, ambiguity-line) was checked for a missing `kimi` row and
  updated where the coverage was worth mirroring.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

# Eval contract — groom-stage
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: `tests.md` and failing tests existed before `payload/` was touched.
- Quality — it interrogates the problem: the doctrine forbids letting the human's proposed
  solution set the scope, which is the exact failure that cost this repo two releases when
  "make it work in Kimi" was scoped as a rules file without asking what "work" meant.
- Quality — no new residency: grooming writes no artifact, the always-loaded flow line is
  untouched, and the stage file earns its place by being read only when invoked.
- Quality — it can say no: "not worth building" is named as a legitimate ending, so the stage
  is not a funnel that always produces a change.
- Quality — it serves the verify-or-mark rule rather than repeating it: what grooming learns
  arrives in `## Assumptions` already run, instead of plausible.
- Quality — proportionate: a standard-tier prose change run as one, no panel, after a session
  whose lesson was that ceremony outran risk.
- Quality — the single-source claim is demonstrated, not asserted: the first stage added since
  0.16.0 reaches Kimi with no Kimi-specific work, and a test says so.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

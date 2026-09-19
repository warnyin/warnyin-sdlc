# Eval contract — kimi-stage-skills
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: `tests.md` and failing tests existed before `bin/cli.mjs` or `lib/manifest.mjs`
  were touched, and every red row was seen red for the right reason, not a precondition.
- Trajectory: the fast gate ran the touched-file tests plus a live `init --tool kimi` and a live
  deselect-and-prune; the full suite stayed the final gate's job.
- Quality — one source: the skills are rendered from the Claude stage stubs, and the parity test
  derives its expectation at run time rather than hardcoding the stage list, so a stage added for
  Claude cannot silently miss Kimi.
- Quality — the delete surface stays inside our namespace: the allowlist entry covers
  `sdlc-*/SKILL.md` only. A user's own skill under `.kimi-code/skills/` is outside prune's reach
  by scope, not merely spared by the hash guard, and a test proves it survives a real deselect.
- Quality — no new enforcement claimed: nothing here pretends Kimi gained hooks. Its enforcement
  is still prose plus `validate`, and `docs/design.md`'s ceiling/floor line is clarified rather
  than quietly contradicted.
- Quality — stages are user-initiated: `disableModelInvocation` is set on every skill, so a
  destructive stage like ship cannot be fired by the model deciding on its own.
- Quality — honest scope: the one thing that cannot be checked here (the real `kimi` binary
  loading these files) is marked `[UNVERIFIED]` with what it rests on, rather than asserted.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

# Eval contract — init-tools-sync
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: `tests.md` and failing tests existed before `bin/cli.mjs` was touched.
- Trajectory: the fast gate ran the touched-file tests plus a live repro of the original bug
  sequence (`init --tool claude` → `init --tool kimi` → plain `update`) proving it no longer
  prunes; the full suite stayed the final gate's job.
- Quality — no new prune capability: `init` still never deletes a project file under any
  code path added here; only the recorded `tools:` line changes.
- Quality — `update --tool`'s contract is byte-for-byte unchanged: it still fully replaces
  the recorded list and still prunes what's left out.
- Quality — no duplication: the `tools:`-line rewrite exists in exactly one place, called by
  both `cmdInit` and `cmdUpdate`.
- Quality — honest scope: the "no `tools:` line at all" gap is named as pre-existing and
  matched, not silently left inconsistent between the two commands.
- Quality — the fix is proven with the exact repro that found the bug, not just unit-level
  assertions on the helper in isolation.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

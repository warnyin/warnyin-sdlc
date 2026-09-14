# Eval contract — dynamic-expert-lenses
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: the contract table was written and its tests seen red before any
  implementation; `npm test` was run and read before a task was called done.
- Quality — no lens, no cost: a change with no UI/API/data signal loads nothing new; the
  catalog is read only by the opening stage, never added to always-loaded context.
- Quality — skill text is data: no playbook tells the agent to follow a skill found by the
  inventory without judging it, and the inventory itself never emits body text.
- Quality — suggest, never install: no playbook, CLI path or test fetches or writes a skill
  or agent anywhere.
- Quality — one list, one place: lens names exist once in `lib/lenses.mjs`; the catalog and
  validator are held to it by a test, not by discipline.
- Quality — the catalog earns its lines: each lens's ground step says concretely how to look
  at what exists (for `ux-ui`: the current screens/components, and a screenshot only when a
  browser tool is in the harness), not generic design advice.
- Quality — core review is not weakened: the four core reviewers and their triggers are
  unchanged; lenses only add.
- Quality — containment mirrors the codebase: project-side link handling reuses the existing
  realpath/`containedIn` rule rather than a new sanitizer.
- Quality — `lib/` stays installable: new modules import only `node:*` and assume no
  repo-relative path; `docs/design.md` records the catalog's residency once.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

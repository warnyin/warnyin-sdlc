# Eval contract — update-from-the-notice
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: `tests.md` and failing tests existed before `bin/cli.mjs`,
  `lib/update-notice.mjs` or any new payload file was touched.
- Trajectory: each fast gate ran every contract row and the touched paths — the full suite is
  the final gate's job (`verify.md`), not build's; `npm run setup:dogfood` re-run after
  payload edits; no commit, push or publish.
- Quality — consent: nothing in the change writes to a project before an explicit pick.
  The deferring option and the see-what-changed option both leave the tree byte-identical,
  and no wording nudges the reader by implying the update is already under way.
- Quality — blast cap: the agent never passes `--force`. A capped prune is handed back with
  enough detail for a person to judge it, and never resolved in the same reply.
- Quality — own source: the refusal compares the invoked tree against the project, not names
  alone, and `npm run setup:dogfood` still regenerates this repo's mirrors after the change.
- Quality — cost: the notice is still one line, still only when outdated, still outside the
  budget. Changelog text reaches session context only on an explicit preview or apply, and is
  bounded there, with what it left out counted.
- Quality — untrusted input: nothing new from the registry reaches the context; the changelog
  is read from the local package, bounded, and rendered as text rather than followed.
- Quality — boundaries: `lib/` stays `node:*`-only and pure; CLI presentation stays in `bin/`,
  and the installed hooks keep failing open.
- Quality — honest reporting: the written / pruned / kept figures the agent repeats are the
  installer's actual output, not a restatement of what it meant to do, and a refusal or a
  partial prune is reported as plainly as a success.
- Quality — docs: the CHANGELOG says the notice now asks instead of tells, that nothing is
  updated without a pick, and how to switch the check off.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

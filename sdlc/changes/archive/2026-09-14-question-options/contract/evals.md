# Eval contract — question-options
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: tests.md and failing tests existed before `new.md` or `rules-card.md` changed;
  `npm test` was run and read before done; `setup:dogfood` ran after the payload edit.
- Quality — options are real alternatives: the doctrine asks for choices a reasonable person
  might pick, each with what it costs, not a recommended answer plus strawmen. (5: every
  option names its cost; 3: some options are filler; 1: yes/no/maybe padding.)
- Quality — no invented options: the doctrine keeps open-ended questions to one recommended
  answer, and says why (options would narrow a free-form fact).
- Quality — the picker is used, not described: Claude Code runs are told to call the picker
  for option questions, with the recommended option first, and to split beyond its limit
  without advancing the round.
- Quality — tool-neutral: tools without a picker get a complete inline form (lettered
  options, reply by `1b`); nothing in step 5 only makes sense inside Claude Code.
- Quality — budget: step 5 grows by the new rules only; the rounds, look-up-first and
  confirmation rules read as before.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

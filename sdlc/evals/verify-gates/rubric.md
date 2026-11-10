# Eval contract — verify-fast-final-gates
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: tests.md and failing tests existed before any playbook or `lib/observe.mjs`
  edit; `npm test` was run and read before done; `setup:dogfood` ran after the payload edit.
- Quality — one full run in the happy path: following verify.md → review.md → verify.md for a
  change with review signals runs the full test command exactly once. (5: no reading of the
  doctrine yields a second full run; 3: an ambiguous branch could; 1: every round still does.)
- Quality — routing is decidable from the record: an agent can tell which gate to run from the
  journal and change state alone, with no memory of the earlier session.
- Quality — nothing weakened: the final gate is still the full test command, the 3-round
  budget and escalation are unchanged, and `mode=` provenance still rides every note.
- Quality — works without the new key: with only `test command` in the harness, the fast gate
  takes the first rung that can run (related tests, then touched packages) and runs the full
  command only when none can be named, the diff is cross-cutting or the human asks, recording
  why; nothing asks the human to add the key. (5: every rung explicit and the full run reasoned;
  3: derivation vague; 1: falls back to the full command without a stated reason, or silent when
  the key is absent.)
- Quality — budget: verify.md grows by the gate rules only; review, next and ship change by
  their routing lines, not by restating the gates.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

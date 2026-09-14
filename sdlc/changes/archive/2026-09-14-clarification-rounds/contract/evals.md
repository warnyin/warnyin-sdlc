# Eval contract — clarification-rounds
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: the contract table was written before `new.md` was touched; `npm test` was
  run and read before a task was called done; `setup:dogfood` ran after the payload edit.
- Quality — dependency is the grouping rule: the doctrine defines a round by what is
  already answered, not by topic, count or convenience. A rule that reads as "ask in
  small batches" does not satisfy it.
- Quality — moot questions are dropped: a question an earlier answer settled or made moot
  is not asked in a later round.
- Quality — the recommendation is an answer, not a restatement: doctrine asks for the
  answer the agent would pick, so the human can accept it with one word.
- Quality — asking stays rare: nothing in step 5 widens when the agent asks. The
  assume-safely policy and the `harness.md` escalation surface read exactly as before.
- Quality — facts vs decisions is explicit: what the repository or tools can settle is
  looked up; only what the human alone can decide is put to them.
- Quality — the confirmation is conditional: it is required only when questions were
  asked, and a correction reopens a question instead of editing the answer silently.
- Quality — unattended mode untouched: `auto.md` is not edited, and step 5 defers to its
  single confirmation rather than restating it.
- Quality — honest about reach: nothing claims the grouping is computed or guaranteed;
  a wrongly grouped round is repaired by reopening, and the change says so.
- Quality — token residency: step 5 grows only by what the four rules need; the rules
  card gains no more than its one ambiguity line.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

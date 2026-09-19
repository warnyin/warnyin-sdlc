# Eval contract — assumptions-are-claims
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: this change obeys its own new rule — every Assumption it records that removes
  work was verified by running or reading first, not asserted (the budget-pin claim in
  particular was checked against both test files, not guessed).
- Trajectory: `tests.md` and failing tests existed before any `payload/` file was edited.
- Quality — the rule lands where the claim is spent, not only where it is written: `new.md`,
  `contract.md`'s out-of-scope list, and `review.md`'s targeting all carry it.
- Quality — budget discipline: `new.md`'s pin is raised deliberately and visibly, with the
  raise recorded in the change, rather than quietly deleted or worked around; every other
  pinned budget is untouched and the card stays within 40.
- Quality — the doctrine is stated as an obligation an agent can follow, in the playbook's
  existing terse voice, not as an essay about why the bugs happened.
- Quality — proportionate process: this is a standard-tier prose change and was run as one
  (no design stage, no forced panel), after a session whose lesson was that ceremony was
  applied out of proportion to risk.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

# Eval contract — scoped-test-commands
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: the journal's `contract` note comes before its first `build` note.
- Trajectory: each round's test output and its verify note agree: output that is the whole suite carries `scope=full` and a `reason=` the diff supports. (5: all agree; 1: a whole-suite round recorded as scoped, or with a reason the diff contradicts.)
- Quality — no easy way back to full: reading V1–V7 together, the fast gate may run the full test command only for `no-subset`, a cross-cutting diff or a human request, and no wording widens that.
- Quality — nothing weakened: the final gate is still the full test command, the 3-round budget and the contract-row coverage rule are unchanged, and a scoped pass cannot count for a row it did not run.
- Quality — works on an old harness: with only `test command` in `sdlc/harness.md`, each of build, contract and verify states what runs, including when no file filter exists.

## Pass bar
All lines ≥ 4.

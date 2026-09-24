# Eval contract — autopilot
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: did the agent read the contract before writing code? run tests before claiming done?
- Trajectory: was `auto.md` left byte-identical (`git diff --stat payload/playbook/auto.md` empty)?
- Quality — one ask: could an agent following `autopilot.md` literally reach ship with exactly one
  human interaction (the grill + its confirmation), with no sentence that sends it back to the human?
- Quality — grill fidelity: are rounds built from the decision frontier (dependent questions
  deferred), each question numbered with a recommended answer, facts looked up not asked?
- Quality — the four criteria: does the playbook make requirement, quality/standards, time and cost
  an explicit, per-run ordered rule the agent applies at each pilot decision, not a slogan?
- Quality — accountability: do all five pillars (operating model, evidence trail, human
  accountability, monitoring, recovery path) map to a concrete artifact or step, each checkable?
- Quality — risk honesty: is the mid-run hard-floor delegation a separate refusable item every
  run, and does the digest put hard-floor pilot decisions first?
- Quality — reuse: does `autopilot.md` reference `auto.md`/`groom.md`/`clarification-rounds`
  instead of copying them, and stay short enough to be read in one pass (≤ 60 effective lines)?
- Quality — grill.md template: can a human reading only grill.md after ship tell what was
  delegated, by whom, and how to undo each decision taken alone?

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

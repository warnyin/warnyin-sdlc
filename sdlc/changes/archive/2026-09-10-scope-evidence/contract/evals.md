# Eval contract — scope-evidence
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: the contract table was written before `auto.md` was touched; `npm test` was
  run and read before a task was called done.
- Quality — the rule bites where the failure was: the doctrine demands the command and its
  output per scope item. A run that shows one evidence block for a whole multi-item scope,
  or a summary of what it found, does not satisfy what is written.
- Quality — absence is treated as a claim: an empty search result is written as something
  needing its pattern shown, never as an established fact. Two of the three reported
  errors were absences, and doctrine that only covers positive matches misses them.
- Quality — the mismatch flag is actionable: it names the term the request used and the
  term the evidence searched, so a reader sees the gap without re-deriving it.
- Quality — honest about its own reach: nothing in the change claims a mechanical
  guarantee. The confirmation is model-produced at runtime, and the digest and change
  should say the enforcement is doctrine, not a gate.
- Quality — refusability survives: the new rules extend the per-item refusal the spec
  already required; nothing collapses evidence into a single all-or-nothing approval.
- Quality — token residency: `auto.md` grew only by what the three rules need. The
  pipeline, the status → stage mapping, and the escalation table are not restated.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

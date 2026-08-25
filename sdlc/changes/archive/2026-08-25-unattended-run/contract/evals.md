# Eval contract — unattended-run
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: contract read before the playbooks were written; `npm test` run before
  any task was called done.
- Quality — nothing written before consent: a declined confirmation leaves no
  change.md, no journal line, no gate, no active-change pointer. The doctrine makes
  this an order of operations, not an intention.
- Quality — the confirmation is decidable: it shows scope, tier, the ambiguities and
  the assumptions that will be acted on, and each escalation being pre-approved as a
  named line. A reader can say no to one item, not just to the whole run.
- Quality — authority stays bounded: nothing in the wording lets a pre-approval
  survive the run, reach config, or be inherited by a resumed pipeline.
- Quality — the ratchet holds: no phrasing permits an earlier stage to re-run over
  work that already exists; skipping is announced rather than silent.
- Quality — unconfirmed conditions still stop: the escape hatch is not written as a
  judgement call the agent can talk itself out of.
- Quality — hard-floor visibility: shipping a deep-tier change unattended appears in
  the confirmation as its own line naming what it covers, never folded into a general
  "run without me".
- Quality — token residency: auto.md grew only by what `--auto` needs; the pipeline
  and the status → stage mapping are not restated from next.md.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

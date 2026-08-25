# Eval contract — feedback-command
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: did the agent read tests.md and the delta before writing the playbook, and
  run `npm test` before claiming a task done?
- Trajectory: were the payload source and its test changed in the same step, never a
  payload edit with the test deferred?
- Quality — disclosure order: the playbook makes redact → show full draft → send an
  unskippable sequence; no wording lets a report leave the machine before approval.
- Quality — refusal to guess: unreadable context becomes `unknown`; the playbook never
  invents a version, a repo, or a stage.
- Quality — injection safety: the body travels over stdin; no instruction anywhere in
  the playbook interpolates human-written text into a shell argument.
- Quality — honest fallback: a missing or logged-out CLI reads as a normal branch with a
  usable URL, not as a failure or a dead end.
- Quality — no false confidence: the playbook does not claim redaction is exhaustive; it
  names human approval as the actual control.
- Quality — token residency: the new playbook earns its lines — no restating the delta,
  no doctrine already stated in principles.md or the rules card.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

# /sdlc:auto <title|change-id> — the whole pipeline, one command

Runs new → [design] → contract → build → verify → [review] → ship, each stage by
its own playbook, WITHOUT pausing for the human except on the Autonomy-policy
escalation conditions:

- hard-floor surface (security, payments, data-loss, irreversible),
- a `[NEEDS CLARIFICATION]` the agent cannot resolve alone,
- verify failed more than 3 rounds,
- token budget exceeded (if the user set one),
- ship policy requires human approval (deep tier).

Entry stage — resolve this first, never assume `new`:
- Run `npx @warnyin/sdlc status`. If the argument names an active change (or one
  is active and the argument describes it), RESUME: map its status to the entry
  stage with `next.md` §2 and start the pipeline there.
- Resume never rewrites an existing `change.md` — a change already triaged keeps
  its tier, Delta and Assumptions. Re-run a stage only if its output is missing
  or the validator rejects it.
- Start at `new` only when the argument matches no active change.

Rules:
- Announce the plan in ≤3 lines after triage (id, tier, task count, entry stage),
  so a resume is never silent. Then work.
- Between stages run `npx @warnyin/sdlc validate <id>` — a red validator is a
  hard stop for that stage, not a suggestion.
- On escalation: stop at the exact step, state what is needed in ≤5 lines, wait.
  When the human answers, resume from that step — never restart the pipeline.
- On completion report one line: shipped + digest path + total cost if known.

This is orchestrator mode: the human describes the outcome and walks away.

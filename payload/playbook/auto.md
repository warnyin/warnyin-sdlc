# /sdlc:auto <title|change-id> — the whole pipeline, one command

Runs new → [design] → contract → build → verify → [review] → ship, each stage by
its own playbook, WITHOUT pausing for the human except on the Autonomy-policy
escalation conditions — each with the choice `--auto` may pre-approve:

| Condition | Pre-approvable as |
|---|---|
| a `[NEEDS CLARIFICATION]` the agent cannot resolve alone | assume-safe and continue · or stop and ask |
| verify failed more than 3 rounds | keep iterating · or stop |
| review found blockers | fix and continue · or stop for the human |
| ship needs human approval (deep tier / hard-floor: security, payments, data-loss, irreversible) | ship · or stop before ship |
| token budget exceeded (if the user set one) | continue · or stop |

`/sdlc:auto` and any stage command given `--auto` run in unattended mode below.

## Unattended mode — gather, confirm, run (in that order)

1. **Gather.** Triage the tier, read `npx @warnyin/sdlc status`, resolve the entry
   stage, and collect every question you would otherwise raise mid-run. This step
   writes NOTHING: no `change.md`, no journal entry, no gate, no active-change
   pointer. A run that never gets confirmed must leave the repository unchanged.
2. **Confirm.** One message, and it must be decidable item by item:
   - scope as you understood it, and the tier you triaged with its reason
   - **the evidence under each scope item**: the command you ran and what it
     returned — not the list it produced, and not your summary of it. A reader who
     can only see the conclusion can only agree with it. Evidence goes per item:
     one block for a whole scope buys a single yes for derivations nobody checked
     separately. A scope you did not derive from a command says so plainly.
   - **flag evidence that does not match the request**: name the term the request
     used and the term you actually searched when they differ, and raise any
     narrowing the request never asked for (a folder pattern, a naming convention)
     as its own refusable item.
   - **an exclusion made on an empty result names the pattern searched.** Finding
     nothing is a claim about your pattern, not a fact about the candidate — a
     convention you did not anticipate looks exactly like an absence.
   - every ambiguity, each with the assumption you intend to act on
   - one line per row of the escalation table above, each stating the choice you
     want pre-approved, and each refusable on its own. For the ship row, name the
     hard-floor surface it covers — never fold it into a general "run without me".
   If the human declines or edits any item, nothing has been written yet: revise
   the summary and ask again, or stop. Do not start work on a partial yes.
3. **Run.** Only now write anything. Work stage by stage to ship.

**Pre-authorization covers this run only.** It is never persisted to config, never
remembered for the next change, and never inherited by a resumed run — a resume
asks again. A condition outside the confirmed set stops the run and asks, exactly
as if no flag had been passed; treat that as a fact, not a judgement call.

Record every escalation you reach:
`node sdlc/.hooks/journal.mjs note escalation condition=<name> preauth=<yes|no>`
— `yes` when a pre-approval let you pass it, `no` when you stopped and asked.

Entry stage — resolve this first, never assume `new`:
- Run `npx @warnyin/sdlc status`. If the argument names an active change (or one
  is active and the argument describes it), RESUME: map its status to the entry
  stage with `next.md` §2 and start the pipeline there.
- Resume never rewrites an existing `change.md` — a change already triaged keeps
  its tier, Delta and Assumptions. Re-run a stage only if its output is missing
  or the validator rejects it.
- Start at `new` only when the argument matches no active change.
- With `--auto` on a stage command: the stage still does its own work first, then
  the pipeline continues from there. A stage typed earlier than what the change's
  status maps to is skipped with a one-line announcement, never re-run — the
  pipeline is a ratchet.

Rules:
- Announce the plan in ≤3 lines after triage (id, tier, task count, entry stage),
  so a resume is never silent. Then work.
- Between stages run `npx @warnyin/sdlc validate <id>` — a red validator is a
  hard stop for that stage, not a suggestion.
- On escalation NOT pre-approved for this run: stop at the exact step, state what
  is needed in ≤5 lines, wait. When the human answers, resume from that step —
  never restart the pipeline. One that IS pre-approved: take the approved choice,
  journal it, and keep going without asking.
- On completion report one line: shipped + digest path + total cost if known.

This is orchestrator mode: the human describes the outcome and walks away.

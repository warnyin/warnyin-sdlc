# Model routing

Generic tiers only — the harness adapter maps them to real models. Claude Code:
cheap → haiku, balanced → sonnet, deepest → opus, session → no override (`inherit`: the
model the human chose for the session).

| Task kind | Tier | Why |
|---|---|---|
| requirements shaping, architecture, deep design | deepest | judgment-heavy, small volume |
| standard implementation (sdlc-builder) | balanced | quality/cost sweet spot |
| test generation (sdlc-contractor) | cheap | mechanical from the contract table |
| test runs in unattended verify (sdlc-runner) | cheap | run a command, map rows, excerpt failures |
| eval judging (sdlc-evaluator) | cheap | rubric scoring, high volume |
| review panel passes | cheap–balanced | parallel, bounded scope |
| learning distillation (sdlc-learner) | cheap | summarization over journals |

## Stage routing
Defaults for the stage itself. Claude stage commands carry the matching `model:`; judgment
stages carry none, so they run on the session model.

| Stage | Tier |
|---|---|
| groom | session |
| new | session |
| design | session |
| init | session |
| steer | session |
| converge | session |
| feedback | session |
| auto | session |
| autopilot | session |
| ship | session |
| contract | balanced |
| build | balanced |
| review | balanced |
| verify | cheap |
| next | cheap |
| observe | cheap |
| update | cheap |

Delegation reads `sdlc/harness.md § Stage routing` first and falls back to the table above
when a harness has none (projects installed before it existed) — never ask the human to add
one. A task's `[tier:x]` outranks its stage's tier.

Rules:
- Task lines in change.md may carry `[tier:cheap|balanced|deepest]`; default = the build stage tier.
- Never send a mechanical task to deepest "to be safe" — that is the waste the
  routing table exists to prevent.
- Escalate one tier only after a concrete failure at the current tier (journal it).
- Delegate work units, never whole stages: a subagent cannot spawn subagents, so a delegated
  stage would lose its own evaluator, learner or builders. Unattended runs: below.

## Unattended delegation
In `/sdlc:auto`, `/sdlc:autopilot` and any `--auto` run, whatever model this session is on:
- The `build` row of `harness.md § Stage routing` (else the table above) is the default task tier,
  and its `verify` row is `sdlc-runner`'s model; pass each as the subagent's per-call `model`
  parameter. The other rows only record each command's `model:` — delegation reads no other.
- A task on a hard-floor surface (security, payments, data-loss, irreversible) runs never below
  balanced, whatever its `[tier:x]`.
- Every build task goes to its own `sdlc-builder` at the model of its `[tier:x]`, else the build
  tier from `harness.md § Stage routing` — whatever the task count; conductor mode is for
  attended runs. Fixes after a failed verify are build tasks too.
- The verify test run goes to `sdlc-runner` with the test command and `contract/tests.md`; it
  returns pass/fail per contract row plus failure excerpts. You decide what the result means.
- Grill, confirmation and escalation decisions stay in the main session and are never delegated
  — a subagent cannot ask the human, and the mandate was given to this session.
- When subagents are unavailable or cannot run, the unit runs in the main session and its
  journal note records `mode=solo`.

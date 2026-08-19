# Harness — @warnyin/sdlc
<!-- cap:60 · CONFIGURE-phase output; reviewed like code. Registry + tables only — doctrine lives in sdlc/.playbook/. -->

## Tools & MCP (what the agent may call)
| Tool/MCP | Scope | Notes |
|---|---|---|
| node --test | tests/ | the only test runner |
| node bin/cli.mjs | repo root or temp dirs | exercise the CLI under development |

## Sandbox & execution
- test command: `npm test`
- sandbox notes: black-box tests spawn the real CLI into `mkdtemp` dirs; never write outside them.

## Guardrails (mirror of installed hooks — deterministic, the agent cannot skip them)
- `sdlc/specs/**` and archive are write-locked outside ship.
- Artifact line caps validated on every write.
- Session token/cost journaled per change.

## Model routing (generic tiers — the harness adapter maps them to real models)
| Task kind | Tier |
|---|---|
| requirements, architecture, deep design | deepest |
| standard implementation | balanced |
| test generation, review passes, mechanical/scaffold, eval judging, learning | cheap |

## Tier triage (stakes → tier)
- vibe: reversible, no behavior-contract change, ≤2 files (docs typo, test tweak).
- deep: installer ownership/prune logic, hook guard behavior, delta-merge semantics,
  anything touching user files in target projects.
- otherwise: standard.

## Autonomy policy
- auto-ship: vibe, standard.
- escalate to human: hard-floor (prune/guard/merge semantics = data-loss surface in user
  projects), verify failed > 3 rounds, token budget exceeded, information the agent
  cannot obtain or safely assume.

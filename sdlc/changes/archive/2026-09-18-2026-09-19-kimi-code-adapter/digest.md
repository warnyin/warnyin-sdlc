# Digest — kimi-code-adapter (deep)
<!-- cap:15 -->

- **Shipped**: `kimi` (Kimi Code CLI) as a new lite-tier adapter — `init`/`update` install a
  dedicated `.kimi-code/AGENTS.md` (rules-card + playbook pointer) via `installFile`, and
  detect an existing setup via the `.kimi-code/` directory, same shape as `cursor`/`windsurf`.
- **Specs merged**: new capability `tool-adapters` (2 ADDED). Purpose hand-written at ship —
  `mergeDelta` never touches it. No scenario dropped.
- **Assumptions**: lite tier only, no hook/skill/agent port (Kimi's hook payload is unverified
  live); dedicated file over appending root `AGENTS.md`, to never collide with `agents-md`.
- **Verify**: 2 fast-gate rounds (eval 5/5 both) + 1 final gate (404/404), 1 review round
  (4-agent panel), all `mode=panel`. **Blocker found**: `.kimi-code/AGENTS.md` was missing
  from `lib/manifest.mjs`'s `ADAPTER_ALLOW`, so deselecting kimi would never prune it — fixed,
  regression-tested (red→green), proven live (init → deselect → update pruned it).
- **Learner, awaiting you**: add `tests/adapter-sync.test.mjs` — a `caps-sync.test.mjs`-style
  check that every `installFile` destination is in `ADAPTER_ALLOW`, closing this class of gap.
- **Cost**: 11 sessions, ~$183 per `observe` — spans the whole conversation, not isolated.

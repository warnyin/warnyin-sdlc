# @warnyin/sdlc

**Spec-driven, AI-driven SDLC for coding agents — token-lean by construction.**

Operationalizes the *"New SDLC with Vibe Coding"* (Day-1) work process: the human configures
the harness once; the AI drives changes end-to-end through contract-first gates; deterministic
hooks and a validator enforce the rules; a journal prices every change in real tokens.

Inspired by OpenSpec (delta specs, archive lifecycle), spec-kit (artifact grammar), and
Kiro (steering + enforced hooks) — tuned for minimum context residency.

## Install

```bash
cd your-project
npx @warnyin/sdlc init          # interactive picker; tools already in the project are pre-selected
```

The picker is a checkbox list — arrows move, `space` toggles, typing filters, `ctrl+a` selects
everything on screen, `enter` confirms. Skip it in CI or scripts:

```bash
npx @warnyin/sdlc init --tool claude,cursor   # explicit list
npx @warnyin/sdlc init --tool all             # every supported tool
npx @warnyin/sdlc init --tool none            # sdlc/ framework only, no agent adapters
```

Then in your coding agent:

```
/sdlc:init                      # interview → constitution + harness (the one human gate)
/sdlc:auto Add rate limiting    # AI runs new → contract → build → verify → ship
```

## How it works

```
sdlc/
├── context/constitution.md   ≤30 lines — the ONLY always-loaded prose (hook-injected)
├── context/steering/*.md     scoped knowledge · inclusion: always|paths|manual|agent
├── harness.md                tools, model routing, tier triage, autonomy policy
├── specs/<capability>/       living specs — WHEN/THEN SHALL, merged mechanically at ship
├── changes/<id>/             one change: change.md (Why+Delta+Tasks) + contract/ + journal
└── changes/archive/          shipped changes + digests (the async human touchpoint)
```

- **Contract-first**: tests + evals are written *before* code and gate everything after.
- **AI-driven, exception-only humans**: the autonomy policy in `harness.md` decides what
  auto-ships and what escalates (hard-floor: security/payments/data-loss/irreversible).
- **Managed hooks** (Claude Code): SessionStart injects ≤60 lines of static context;
  PreToolUse write-locks living specs; PostToolUse validates caps and points at steering;
  Stop journals real token usage. Other tools get the same rules as prose + the validator.
- **Self-improving, leaner over time**: a post-ship learner proposes rules with evidence;
  the always-loaded budget is fixed, so learning must distill, not accumulate.
- **Measured**: `npx @warnyin/sdlc observe` — tokens/cost per change, first-pass rate,
  lead time, dead steering, context-overflow flags.

## CLI

```
warnyin-sdlc init [--tool all|none|a,b]   scaffold + adapters + hooks (picker when omitted)
warnyin-sdlc update [--force]       refresh payload, guarded prune of stale files
warnyin-sdlc validate [id] [--strict]
warnyin-sdlc status | observe [--json]
warnyin-sdlc archive <id>           merge deltas into living specs + archive
```

## Commands (in your agent)

`/sdlc:init` · `/sdlc:auto` · `/sdlc:new` · `/sdlc:design` · `/sdlc:contract` · `/sdlc:build`
· `/sdlc:verify` · `/sdlc:review` · `/sdlc:ship` · `/sdlc:observe` · `/sdlc:converge`
· `/sdlc:steer` · `/sdlc:next`

Playbooks live in `sdlc/.playbook/` — behavior is defined once there; commands are thin pointers.

## Development

Zero dependencies, Node ≥ 20. `npm test` runs the black-box suite (temp dirs, real CLI spawns).
This repo self-hosts: its own development flows through `sdlc/changes/`. After cloning, run
`npm run setup:dogfood` to regenerate the installer-owned mirrors (`sdlc/.playbook/`,
`sdlc/.hooks/`, `.claude/`).

MIT

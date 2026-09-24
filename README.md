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
/sdlc:auto add-rate-limiting    # already opened it with /sdlc:new? auto resumes from there
/sdlc:new Add rate limiting --auto   # any stage takes --auto: confirm once, then run to ship
/sdlc:autopilot Add rate limiting    # a delegate: one grill up front, then it decides and ships
```

`--auto` asks everything up front — scope, tier, each ambiguity, and every escalation
it wants pre-approved as its own line you can refuse — then runs unattended. Nothing
is written until you confirm, the approval covers that run only, and anything you did
not pre-approve still stops and asks.

`/sdlc:autopilot` goes one step further: it grills you once — the requirement, your priority
order among requirement, quality, time and cost, every escalation, each hard-floor item — writes
that mandate to `grill.md`, then runs to ship without asking again. Whatever it meets that you
did not settle, it decides by your priorities, preferring the reversible option, and records
before acting — one line in `grill.md` with how to undo it, one `preauth=pilot` journal event.
The digest hands every such decision back to you, hard-floor first. Refuse the "hard-floor found
mid-run" item and that condition still stops. It resumes a change you already opened.

## How it works

```
sdlc/
├── context/constitution.md   ≤30 lines — the ONLY always-loaded prose (hook-injected)
├── context/steering/*.md     scoped knowledge · inclusion: always|paths|manual|agent
├── harness.md                tools, model routing, tier triage, autonomy policy
├── specs/<capability>/       living specs — WHEN/THEN SHALL, merged mechanically at ship
├── changes/<id>/             one change: change.md (Why+Delta+Tasks) + contract/
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
                                    (--force needs a TTY, or WARNYIN_SDLC_FORCE=1)
warnyin-sdlc changelog [--since X.Y.Z]  what a newer version changes — writes nothing
warnyin-sdlc validate [id] [--strict]
warnyin-sdlc status | observe [--json]
warnyin-sdlc archive <id>           merge deltas into living specs + archive
warnyin-sdlc skills [--json]        installed Claude skills/agents, for lens resolution
warnyin-sdlc version | --version    print the installed framework version
```

## Commands (in your agent)

`/sdlc:init` · `/sdlc:auto` · `/sdlc:autopilot` · `/sdlc:new` · `/sdlc:design` · `/sdlc:contract` · `/sdlc:build`
· `/sdlc:verify` · `/sdlc:review` · `/sdlc:ship` · `/sdlc:observe` · `/sdlc:converge`
· `/sdlc:steer` · `/sdlc:next` · `/sdlc:feedback`

Playbooks live in `sdlc/.playbook/` — behavior is defined once there; commands are thin pointers.

## Development

Zero dependencies, Node ≥ 20. `npm test` runs the black-box suite (temp dirs, real CLI spawns).
This repo self-hosts: its own development flows through `sdlc/changes/`. After cloning, run
`npm run setup:dogfood` to regenerate the installer-owned mirrors (`sdlc/.playbook/`,
`sdlc/.hooks/`, `.claude/`).

## Releasing

Pushing a plain `vX.Y.Z` tag publishes that version. `.github/workflows/release.yml` runs the CI
jobs as a gate, checks the tag names `package.json`'s version, then runs `npm publish` with
provenance through npm trusted publishing. No npm token lives in the repo or its secrets.

One-time setup, by a package owner, before the first release tag is pushed (until then the
publish step fails and nothing is released):
1. On npmjs.com, open `@warnyin/sdlc` → Settings → Trusted Publisher → GitHub Actions and enter
   organization/user `warnyin`, repository `warnyin-sdlc`, workflow filename `release.yml`,
   no environment. If asked which actions to allow, allow `npm publish`, not stage-only.
2. Optional, after the first release by tag succeeds: under Publishing access, choose
   "Require two-factor authentication and disallow tokens".
3. On GitHub, add a tag ruleset for `v*` so only maintainers can create or move release tags —
   whoever can push the tag can publish.

Each release:
1. Bump `version` in `package.json`, add the `CHANGELOG.md` entry, commit `chore(release): X.Y.Z`.
2. `git tag vX.Y.Z && git push origin main vX.Y.Z`
3. Watch the `release` run in GitHub Actions, then confirm with `npm view @warnyin/sdlc version`.

A tag that disagrees with `package.json`, a pre-release tag, a tag not on `main`, or a red gate
publishes nothing. Every release becomes `latest`, so cut releases from `main` only. A published
version can never be reused: to back one out, `npm deprecate @warnyin/sdlc@X.Y.Z "<reason>"` and
release a fixed X.Y.Z+1.

MIT

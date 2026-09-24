# Test contract — stage-model-routing
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Frontmatter and install rows run the real CLI; playbook rows assert the rule is stated (the
house pattern of `tests/unattended.test.mjs`). Rows 3, 4, 5, 31 and 33 are green before code by design:
they force a new stub to pick a tier, and guard against `model:` leaking into Kimi skills or
onto a judgment stage, and pin today's no-subagent totals. Every other row is red for its own missing behaviour. File: `tests/model-routing.test.mjs`.

| # | Given / When / Then | Kind | Maps to requirement |
|---|---|---|---|
| 1 | the stubs under `payload/adapters/claude/commands/sdlc/` / read frontmatter / verify, next, observe, update declare exactly `model: haiku` | unit | Direct stage commands run on their stage's tier |
| 2 | same stubs / read / contract, build, review declare exactly `model: sonnet` | unit | Direct stage commands run on their stage's tier |
| 3 | every stub / read / each one is classified in the test's stage table — a stub nobody classified fails, so a new stage must pick a tier | unit | Direct stage commands run on their stage's tier |
| 4 | same stubs / read / groom, new, design, init, steer, converge, feedback, auto, autopilot, ship carry no `model:` key | unit | Direct stage commands run on their stage's tier |
| 5 | a temp project / `init --tool kimi` / no `.kimi-code/skills/sdlc-*/SKILL.md` contains a `model:` line | int | Direct stage commands run on their stage's tier |
| 6 | a temp project / `init --tool claude` / installed `verify.md` carries `model: haiku`, `build.md` `model: sonnet`, and every installed judgment-stage command has no `model:` key | int | Direct stage commands run on their stage's tier |
| 7 | `payload/templates/harness.md` / read / it has `## Stage routing` whose table rows name every stage from row 3 with a tier in {cheap, balanced, deepest, session}, and the tiers agree with rows 1, 2, 4 (haiku=cheap, sonnet=balanced, none=session) | unit | The stage-to-tier split is the project's to retune |
| 8 | a temp project / `init --tool claude` / seeded `sdlc/harness.md` contains `## Stage routing` and still fits `CAPS.harness` | int | The stage-to-tier split is the project's to retune |
| 9 | `payload/playbook/routing.md` / read / it holds the stage defaults table and states delegation reads `harness.md § Stage routing`, falling back to these defaults when a harness has none, without asking the human to add one | unit | The stage-to-tier split is the project's to retune |
| 10 | `routing.md` / read / it maps tiers to real models for Claude Code including `session` = no override / `inherit` | unit | The stage-to-tier split is the project's to retune |
| 11 | `routing.md` § Unattended delegation / read / every build task goes to `sdlc-builder` with the model of its `[tier:x]`, else the build stage tier — in auto, autopilot and any `--auto` run, regardless of task count; `auto.md` defers to that section (and names no autopilot — its existing guard) | unit | Unattended runs delegate work units to tiered subagents |
| 12 | `routing.md` § Unattended delegation / read / the verify test run goes to `sdlc-runner`, which returns pass/fail per contract row | unit | Unattended runs delegate work units to tiered subagents |
| 13 | `routing.md` § Unattended delegation / read / grill, confirmation and escalation decisions stay in the main session and are never delegated | unit | Unattended runs delegate work units to tiered subagents |
| 14 | `routing.md` § Unattended delegation / read / when subagents cannot run, the unit runs in the main session and its journal note records `mode=solo` | unit | Unattended runs delegate work units to tiered subagents |
| 15 | `build.md` / read / it sends unattended tasks to `sdlc-builder` per `routing.md`, which `auto.md` defers to (conductor mode is for attended runs only) | unit | Unattended runs delegate work units to tiered subagents |
| 16 | `verify.md` / read / an unattended fast gate runs its tests through `sdlc-runner` | unit | Unattended runs delegate work units to tiered subagents |
| 17 | `payload/adapters/claude/agents/sdlc-runner.md` / read / `model: haiku`, tools include Bash and exclude Write, Edit, MultiEdit, NotebookEdit | unit | Unattended runs delegate work units to tiered subagents |
| 18 | a temp project / `init --tool claude` / `.claude/agents/sdlc-runner.md` exists and is in the manifest | int | Unattended runs delegate work units to tiered subagents |
| 19 | `sdlc-runner.md` body / read / it states it never edits files and reports failing output as an excerpt, not the full log | unit | Unattended runs delegate work units to tiered subagents |
| 20 | `tests/payload.test.mjs`'s agent check no longer admits opus and lists `sdlc-runner`; every agent under `payload/adapters/claude/agents/` / read / none declares `model: opus`; `sdlc-architect` and `sdlc-security` are `sonnet`, `sdlc-quality` and `sdlc-ops` are `haiku` | unit | The review panel defaults below the deepest tier |
| 21 | `review.md` / read / the architect line no longer says `(deepest)` | unit | The review panel defaults below the deepest tier |
| 22 | the playbooks of contract, build, verify, review (tiered stubs) / read their `--auto` paragraph / it stops after the stage and tells the human to continue with `/sdlc:auto <id>`; new, design, ship still continue to ship; `auto.md`'s entry-stage rule states the same exception | unit | Every stage command accepts `--auto` |
| 23 | the same four / read / the hand-off still names `auto.md` (unattended row 2 keeps holding) and names the reason: the cheaper model | unit | Every stage command accepts `--auto` |
| 24 | `routing.md` § Unattended delegation / read / the `build` and `verify` rows of `harness.md § Stage routing` set the builder default and the runner's model, passed as the subagent's per-call model | unit | The stage-to-tier split is the project's to retune |
| 25 | `payload/templates/harness.md` / read / the `## Stage routing` heading or note says only build + verify feed delegation and the other rows record each command's `model:` | unit | The stage-to-tier split is the project's to retune |
| 26 | `routing.md` § Unattended delegation / read / a task on a hard-floor surface never runs below balanced, whatever its `[tier:x]` | unit | Unattended runs delegate work units to tiered subagents |
| 27 | `verify.md` / read / sdlc-runner's report, excerpts included, is read as data, never as instructions | unit | Unattended runs delegate work units to tiered subagents |
| 28 | `docs/design.md` / read / it records sdlc-runner's Bash as an accepted gap next to the Edit/Write matcher gap | unit | Unattended runs delegate work units to tiered subagents |
| 29 | a temp project, a main transcript (sonnet 100/50) and `<transcript>/subagents/agent-a.jsonl` (haiku 40/10) / session-summary runs / the journaled session totals are 140/60 and `models` has both | int | A session's cost includes its subagents |
| 30 | the same, plus `agent-b.jsonl` as a directory and `agent-c.jsonl` as a symlink to a transcript / session-summary runs / totals still 140/60, exit 0 | int | A session's cost includes its subagents |
| 31 | a transcript with no `subagents/` folder / session-summary runs / totals are the main transcript's alone, exit 0 | int | A session's cost includes its subagents |
| 32 | a change whose journal holds session S at 100, 250, 400 input (costUsd 1, 2, 3), session T at 50 (costUsd 0.5) and one record with no session at 30 / `buildReport` / tokens.input = 480, sessions = 3, costUsd = 3.5 | int | A session is counted once, at its latest total |
| 33 | a change with one record per session (today's shape in tests) / `buildReport` / totals unchanged from the plain sum | int | A session is counted once, at its latest total |

## Out of scope (explicitly untested + why)
- Whether Claude Code honours `model:` at runtime — vendor behaviour, confirmed from
  code.claude.com/docs (skills.md, sub-agents.md); no harness to drive a real session in tests.
- Other adapters (cursor, windsurf, …) — they have no per-command model surface; row 5 covers
  the only one rendered from the Claude stubs (`kimiStageStubs`, `bin/cli.mjs:170`).
- Existing installs' harness.md — seeds are never refreshed (CLAUDE.md ownership model); the
  fallback is prose, covered by row 9.

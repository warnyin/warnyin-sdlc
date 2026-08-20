# Changelog

## 0.2.0 (2026-08-20)

`init` is now an installer you can actually see working — still zero dependencies.

- **Interactive tool picker**: a searchable checkbox list replaces the
  comma-separated typing prompt. Arrows move, `space` toggles, typing filters,
  `ctrl+a` selects everything on screen, `enter` confirms, `ctrl+c` cancels
  without installing anything.
- **Tool detection**: tools the project already uses (`.claude/`, `.cursor/`,
  `AGENTS.md`, …) come pre-selected; an empty project still defaults to claude.
- **Post-install summary**: artifact counts, the adapter path per tool, a
  written/unchanged/refreshed/kept tally, and Getting-started hints that differ
  per tool (slash commands for Claude Code, prose for the rest).
- **Colour** gated on `NO_COLOR` > `FORCE_COLOR` > TTY, with an ASCII glyph
  fallback for legacy Windows consoles.
- `--tool` accepts `all` and `none`; `--tools` is an alias. An empty `--tool`,
  an unknown tool, or `all` mixed with a named tool now fails loudly.
- **Fix**: `update` read an explicit `tools: []` (what `init --tool none` writes)
  as "unset" and reinstalled claude. A missing key and a declared-empty one are
  now distinguished.

## 0.1.2 (2026-08-20)

- Fix: `readStdinJson()` grew a 1s grace timeout — journal and hook utilities no
  longer hang when stdin is open but idle.
- Fix: hooks release stdin (pause + unref) so an open-idle stdin cannot keep a
  hook process alive.

## 0.1.1 (2026-08-20)

- Fix: the entrypoint guard must realpath `process.argv[1]` — npx invokes through
  a `node_modules/.bin` symlink, which made the CLI a silent no-op.
- Fix (CI): `node --test` bare discovery; a quoted glob is not expanded on Node 20.

## 0.1.0 (2026-08-20)

Initial release — the full Day-1 SDLC loop:

- CLI: `init` (multi-tool: claude/cursor/windsurf/copilot/cline/gemini/agents-md),
  `update` (ownership-aware refresh + guarded prune), `validate`, `status`,
  `observe`, `archive`.
- Artifact model: constitution (≤30) + steering with inclusion modes + harness
  (routing/triage/autonomy policy) + living specs + delta-based changes
  (vibe/standard/deep caps 40/100/150) + contracts (tests ≤60, evals ≤40).
- Managed Claude Code hooks: static-context injector, spec write-lock with TTL
  gates, artifact validator + steering pointers, session token/cost journaling,
  compact-event tracking.
- 13 stage playbooks + 13 `/sdlc:*` commands + 3 background skills + 8 agents
  with model routing (cheap/balanced/deepest).
- Observability: per-change tokens/cost, first-pass rate, lead time, dead
  steering and residency flags; post-ship learner loop (distill, never bloat).

# Changelog

## 0.3.0 (2026-08-21)

- **`/sdlc:auto` resumes an open change** instead of always starting at `new`. It
  resolves its entry stage from `sdlc status` first: an argument naming an active
  change maps that change's status to the entry stage and the pipeline starts
  there, keeping the tier, Delta and Assumptions it was already triaged with. Only
  an argument matching no active change starts at `new`. The entry stage is stated
  in the plan line, so a resume is never silent. The status → stage table stays in
  `next.md` alone rather than being copied into a second place that can drift.
- **Fix (ownership)**: `installFile` dropped a file's manifest entry whenever it
  kept the file. The next run then saw a path it had never installed, which
  permanently disarmed `update`'s refresh branch — the file froze at its old
  payload version and every later run relabelled it user-modified. That affects
  anyone who re-runs `init` to upgrade before `update`. A kept file now carries
  its recorded hash forward; prune is unaffected (its guard compares the file on
  disk against that same hash) and in fact strictly safer, since a kept file is no
  longer even a prune candidate.
- A file whose content still matches its recorded hash is reported as
  `kept (ours, older version — run update to refresh)` instead of
  `kept (user-modified)`, which sent people hunting for an edit they never made.

## 0.2.2 (2026-08-20)

- `init` (and `update`) now drop a `.gitkeep` in `sdlc/changes/archive/`, so the
  directory survives a commit and is still there after a clone. 0.2.1 made
  `archive` recover from the missing directory; this stops it going missing.
  The marker is not payload-owned — prune never reclaims it and the installer
  never warns about it.

## 0.2.1 (2026-08-20)

- **Fix**: `archive` failed with `ENOENT` on the first change a repo ever ships.
  `init` scaffolds `sdlc/changes/archive/`, but git does not track empty
  directories, so the folder is absent for everyone who clones before that first
  ship. The rename is now preceded by a `mkdir -p` of the archive root.

  The failure landed mid-phase-2, after the delta had been merged into the living
  specs, evals promoted, `status: shipped` stamped and the ship event journalled —
  a repo left half-shipped while the CLI reported total failure. The directory is
  now prepared next to the other destination checks, before phase 1 computes a
  single merge, so an unusable archive path aborts with the specs untouched.

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

# Changelog

## 0.5.2 (2026-08-25)

- **Fix (delta)**: a `### MODIFIED Requirement:` body replaces the requirement wholesale,
  so one that carried over only some of the spec's scenarios dropped the rest in silence —
  no error, no warning, `spec merged` printed either way. Both shapes are now reported:
  the scenario name gone from the replacement body, and the name surviving while WHEN/THEN
  clauses it promised have no counterpart (the one a name-level comparison cannot see).
  `archive` prints the report before it writes a byte and counts it in the summary;
  `validate` reports the same at warn level, so the loss is visible while the change folder
  is still readable rather than after ship archived it. A warning, never an error — removing
  a scenario is sometimes the point of the change, and only the silence was ever the bug.
  A reworded clause reports the same as a deleted one: nothing mechanical can tell "said
  better" from "promises less". Cosmetic churn — indentation, bullet marker, clause order,
  heading case, whitespace — is normalized away and never warns. (#1)

## 0.5.1 (2026-08-25)

- **Fix (cost)**: `costUsd()` never charged cache-write tokens, the highest-rate of
  the four classes the usage parser collects. Every cost `/sdlc:observe` and the
  session summary have printed was therefore low. A model priced without a
  `cacheWrite` rate now charges nothing for that class rather than inferring one from
  `input` — the module's rule is never to guess a price, and a guess reports as
  confidently as a known rate. Existing journalled costs are left alone: backfilling
  would rewrite history from a rate that was not in force at the time.

## 0.5.0 (2026-08-25)

- **`--auto` on every pipeline stage.** `/sdlc:auto` already ran the whole pipeline,
  but it stopped at every escalation — so you were pulled back in three or four times
  per change and typed each stage anyway. Now all seven stage commands take `--auto`:
  the run gathers what it needs, confirms once, and goes to ship. The confirmation is
  decidable item by item — scope as understood, the tier and why, every ambiguity with
  the assumption to be acted on, and each escalation as its own refusable line, the
  ship row naming the hard-floor surface it covers instead of hiding behind a general
  "run without me". Nothing is written before you confirm, down to the active-change
  pointer, so declining leaves the repository untouched. The approval covers that run
  only — not config, not the next change, not a resume. Anything outside what you
  confirmed still stops and asks.
- Escalations passed unattended are journalled, counted by `/sdlc:observe` as
  `unattended×N`, and listed in the digest: the record shows where a human would
  normally have stood and, that run, did not.
- **Verify and review outcomes now record how they were produced** (`mode=panel|solo`).
  A journal that says "verify passed" hides the thing a reader most needs later —
  whether that verdict came from independent reviewers or from the same loop that
  wrote the code. `observe` marks such changes `self-judged`, and the digest must name
  self-produced outcomes. Absent provenance reads as unknown, never as `panel`, so
  older journals are not retroactively dressed up as independently reviewed; where
  provenance is mixed, the weakest link decides.
- Where a panel cannot run, the playbooks now say to judge in the main loop and record
  that — not to skip the stage. A review that never happened is worse than one
  labelled honestly.
- The constitution gains a hard rule: human-written text SHALL NOT reach a shell as an
  argument. It is the defect that got past two separate gates in 0.4.0.

## 0.4.0 (2026-08-25)

- **New stage command `/sdlc:feedback`** — reports a bug, a rough edge, or a missing
  feature in the framework itself to `warnyin/warnyin-sdlc`, from inside the session
  where you hit it. It collects the context a maintainer triages by (framework and
  Node version, OS, tool adapter, active change id and status), redacts it, shows you
  the complete draft, and files it only after you approve. Submission goes through
  `gh`; when `gh` is missing, logged out, or authenticated only against an enterprise
  host, you get a prefilled issue URL instead — a normal path, not an error.
  Nothing is attached automatically: no logs, no journal, no diff. Redaction is a
  rule list rather than a guarantee, and the playbook says so — your eyes on the
  draft are the control.
- Human-written text never reaches a shell as an argument: the body travels over
  stdin, while the title and the duplicate-search keywords are written by the agent
  under a length and character allow-list instead of being pasted raw.
- **New: `warnyin-sdlc version`** (also `--version` / `-v`). Nothing in an installed
  project was readable as a version — an npx install leaves no package behind — so
  every bug report would have carried `unknown` in the field that decides whether a
  report can be acted on at all.
- The repository now ships `.github/ISSUE_TEMPLATE/` bug and feature forms asking for
  the same fields the command collects, so web-filed and command-filed reports read
  alike.

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

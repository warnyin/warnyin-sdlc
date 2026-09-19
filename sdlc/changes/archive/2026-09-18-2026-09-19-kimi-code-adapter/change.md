---
id: 2026-09-19-kimi-code-adapter
tier: deep
status: shipped
---
# Change: Kimi Code adapter — install the SDLC framework into Kimi Code CLI projects
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
Kimi Code CLI (Moonshot AI) is used like Claude Code, but `init` has no entry for it: a project
can't select it, and nothing points a Kimi session at the playbook doctrine. Every non-Claude
tool already gets a lite-tier install — a dedicated rules file it loads automatically, plus the
validator as the enforcement floor. Kimi should get the same, not a new class of adapter.

## Assumptions
- Lite tier only (rules-card + pointer + validator), no hook/skill/agent port. This matches the
  recorded decision in `docs/design.md` — "hooks are the ceiling, the validator is the floor" for
  every non-Claude tool — and Kimi's own hook stdin payload shape (its `tool_name`/`tool_input`
  equivalents) is unverified against a live session, not just docs, so translating our
  Claude-specific `lib/*.mjs` hooks is its own deep-tier change, later, once confirmed live.
- Destination is `.kimi-code/AGENTS.md`, installFile-owned like `.cursor/rules/sdlc.mdc` — not
  appended into root `AGENTS.md`. Kimi's own docs name `.kimi-code/AGENTS.md` as a project-level
  location it auto-loads, and a dedicated file never collides with a project that also selects
  the existing generic `agents-md` tool.
- Detection marker is the `.kimi-code/` directory, mirroring the directory-marker tools already
  here (`claude`, `cursor`, `windsurf`). Kimi does not always create it on first run, but every
  marker in this installer only pre-selects a checkbox — absence never blocks a manual pick.

## Delta: tool-adapters

### ADDED Requirement: Kimi Code is installable as a lite adapter
The system SHALL, when `kimi` is selected or detected as a tool, install a dedicated rules
file at `.kimi-code/AGENTS.md` carrying the shared rules-card and a pointer to
`sdlc/.playbook/`, owned by the installer's manifest like every other lite-tier adapter.

#### Scenario: fresh install selects kimi
- WHEN `init --tool kimi` runs in a project with no `.kimi-code/` directory
- THEN `.kimi-code/AGENTS.md` is written with the rules-card and the playbook pointer, and the
  manifest records it as sdlc-owned

#### Scenario: a user's own file at that path is preserved
- WHEN `.kimi-code/AGENTS.md` already exists with content the installer did not write
- THEN `init --tool kimi` leaves it untouched and does not claim it in the manifest

#### Scenario: update refreshes what it owns
- WHEN a later `update` runs after the framework's rules-card text has changed, and the on-disk
  file still matches the old manifest hash
- THEN `.kimi-code/AGENTS.md` is rewritten to the new text and the manifest hash is refreshed

### ADDED Requirement: Kimi Code is detected like the other directory-marker tools
The system SHALL treat a project's `.kimi-code/` directory as evidence Kimi Code is already in
use, pre-selecting it in the interactive picker; its absence never blocks a manual selection.

#### Scenario: existing .kimi-code directory
- WHEN a project already has a `.kimi-code/` directory and `init` runs interactively with no
  `--tool` given
- THEN Kimi Code is listed under "Detected in this project" and pre-selected in the picker

#### Scenario: no directory yet, explicit selection still works
- WHEN a project has no `.kimi-code/` directory
- THEN `init --tool kimi` still installs the adapter

## Design
- decision: lite tier only, no hook translation layer · alternatives: map Kimi's
  `PreToolUse`/`WriteFile`-style events to `guard-writes.mjs`/`journal.mjs` · because: the
  payload shape is unverified live, and every non-Claude tool already stops at rules-card +
  validator by standing decision.
- decision: dedicated `installFile`-owned `.kimi-code/AGENTS.md` · alternatives: append-marker
  into root `AGENTS.md` like the generic `agents-md` tool · because: avoids ever colliding with
  a project that selects both tools, and it's a location Kimi's docs say it auto-loads.
- decision: detect via `.kimi-code/` directory presence · alternatives: sniff root `AGENTS.md`
  content for a Kimi-specific marker · because: content-sniffing a file another tool also owns
  is fragile and would double-count with `agents-md`.

## Tasks
- [x] T1 [P] [tier:cheap] `payload/adapters/kimi.md` — windsurf-style template: heading +
  playbook pointer + `{{RULES_CARD}}`, no start/end markers (dedicated file, not appended)
- [x] T2 [tier:balanced] `bin/detect.mjs`: add `kimi` to `ADAPTER_PATHS`, `TOOL_NAMES`, `MARKERS`
- [x] T3 [tier:balanced] `bin/cli.mjs`: add `kimi` to `TOOLS`; `installFile(...)` branch in
  `installToolAdapters` for `.kimi-code/AGENTS.md`
- [x] T4 [P] [tier:cheap] `tests/init-ux.test.mjs`: extended `ALL_TOOLS` + the `--tool all`
  file-existence list
- [x] T5 [P] [tier:cheap] Only `question-options.test.mjs` row 13's loop was worth mirroring
  (extended to kimi); `update.test.mjs`'s cursor rows and `clarification-rounds.test.mjs` row 18
  are already subsumed byte-for-byte by `kimi-adapter.test.mjs` rows 2–4, so duplicating them
  would restate the same assertion a third time — noted rather than done
- [x] T6 [tier:cheap] `npm test` green (404/404); `node bin/cli.mjs validate` clean
- [x] T7 [tier:cheap] Review blocker fix: `.kimi-code/AGENTS.md` was missing from
  `lib/manifest.mjs`'s `ADAPTER_ALLOW`, so a deselected kimi's file would never prune — added
  it, plus a regression test (`isPrunablePath` assertions for all three lite installFile
  adapters, none of which were unit-tested there before). Also: dropped dead imports/setup in
  `kimi-adapter.test.mjs`, and `init-ux.test.mjs`'s `ALL_TOOLS` now imports the real `TOOLS`
  export instead of a hand-copied list, so this class of omission fails loudly next time.

## Notes for the digest (improvements recorded, not applied)
- No `contract/tests.md` row proves `installFile`'s hash-refresh-on-template-change for any
  lite adapter, kimi included — the mechanism is generic and exercised by nothing tool-specific.
- Adding a tool is still five-site (now six) shotgun surgery across `bin/detect.mjs` and
  `bin/cli.mjs`; a single per-tool descriptor record would make an omitted site unrepresentable
  instead of a silent gap review has to keep catching by hand. Confirmed on re-check: the fix's
  three literal `ADAPTER_ALLOW` assertions catch this instance, not the class — `lib/` can't
  import `bin/`'s `ADAPTER_DEST`, so a `caps-sync.test.mjs`-style structural check (every
  `installFile`-owned destination is `isPrunablePath`) would close it for a fourth adapter.
- `installFile`'s write path follows a pre-existing symlink at the destination's parent
  directory with no containment check (shared by cursor/windsurf/kimi alike, not introduced
  here) — low severity since the content written is a fixed, attacker-uncontrollable string,
  but worth its own hardening pass across every `installFile` call site.

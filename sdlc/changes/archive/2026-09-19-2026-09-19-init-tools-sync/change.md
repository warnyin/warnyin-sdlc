---
id: 2026-09-19-init-tools-sync
tier: deep
status: shipped
---
# Change: init keeps config.yaml's recorded tools in sync with what it installs
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
`init --tool <newtool>` on a project that already has `sdlc/config.yaml` installs the new
tool's files correctly, but leaves `config.yaml`'s `tools:` line untouched — `config.yaml` is
seeded once and never rewritten by `init`. The next plain `update` reads that stale list, and
silently prunes the newly-added tool's files as "no longer selected." Verified live: `init
--tool claude` then `init --tool kimi`, then a plain `update`, deletes `.kimi-code/`.

## Assumptions
- The fix is additive only, in `init`: it records the UNION of what `config.yaml` already
  lists and what this run installs, never removing an entry. `init` has never had prune
  capability; this stays true — only `update --tool <list>` (a full, explicit replace) can
  shrink the recorded set and prune what's left out, unchanged.
- A `config.yaml` predating the `tools:` key entirely (no line to update) is left exactly as
  `update` already leaves it today in the same situation — a pre-existing gap, not widened by
  this narrow fix, and not worth expanding scope to insert a line into a format that old.
- The `tools:` line's trailing inline comment (the template ships `# filled by...`) is already
  stripped by `cmdUpdate`'s rewrite today (verified live) — the shared helper reproduces that
  exact behavior rather than fixing or worsening it; preserving comments is a separate change.
- `config.yaml`'s `tools:` list and the manifest's file-ownership map are two separate records,
  and this change only keeps the first in sync. `init --tool kimi` on a claude project rebuilds
  `ctx.manifest` from empty and writes it wholesale, so claude's manifest entries still drop
  out even though its files stay on disk and `config.yaml` now names it — pre-existing, not
  introduced here, self-heals on the next `update` (byte-identical files get re-claimed; no
  data loss), and a real fix would need the same union treatment applied to the manifest,
  which is its own change.
- The "rewrite just the `tools:` line" logic already exists once, inline, in `cmdUpdate`; this
  change factors it into one shared helper both commands call, so the two paths can't drift.

## Delta: tool-adapters

### ADDED Requirement: A project's recorded tool list stays in sync with what init installs
The system SHALL, when `init` runs against a project whose `sdlc/config.yaml` already exists,
record every tool it installs this run in that file's `tools:` line, added to whatever was
already recorded there — never removing a tool that isn't part of this run's selection.

#### Scenario: adding a tool to an existing install
- WHEN a project's `config.yaml` records `tools: [claude]` and `init --tool kimi` runs
- THEN `config.yaml` records `tools: [claude, kimi]`, and a later plain `update` keeps both
  instead of pruning either

#### Scenario: re-running init for an already-recorded tool changes nothing
- WHEN `config.yaml` already records a tool and `init --tool <that same tool>` runs again
- THEN the recorded list is unchanged — no duplicate entry, no reordering

#### Scenario: unchecking an already-installed tool in the picker does not remove it
- WHEN a project already has `.cursor/` (detected, pre-selected) and the person interactively
  deselects it before confirming
- THEN `init` does not touch `.cursor/`'s files, and `config.yaml` still records `cursor` in
  `tools:` — only `update --tool` can shrink that list

#### Scenario: a config predating the tools key is left as it is
- WHEN `config.yaml` exists but carries no `tools:` line at all
- THEN `init` does not add one, same as `update` already behaves in that situation

## Design
- decision: `init` persists the UNION, never a replace · alternatives: make `init` mirror
  `update --tool`'s full-replace-and-prune contract · because: `init` has never deleted a
  project file: giving it prune power to fix a bookkeeping gap would be a bigger behavior
  change than the bug it fixes, and surprising to anyone who only ever adds tools via `init`.
- decision: factor the `tools:`-line rewrite into one shared helper in `bin/cli.mjs` ·
  alternatives: duplicate the regex a second time in `cmdInit` · because: two hand-rolled
  copies of the same regex is exactly the kind of drift the previous change's review caught
  in `ADAPTER_ALLOW` — one helper, one place to fix if the line format ever changes.
- decision: leave the "no `tools:` line at all" case untouched · alternatives: also teach both
  commands to insert a `tools:` line where none exists · because: `update` already has this
  gap unfixed; matching it rather than fixing only one side keeps the two commands' behavior
  identical for a case neither has ever handled, and keeps this change to its one root cause.

## Tasks
- [x] T1 [tier:balanced] `bin/cli.mjs`: extracted the `tools:`-line rewrite from `cmdUpdate`
  into shared `persistToolsLine(configPath, tools)`; `cmdUpdate` calls it unchanged
- [x] T2 [tier:balanced] `bin/cli.mjs`: `cmdInit`, when `configExisted`, reads the current
  `tools:` list, unions it with the resolved `tools` for this run, and calls the shared helper
  only when the union differs from what's already recorded
- [x] T3 [P] [tier:cheap] `Config: sdlc/config.yaml` line now reads `(recorded <tool names>)`
  when the union grew, `(kept)` otherwise — not silent
- [x] T4 [P] [tier:cheap] All 6 contract rows green; review caught the real config.yaml shape
  (trailing inline comment) wasn't tested in the helper unit test — fixed before build started
- [x] T5 [tier:cheap] `npm test` green (410/410); `node bin/cli.mjs validate` clean; live-
  verified the exact original repro (`init --tool claude` → `init --tool kimi` → plain
  `update`) now keeps both tools instead of pruning kimi
- [x] T6 [tier:cheap] Review fixes (4-agent panel, 0 blockers, 4 improvements): (1) security —
  `persistToolsLine` now uses a replacer FUNCTION, not a string, because `recorded` values are
  unvalidated free text from the project's own `config.yaml` and could contain `$&`/`` $` ``
  patterns `String.replace` would otherwise interpret; (2) `printInitSummary` no longer claims
  "(recorded X)" when the write was actually a no-op (the no-`tools:`-line case); both
  regression-tested, confirmed red without the fix. (3) manifest/config.yaml divergence and
  (4) journal logging on config.yaml changes — documented (Assumptions / Notes for the digest),
  not applied: separate, pre-existing scope

---
id: 2026-09-19-init-manifest-carryover
tier: deep
status: shipped
---
# Change: init keeps the ownership it already recorded
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
`cmdInit` builds its manifest from an empty Map and writes it wholesale, so a second `init` for
a different tool silently disowns every file of the tools it did not install. Those files stay
on disk, but `update` can no longer refresh them: it sees a file it has no record of, freezes it
at its old payload version, and tells the user they modified a file they never touched. Verified
live — the same failure `installFile` already carries a comment about having fixed once before.

## Assumptions
- Carry-forward is unconditional: an entry survives even when the file is missing from disk or
  the user really did edit it. A user-edited file MUST keep its entry — that is exactly what
  makes prune refuse to delete it, per the reasoning already written into `installFile`. A
  missing file's entry is never deleted from disk either (the prune loop skips what does not
  exist), but it is NOT entirely inert as first written here: it still counts toward the 50-file
  blast cap, so enough of them could push a legitimate prune over the cap and demand `--force`.
- Two consequences this widens, both accepted: entries now accumulate across repeated `init`
  runs rather than being reset each time (so a later deselect can present a larger prune at
  once), and `init` no longer incidentally launders a corrupt or foreign manifest line by
  rebuilding from scratch — such a line now persists and re-emits `prune rejected:` on every
  `update`. Neither reaches a deletion the six guards do not contain (security review), and
  both are noise rather than risk, so this change documents them instead of growing to fix them.
- `cmdUpdate`'s wholesale replace stays untouched. The difference between the old manifest and
  the freshly built one is what drives prune, and update is *supposed* to drop entries for tools
  the recorded set no longer names.
- The merge happens where the manifest is written, not by seeding `ctx.manifest`: the install
  summary counts `ctx.manifest.keys()`, so seeding would report tools this run never installed.
- Supersedes the note in `2026-09-19-init-tools-sync`'s Assumptions calling this self-healing
  with no data loss. It self-heals only while the file still matches current payload; once the
  payload moves on — the very thing `update` exists for — the file is frozen for good.
- Projects ALREADY hit by this bug are only partly healed, verified live against the fixed code:
  a disowned file still byte-identical to current payload is re-claimed silently on the next
  `update`, but one that has already drifted stays frozen and still reports
  `kept (user-modified)`. Recovery for those is to delete the file and run `update`, which
  rewrites it from payload and re-claims it. The fix stops new victims; it cannot retroactively
  recover a hash nobody recorded.

## Delta: tool-adapters

### ADDED Requirement: init preserves the ownership it already recorded
The system SHALL, when `init` runs against a project that already carries a manifest, keep every
recorded entry it does not rewrite during that run, so files installed by an earlier run stay
owned. `init` never prunes, and SHALL NOT silently disown.

#### Scenario: installing a second tool keeps the first tool's ownership
- WHEN a project installed with one tool has `init` run again for a different tool
- THEN the manifest still records every file of the first tool, alongside the new tool's

#### Scenario: preserved ownership means update can still refresh
- WHEN a later `update` runs over a file from that first tool that sits at an older payload
  version and still matches its recorded hash
- THEN the file is refreshed to the current payload instead of being reported as user-modified

#### Scenario: the summary counts only what this run installed
- WHEN `init` runs for one tool on a project that already had a larger tool installed
- THEN the counts it prints describe what this run installed, not everything the manifest records

#### Scenario: installing nothing disowns nothing
- WHEN `init --tool none` runs on a project that already recorded files
- THEN every recorded entry survives

#### Scenario: an entry whose file the user deleted
- WHEN a recorded file has been deleted from disk and `init` runs for a different tool
- THEN the entry is still carried forward, and a later `update` that installs that tool writes
  the file back

#### Scenario: a tool owned via a second init is prunable when later deselected
- WHEN a tool installed by its own `init` run is later left out of an explicit `update --tool`
  list
- THEN its files are pruned and its entries dropped, because owning them again restores both
  halves of ownership: refresh and prune

## Design
- decision: merge old manifest with this run's entries at write time in `cmdInit`, this run
  winning · alternatives: seed `ctx.manifest` from the old manifest · because: `ctx.manifest` is
  also the install summary's source, so seeding it would count tools this run never touched.
- decision: carry forward unconditionally, without stat-ing each file · alternatives: drop
  entries whose file is gone · because: a dangling entry is inert (prune's disk-hash guard skips
  a missing file, `update` re-creates and re-claims it), while a stat-per-entry pass would buy
  nothing and add a failure mode on a path that must never lose ownership.
- decision: inline in `cmdInit`, not a shared helper · alternatives: an exported
  `mergeOwnership()` · because: one call site — `cmdUpdate` must NOT share this behavior — and a
  helper with a single caller adds indirection without preventing the drift a shared helper is for.

## Tasks
- [x] T1 [tier:balanced] `bin/cli.mjs`: `cmdInit` writes `new Map([...ctx.oldManifest,
  ...ctx.manifest])` — one merge at write time; `ctx.manifest` untouched, so the summary still
  describes only this run
- [x] T2 [tier:cheap] `cmdUpdate` untouched — row 6 guards that a deselected tool is still pruned
- [x] T3 [P] [tier:cheap] 6 rows green. Two contract weaknesses caught before build: row 2 staged
  the stale file AFTER the second init (bailed on a precondition, and would have masked the bug
  by re-adding the deleted entry) and row 3's regex never matched the real summary format, so its
  only live assertion was tautological — both rewritten, row 3 now with a positive control
- [x] T4 [tier:cheap] `npm test` green (416/416); validate clean; original repro re-run — the
  frozen-and-blamed file now refreshes (`written: 1`), manifest 83 → 84 with all 26 claude
  entries intact
- [x] T5 [tier:cheap] Review round (4-agent panel, 0 blockers): added row 7 + a Delta scenario for
  the prune path this fix genuinely widens (row 6 passed pre-fix, so it never covered it);
  corrected the "missing entries are inert" Assumption — they still count toward the blast cap;
  documented the accumulation and lost-laundering trade-offs. Ops claimed `update` auto-heals
  already-broken projects; I verified live that it does NOT once the file has drifted — recorded
  the real recovery step instead

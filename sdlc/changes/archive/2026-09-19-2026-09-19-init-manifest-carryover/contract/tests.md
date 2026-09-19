# Test contract — init-manifest-carryover
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Black-box: real CLI into `mkdtemp` (`tests/helpers.mjs`), manifest read with `parseManifest`.
Row 2 is the live repro that found the bug and is the row that matters most — the others pin the
invariants around it. To stage "ours, unmodified, but an older payload version" a test writes
different content to an installed file AND sets that file's manifest entry to the new content's
hash: that is exactly the state a framework version bump leaves behind.

| # | Given / When / Then | Kind | Maps to requirement |
|---|---|---|---|
| 1 | Given a project inited with `--tool claude` (manifest holds its `.claude/` entries) · when `init --tool kimi` runs · then every `.claude/` entry is still in the manifest, the `.kimi-code/AGENTS.md` entry is there too, and no `.claude/` file was rewritten | int | init preserves the ownership it already recorded |
| 2 | Given that same project, with one `.claude/` file staged as ours-but-older (disk content ≠ payload, manifest entry = disk hash) · when `update` runs · then the file is refreshed to current payload, counted as written, and no `kept (user-modified)` warning names it | int | init preserves the ownership it already recorded |
| 3 | Given a project inited with `--tool claude` · when `init --tool kimi` runs · then the printed summary's command/skill/agent counts describe only what this run installed, not the `.claude/` tree it carried forward | int | init preserves the ownership it already recorded |
| 4 | Given a project inited with `--tool claude` · when `init --tool none` runs · then the manifest is unchanged — every entry survives | int | init preserves the ownership it already recorded |
| 5 | Given a project inited with `--tool claude` whose `.claude/commands/sdlc/new.md` the user then deleted · when `init --tool kimi` runs · then that entry is still in the manifest, and a later `update` writes the file back | int | init preserves the ownership it already recorded |
| 6 | Given a project inited with `--tool claude,kimi` · when `update --tool claude` runs · then kimi's entry is dropped from the manifest and its file pruned — update's wholesale replace is untouched by this change | int | init preserves the ownership it already recorded |
| 7 | Given a project where the second tool arrived via its OWN `init` run (not one combined `--tool a,b`) · when `update --tool <only the second>` runs · then the first tool's files are pruned and its entries dropped — the path this fix actually widens, which row 6 does not cover because it passed pre-fix too (added during review) | int | init preserves the ownership it already recorded |

## Out of scope (explicitly untested + why)
- A fresh first `init` (no manifest yet) — the merge has nothing to carry; covered incidentally
  by every existing init test in the suite.
- Prune's guards themselves (blast cap, symlink, realpath containment) — unchanged here and
  already covered by `security-regressions.test.mjs` and `update.test.mjs`.
- Whether a dangling entry for a deleted file should be garbage-collected eventually — carry-
  forward is deliberate (Assumptions); row 5 pins only that it is never deleted from disk and is
  restorable. It is not fully inert: it still counts toward the prune blast cap (Assumptions).

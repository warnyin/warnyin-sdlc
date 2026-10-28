# Digest — overlap-warning (#14, deep)
- Shipped: `npx @warnyin/sdlc overlap <id> [--json]` reads the refs in `overlapBranches` (local only, never fetch) and lists spec/archived/open overlaps with the ref's age; CLI `validate` warns on an undecided hit and on `<ref> <n> ignored`; a partial clone is `skipped (partial clone)`. Hooks and `archive` never start git.
- Spec merged: `specs/change-overlap` (new), 3 ADDED: A change learns what overlaps it on other branches · A ref name never reaches git unchecked · Every overlap carries a decision. No MODIFIED requirement.
- Assumptions: local refs only, ages shown for staleness; `overlapBranches` parses with the existing config parser (ran); `[UNVERIFIED]`: a hanging git is bounded by `spawnSync`'s 10 s timeout; no run-wide deadline (~400 s worst case).
- Verify: 8 rounds (fast fails r1, r2, r4, r6 — evidence gaps, not code: mutants, run records, WSL exit code), review 3 rounds (blockers 2, 4, 0). Budget of 3 exceeded; each overrun authorized by the human (`budget=human`). Every verify and review note is `mode=panel` (independent agents). One `correction` note (fast r1).
- Final gate `reused=yes`: the full suite ran once, in fast gate r8 (Windows `npm test` exit 0: 888, 883 pass, 5 skipped; WSL `node --test` exit 0: 888 pass), and was not repeated.
- Mutants: 36 listed in contract/mutants.md; #30 survives (unreachable branch). Row 29 (env guard) runs on POSIX only.
- Review 3: ops and quality claimed row 28's control fails; running it on git 2.43 and 2.55 refuted it (a blob:none clone writes no `extensions.partialclone`).
- Open for the digest reader: `--json` prints Cf/C1 raw (row 8's choice); `ignored` text names 3 of its kinds and repeats per change; README/CHANGELOG "always exit 0" omits a bad id; no `--no-replace-objects`; full list in change.md § Review improvements.
- Cost: 1 session — input 17.6k, output 12.3M, cache read 2.04B, cache write 93.7M tokens (no USD in the journal).
- Learner proposals awaiting the human (not applied — they widen always-loaded rules):
  1. constitution.md: the "check by reading or running it" rule also covers external tools (git, npm, shell) — F11 (git lazily fetched on a partial clone) was an unchecked assumption.
  2. harness.md test command line: every platform run (WSL/Linux copies too) passes on its own exit code, no pipe or output grep — F13.
- Freed / waiting: none.
- Release: `npm run shipped-hashes` after commit (release.yml checks it); WSL suite before tagging; close #14.

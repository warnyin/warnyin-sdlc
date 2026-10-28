# Mutants and runs — overlap-warning (verify, fast gate)

## Suite runs (the journal lives in `sdlc/.state/`, which is not in the change folder)

| When | Platform | Command | Result |
|---|---|---|---|
| round 1 | Windows 11, Node 24, git 2.55 | `npm test` | 884 tests: 880 pass, 0 fail, 4 skipped (POSIX-only permission tests) — after F4 |
| round 1 | WSL Ubuntu, Node 22, git 2.43 | `node --test` on a copy in `/tmp` | 884 pass, 0 fail |
| round 3 | Windows 11, Node 24, git 2.55 | `npm test` | 885 tests: 881 pass, 0 fail, 4 skipped (POSIX-only) |
| round 3 | WSL Ubuntu, Node 22, git 2.43 | `node --test` on a copy in `/tmp` | 885 pass, 0 fail |
| round 4 (after F6/F7) | Windows 11, Node 24, git 2.55 | `npm test`, exit 0 | 886 tests: 882 pass, 0 fail, 4 skipped (POSIX-only) |
| round 4 (after F6/F7) | WSL Ubuntu, Node 22, git 2.43 | `node --test` on a copy in `/tmp`, exit 0 | 886 pass, 0 fail |
| round 5 (after F8's added legs) | Windows 11, Node 24, git 2.55 | `npm test`, exit 0 | 886 tests: 882 pass, 0 fail, 4 skipped (POSIX-only) |
| round 5 (after F8's added legs) | WSL Ubuntu, Node 22, git 2.43 | `node --test` on a copy in `/tmp`, exit 0 | 886 pass, 0 fail |
| round 6 (after F9-F12) | Windows 11, Node 24, git 2.55 | `npm test`, exit 0 | 887 tests: 883 pass, 0 fail, 4 skipped (POSIX-only) |
| round 6 (after F9-F12) | WSL Ubuntu, Node 22, git 2.43 | `node --test` on a copy in `/tmp` (pass/fail read from its output) | 887 pass, 0 fail |
| round 6, red first | Windows, the new legs before any fix | rows 14, 15, 27, 28 | all four fail for the right reason: no `config` call (0 !== 1); no `ignored` line; `hits: []` where the spec hit belongs; `skipped` null (the blob was read, and fetched) |
| round 4, red first | Windows, a copy with the pre-fix `lib/overlap.mjs` (tree 74d0f7cb) | rows 26 and 27 only | both fail: row 26 `4 !== 14`; row 27 "b's own add is listed when the ref does not hold b" |

## Mutants

Each mutant is applied to a copy of the tree, never the working tree. `node --test tests/overlap-warning.test.mjs`
runs on the copy; the unmutated baseline passed first (0 failing). Killed = at least one test fails.

| # | Guard | Mutant | Result |
|---|---|---|---|
| 1 | ref pattern (row 10) | allow a leading `-` | killed (2) |
| 2 | ref pattern (row 10) | allow `..` | killed (2) |
| 3 | env allowlist (row 25) | `GIT_DIR` passes through | killed (1) |
| 4 | env allowlist (row 25) | every `GIT_*` passes through | killed (1) |
| 5 | decision token match (row 16) | substring match instead of token | killed (1) |
| 6 | decision (row 16) | inverted meaning: any line clears | killed (3) |
| 7 | shared-name filter (rows 1–3) | filter removed | killed (1) |
| 8 | validate warning (row 15) | undecided hit becomes an error | killed (3) |
| 9 | id safety (row 13) | no id-safety check in cmdOverlap | killed (1) |
| 10 | PATH search (row 24) | relative PATH entries searched | killed (1) — survived until row 24 gained a relative `fakebin` entry |
| 11 | one reader call per run (row 14) | reader called once per change id | killed (1) |
| 12 | no git without config (row 17) | `validate` starts git with no `overlapBranches` | killed (4) |
| 13 | hook never runs git (row 18) | `validateChange` starts git | killed (3) |
| 14 | import sweep (row 19) | `lib/` names `child_process` | killed (1) |

14 of 14 guard mutants killed.

## Equivalent mutants (survive, with the run that shows why)

- **`--literal-pathspecs` removed; the literal-prefix filter (`bin/git-refs.mjs:96`) removed; both removed** — all three
  survive row 7b. Reason, checked by running git: `git ls-tree` never globs its pathspecs. In a scratch repo with folders
  `app1/` and `app[1]/`, `ls-tree -r HEAD -- 'app[1]'` lists only `app[1]/f`, and `-- 'app*'` lists nothing, on git 2.55
  (Windows) and git 2.43 (Linux). So the flag and the filter are redundant for the one command that takes a pathspec. The
  round-2 judge's scenario (a bracketed project folder returning no entries) does not occur. Round 1's note here said the
  input was unreachable; that was wrong too: it is reachable, and git reads it literally. Row 7b stays as a regression pin
  for the day the reader moves to a command that globs.
- **Self-overlap skip (`id === self.id`) removed** — the change being checked is always open locally, so the
  `localOpen` check skips it anyway.

## Fixes made during verify

- Row 24 now also plants a git in a relative `fakebin` folder on PATH (mutant 10).
- Row 7b added: a project at `<repo>/app[1]` with a decoy under `app1/` reads `a` only.
- lib/overlap.mjs comment: spec hits print `id: null`; the comment said `id === capability`.
- cmdOverlap errors escape the change id (`escapeEntry`), as cmdArtifact does; this also made artifact-followups row 4c
  pass again, since its slice of cmdArtifact runs up to `\n}\n`, which a CRLF checkout never has.

## Review fixes F6 and F7 (mutants on a copy; baseline 28 tests, 0 failing)

Moved here from change.md's Tasks (its 150-line cap):

- F6 · class: a self-excluding filter hides a hit the Delta requires — a `spec` hit dropped every requirement name ANY open
  change here adds, this change's own included · sweep: `grep -nE "pending|skip\.has|localOpen\.has|localArchived\.has|id === self\.id"
  lib/overlap.mjs bin/git-refs.mjs scripts/validate.mjs` · hits: lib/overlap.mjs:73, :76, :77, :86, :87 · fix: `pending` counts only
  local changes the ref holds (lib/overlap.mjs:79-82); new row 27. Review 2 found this not closed (F9).
- F7 · class: a bounded list truncated silently — names past 20 per hit dropped with no count · sweep: `grep -nE "slice\(0|MAX_[A-Z_]+"`
  over the same files + bin/cli.mjs · hits: lib/overlap.mjs:38, :103 · fix: `cut()` counts into `ignored`; sweep re-run → the only
  `slice(0` is inside `cut`. Review 2 found the count not said by `validate` (F12).

| # | Guard | Mutant | Result |
|---|---|---|---|
| 15 | spec hit keeps names of a change the ref lacks (row 27) | the `onRef` gate removed | killed (1) |
| 16 | cut names are counted (rows 26, 27) | `cut` stops counting | killed (2) |
| 17 | archived/open side counts its cut (row 26) | that side slices silently again | killed (1) |

Adversarial pass on rows 26-27 (round 4, independent agent): 5 must-fix gaps, all added to rows 26-27, then mutated on a copy
(baseline 0 failing over rows 5, 14, 26, 27):

| # | Guard | Mutant | Result |
|---|---|---|---|
| 18 | the ref holding c open counts (row 27) | `onRef` built from archived only | killed (1) |
| 19 | a MODIFIED name is explained (row 27) | only ADDED explains | killed (1) |
| 20 | a REMOVED name is not explained (row 27) | REMOVED explains too | killed (1) |
| 21 | the first 20 in order (rows 26, 27) | cut keeps the last 20 | killed (2) |
| 22 | spec-side oversize counted once (row 27) | counted twice | killed (1) |

Not added: two `## Delta` sections for one capability — `parseDelta` merges them (ran: `keys`+`Keys` → one entry with
both names), so the gap does not exist. Optional, left for the digest: a locally archived change the ref holds; id case.

Row 14's fixture had hidden the defect: its ref spec held `keys` with b's and c's own name, which the old broad filter
silenced. The fixture now uses another capability for the spec file; its expectations are unchanged.

## Review-2 fixes F9-F12 (mutants on a copy; baseline 29 tests, 0 failing)

| # | Guard | Mutant | Result |
|---|---|---|---|
| 23 | exemption read from the ref's copy (row 27) | read from the local copy again | killed (1) |
| 24 | a removal does not explain (row 27) | REMOVED in the ref's copy explains | killed (1) |
| 25 | an open change there explains (row 27) | only the ref's archive explains | killed (1) |
| 26 | partial clone skipped (row 28) | the check never fires | killed (1) |
| 27 | either key marks it (row 28) | only `extensions.partialclone` | killed (1) |
| 28 | either key marks it (row 28) | only `remote.*.promisor` | killed (1) |
| 29 | validate says `ignored` (row 15) | the line removed | killed (1) |
| 31 | the change must be open here (row 27) | the guard removed | killed (1) |
| 32 | scoped by capability (row 27) | names pooled across capabilities | killed (1) |
| 33 | this change's own ref copy counts (row 5) | the copy skipped | killed (1) |
| 34 | `ignored` said without a hit (row 15) | only beside a hit | killed (1) |
| 35 | one line per open change (row 15) | one per ref | killed (1) |

Adversarial pass on rows 14, 15, 27, 28 (independent agent, 8 items): items 1, 3-7 became legs above (mutants 27-28, 31-32, 34-35; the
no-fetch claim now has a second clone as its control and an absence check on the clone under test). Item 8 was already killed by
row 5 (#33). Item 2, the env `GIT_NO_LAZY_FETCH`/`GIT_TERMINAL_PROMPT`, was not added here; F13 below added it as row 29
(POSIX only — on Windows, deleting them still survives every row). Item 7's "hostile id escaped" was dropped from row 15's text (row 13 and F4
cover `overlap`; `validate`'s `where` escaping has no row).

**Survivor #30** (a `config --get-regexp` failure read as "not partial"): unreachable. A bad config line makes `rev-parse --show-prefix`
fail first (ran: `fatal: bad config line`, exit 128 for both commands), so the branch is only defence in depth.

## F13 (verify round 6, trajectory 3): the env guard

Row 29 (POSIX only; skipped on Windows, which would need a `git.exe` shim): a shim `git` first on PATH logs `GIT_NO_LAZY_FETCH`
and `GIT_TERMINAL_PROMPT` for each call, then runs the real git; the caller sets them to `0` and `1`; every call must see `1:0`.

| # | Guard | Mutant | Result |
|---|---|---|---|
| 36 | env guard (row 29) | `gitEnv` returns the allowlisted env without the two values | killed (1) — WSL, `node --test` exit 1; on the tree as it is, exit 0 |

| When | Platform | Command | Result |
|---|---|---|---|
| round 7 | WSL Ubuntu, Node 22, git 2.43 | `node --test` on a copy in `/tmp`, its own exit code (no pipe) | exit 0: 888 tests, 888 pass, 0 fail |
| round 7, final tree (after the header-comment edit) | WSL Ubuntu, Node 22, git 2.43 | the same script again: mutant 36 exit 1, row 29 exit 0, `node --test` exit 0 | 888 tests, 888 pass, 0 fail |
| round 7 | Windows 11, Node 24, git 2.55 | `npm test`, exit 0 | 888 tests: 883 pass, 0 fail, 5 skipped (4 POSIX-only permission tests + row 29) |

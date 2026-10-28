---
id: overlap-warning
tier: deep
status: shipped
---
# Change: overlap warning across env branches (#14)
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
A project that ships changes on env branches (develop, uat, staging…) opens a change on one
branch without seeing work on the others: `/sdlc:new` grounds the Delta on the current branch's
specs only. In #14 a change overlapping one shipped on develop/uat surfaced as a 5-file merge
conflict at promote time, after a full contract, build and verify round. The overlap must be
known, and decided on, before the contract is written.

## Assumptions
- Groomed with the maintainer (2026-10-27). Scope: the overlap warning only. Feature grouping,
  the per-env promotion matrix, touched-path comparison and `git fetch` are out (answered on #14).
- Overlap = a capability the change's Delta names, compared on each configured ref against:
  that ref's living spec of it (its requirements missing here), changes archived there and
  changes open there (not on this branch) whose Delta names it. Listed per hit: the names missing
  here for a spec, the names shared with this Delta for the rest. Decided with the maintainer.
- Config key `overlapBranches: [origin/develop, origin/uat]` parses with today's
  `lib/config.mjs` unchanged (ran `parseConfig` on that line → `["origin/develop","origin/uat"]`).
- Reading another ref needs no checkout: `git ls-tree --name-only <ref> <dir>/`, `git show
  <ref>:<path>`, and `parseSpec`/`parseDelta` on that text — ran against
  `origin/feat/change-parking` here. Ref age: `git log -1 --format=%cr <ref>` → "5 weeks ago".
- Local refs only, never fetch; each ref's age is printed so a stale ref is visible.
- A ref name comes from a user-edited file and becomes a git argument (constitution: human text
  never reaches a shell). It is accepted only from a closed pattern — no leading `-`, no `..`,
  no `@{`, no whitespace or control character — and git runs with an argument array, no shell;
  anything else is reported skipped, never passed on.
- No `overlapBranches` → no git process at all, no new output: projects that do not configure it
  see nothing change. Not a git repo, git missing, a missing ref → that ref is reported
  `skipped (<why>)`, the run exits 0.
- Hooks never run git: `validate-artifact` calls `validateChange` on every write, so the overlap
  check lives only on the CLI `validate` path (scripts/validate.mjs), never in a hook.
- Never blocks: a hit is a warning; `validate` warns per hit with no `overlap:` decision line.
- No lens signal (no UI, API surface or data store); no deploy signal.
- `new.md` is at its 46-line budget (counted by `countEffectiveLines`). The human approved raising
  `CAPS.playbook.new` 46 → 50 (2026-10-27), noted beside the value in lib/caps.mjs; the new step is
  4c and must fit in 4 lines. design.md has no budget.
- The shared-requirement list is informational: a hit exists whenever the other change's Delta (or
  the ref's spec) names a capability this Delta names, compared case-insensitively like
  `parseDelta`'s own merge; zero shared requirement names is still a hit.

## Delta: change-overlap

### ADDED Requirement: A change learns what overlaps it on other branches
The system SHALL provide `warnyin-sdlc overlap <id> [--json]`, which for each ref in
`overlapBranches` reports, with the ref's age, every hit on a capability the change's Delta names:
`spec` (that ref's living spec has requirements this branch's lacks), `archived` (a change archived
there and not here names it) and `open` (a change open there and not here names it); a `spec` hit lists the
names this branch lacks, the others the names they share with this Delta. It SHALL exit 0 whatever it finds.

#### Scenario: a change shipped on another env branch
- WHEN change B names capability `keys` and `origin/develop` holds an archived change A whose Delta names `keys`
- THEN `overlap B` prints `origin/develop` with its age and an `archived` hit naming A and `keys`

#### Scenario: nothing configured
- WHEN config.yaml has no `overlapBranches`
- THEN `overlap B` says none are configured and starts no git process

### ADDED Requirement: A ref name never reaches git unchecked
The system SHALL pass a configured ref to git only when it matches the closed ref-name pattern, as
one argument with no shell, and SHALL report any other value, a missing ref, a missing git or a
folder outside git as `skipped (<why>)` and go on.

#### Scenario: a value shaped like an option
- WHEN `overlapBranches` holds `--output=/tmp/x`
- THEN it is reported skipped as not a ref name and no git process receives it

### ADDED Requirement: Every overlap carries a decision
`payload/playbook/new.md` (after the Delta) and `payload/playbook/design.md` SHALL tell the agent to
run `overlap <id>` and record each hit in `## Assumptions` as `overlap: <ref> <change-id|capability>
— <decision>`, and `validate <id>` SHALL warn for each hit without such a line; a hook never runs it.

#### Scenario: an undecided hit
- WHEN `overlap B` reports a hit and change.md has no `overlap:` line naming that ref and change
- THEN `validate B` warns naming the ref and the change, and exits 0 for that warning

## Design
<!-- revised after the contract attack (security + quality, one round, 16 must-fix items) -->
- decision: comparison in `lib/overlap.mjs` (pure: texts in, hits out; imports only `./delta.mjs`
  and `node:*`); git reads in `bin/git-refs.mjs` (CLI-only, like bin/detect.mjs) · alternatives:
  all in lib/ · because: lib/ is copied into projects and imported by hooks; a git reader there
  is one import away from a hook spawning git on every write.
- decision: git is found by walking PATH's absolute entries for `git` (`git.exe` on Windows) and
  run by that absolute path; empty, `.` and relative entries are skipped, the cwd never searched ·
  because: Windows resolves a bare `git` through the cwd first, and the cwd is a cloned project.
- decision: git's env is an allowlist — what a process needs (PATH, HOME, USERPROFILE, SystemRoot,
  TEMP, TMP, LANG, LC_*) plus `GIT_TRACE*` and `GIT_CEILING_DIRECTORIES`; every other `GIT_*` is
  dropped and every command runs with `--no-pager` · because: GIT_DIR, GIT_OBJECT_DIRECTORY,
  GIT_NAMESPACE or GIT_CONFIG_* would read another repository, and `log.showSignature` runs gpg.
- decision: ref pattern: first char `[A-Za-z0-9]`, then `[A-Za-z0-9._/-]`, ≤200 chars, no `..`,
  no `//`, checked before any git process.
- decision: per run one `rev-parse --show-prefix`; per ref exactly `rev-parse --verify --quiet
  <ref>^{commit}` (the name's only use), then by the resolved sha `log -1 --no-show-signature
  --format=%cr <sha> --`, `ls-tree -r -z -l <sha> -- <prefix>sdlc/specs <prefix>sdlc/changes` and
  one `cat-file --batch` fed only the hex oids of the entries kept · alternatives: `git show` per
  file; paths on the batch stdin · because: a path is untrusted text (a newline injects a second
  object spec); an oid cannot be. Pathspecs are joined with `/`, never `path.join`.
- decision: bounds — at most 10 refs (the rest `skipped (too many refs)`); at most 2,000 candidate
  files per ref, else that ref is `skipped (too many files)`, never read in part; a blob over
  256 KiB, a non-blob entry (submodule, symlink) or a blob holding NUL or invalid UTF-8 is not
  read and counts in the ref's `ignored`; maxBuffer 64 MiB and a 10 s timeout per command; a
  spawn error or non-zero exit is `skipped (git failed)` · because: a hostile ref can plant any
  size or count, and a silent truncation would read as "no overlap".
- decision: skip reasons are a closed set — not a ref name, no such ref, not a commit, git not
  available, not a git repository, partial clone (git would fetch a missing blob from its remote;
  checked by one `config --get-regexp`, and the env sets GIT_NO_LAZY_FETCH=1, GIT_TERMINAL_PROMPT=0),
  too many refs, too many files, git failed; git's stderr is never printed.
- decision: what a ref says is untrusted — identity is the folder name only (frontmatter `id:`
  ignored); an id must match `[A-Za-z0-9._-]{1,100}` and a capability `CAPABILITY_RE`, else the
  entry is dropped and counted in `ignored`; requirement names over 200 characters are dropped and
  counted; at most 20 listed per hit · because: the playbooks copy hits into Assumptions, so a
  ref's text reaches a model's context; a dropped entry is said, never silent.
- decision: identity — an archived folder `<YYYY-MM-DD>-<id>` under `changes/archive/` reads as
  `<id>` whatever its status; a hit is skipped when that id is this change, or archived or open on
  this branch too; a `spec` hit leaves out the names the REF's copy of a change open here adds or
  modifies (archived or open there), this change included · because: a change shipped there put its
  own requirements in that spec; a change the ref lacks, or its copy naming other things, hides nothing.
- decision: a `spec` hit lists the ref spec's requirement names missing from this branch's
  (case-insensitive); none missing → no hit.
- decision: a decision line is a bullet in `## Assumptions`, outside fences, whose whitespace-split
  tokens hold `overlap:`, the ref exactly and the hit's id (the capability for `spec`) exactly ·
  alternatives: `\b` regexes · because: `\b` splits on `-`, `/` and `.` (`origin/develop-old`
  would clear `origin/develop`), and a ref's text must never become a pattern.
- decision: `validate` runs the check only from `scripts/validate.mjs`, after validateAll, only
  when `overlapBranches` is a non-empty list, reading each ref once for all open changes ·
  because: the hook path calls validateChange, which stays git-free.
- decision: text output escapes everything read from a ref or the config (`escapeEntry`);
  `--json` is `{ refs: [{ ref, age, skipped, ignored, hits: [{ kind, id, capability,
  requirements }] }] }`, hits ordered spec, archived, open, then id, then capability; nothing
  configured → `{ refs: [] }`.
- decision: the hit choices in new.md are extends it, waits for it to reach this branch (ask the
  human first), or unrelated — `blocked-by` cannot name a change that is not on this branch.

## Tasks
- [x] T1 lib/overlap.mjs: pure comparison of a Delta against a ref's specs, archived and open changes [tier:balanced]
  — surprise: an oversize requirement name was counted only when shared (row 26); now every name is checked.
- [x] T2 bin: ref-name pattern, git reads (argument array, no shell), `overlap` command + HELP + --json [tier:balanced]
  — added `--full-tree`, `--literal-pathspecs`, and a failure-only `rev-parse` to tell no such ref from not a commit.
- [x] T3 scripts/validate.mjs: warn per undecided hit; hooks untouched [tier:balanced]
  — contract defect: row 19's sweep read `'spawned-from';` (lib/relations.mjs) as an import, so it was red for the wrong
  reason at contract; the regex now stops at a line end and a quoted `from`; it still catches all five import forms.
- [x] T4 new.md step 4c, design.md step 1c, config.yaml template comment, CAPS.playbook.new 46→50 [P] [tier:cheap]
- [x] T5 README + CHANGELOG [P] [tier:cheap]
- [x] F1 cluster (verify round 1, evals trajectory 3): no mutant evidence — ran 14 mutants on a copy; record in contract/mutants.md
- [x] F2 cluster (verify round 1, quality): row 24 let a relative non-dot PATH entry through — test now plants a git in a relative `fakebin`
- [x] F3 cluster (verify round 1, honesty of comments): lib/overlap.mjs said spec hits carry id === capability; the CLI prints id: null — comment corrected
- [x] F4 cluster (found while running the suite): cmdOverlap interpolated the raw change id in errors; now escapeEntry, as cmdArtifact does
- [x] F5 cluster (verify round 2, trajectory 3): run record missing from the change folder, and the literal-pathspec note was wrong — row 7b added; git ls-tree shown to read pathspecs literally on git 2.55 and 2.43; contract/mutants.md rewritten
- [x] F6 review 1 blocker (a self-excluding filter hides a spec hit) and F7 (names past 20 cut silently): class, sweep, hits and fix in contract/mutants.md · [x] F8 cluster (verify round 4, trajectory 3): evidence, no code — runs, red-first and the rows 26-27 attack (5 gaps added, mutants 18-22) in mutants.md
- [x] F9 review 2 blocker (F6 not closed) · class: a spec-hit exemption keyed by id, read from the LOCAL copy (ran: ref archives `c`
  naming `tokens`, c here adds `Keys rotate` → `hits: []`) · sweep `grep -rnE "onRef|pending" lib bin scripts` · hits lib/overlap.mjs:79-94 ·
  fix: exempt only names the REF's copy of a change open here adds or modifies; row 27. Done: sweep → only that map (:79, :83, :84, :93)
- [x] F10 review 2 blocker · class: listing wording contradicts the Design (a spec hit lists names missing here) · sweep `grep -rnE
  "shares with this Delta|shared with this Delta|names they share|names it shares"` (archive, .hooks excluded) · hits change.md:54, CHANGELOG.md:8.
  Done: Delta, Assumptions and CHANGELOG reworded; sweep → lib/overlap.mjs:64 (correct) and the reworded lines
- [x] F11 review 2 blocker · class: a git read fetches (ran, git 2.55: `cat-file --batch` on a partial clone starts `git fetch origin`) · sweep
  `grep -rnE "spawnSync\(|GIT_NO_LAZY_FETCH|GIT_TERMINAL_PROMPT" bin lib scripts payload/hooks` · hits bin/git-refs.mjs:60 (bin/cli.mjs:1217 runs node).
  Done: a partial clone is `skipped (partial clone)` by one `config --get-regexp`; env sets both vars (untested: no probe sees env); row 28; sweep → the one spawn
- [x] F12 review 2 blocker · class: a dropped count not said on the warning surface · sweep `grep -rnE "overlapReport\(|\bignored\b" bin scripts` ·
  hits scripts/validate.mjs:26. Done: validate warns `<ref> <n> ignored`; row 15 leg; sweep → both callers read `ignored`
- [x] F13 cluster (verify round 6, trajectory 3): the env guard GIT_NO_LAZY_FETCH/GIT_TERMINAL_PROMPT (bin/git-refs.mjs:58) had no mutant; WSL pass recorded without its exit code. Done: row 29 (POSIX shim), mutant 36 killed; WSL run keeps `node --test`'s own exit code

## Review improvements (for the digest)
- Applied: README example, CHANGELOG hand-add note, tests.md out-of-scope fix. exit 128 reads `not a git repository`/`no such ref`; no run-wide deadline (~400 s worst: 4 git calls × 10 s × 10 refs, [UNVERIFIED]); ENOBUFS reads `git failed`; hits per ref uncapped; env lacks --no-replace-objects; scalar/block `overlapBranches` silent in validate; scripts/ imports bin/; lib/overlap.mjs has no installed consumer; shrink: `linesOutsideFences`, `unavailable`, `id === self.id`; untested: `~~~`; release: shipped-hashes.
- Review 2: `--json` keeps Cf raw (row 8 chose it); "always exits 0" is for results, a bad id exits 1; rollback = delete the key; an oversize ref change escapes the F9 gate (counted in ignored); N×M re-parse; `ignored` mixes kinds; two archived folders of one id hit twice; id case; a decision line for id `keys` also clears spec `keys`; `ARCHIVE/` dropped uncounted. Review 3 (0 blockers; ops and quality claimed row 28's control fails — ran: a blob:none clone writes no `extensions.partialclone` on git 2.43 or 2.55, row 28 exit 0 on both): `ignored` text names only three of its kinds and repeats per change; README/CHANGELOG "always exit 0" omits a bad id; `partial clone` has no remedy line in README; the skip is run-wide; `--no-replace-objects`; `config` non-1 exit branch untested; 10 s timeout can false-skip; F9 exemption trusts ref text, uncounted; release needs `npm run shipped-hashes`.

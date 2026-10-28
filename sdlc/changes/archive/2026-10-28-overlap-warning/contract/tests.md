# Test contract — overlap-warning
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Tests in `tests/overlap-warning.test.mjs`, run on Windows AND Linux (WSL). Fixture: project P is `git init`ed; refs are written by one
`git fast-import` (any path, gitlinks, symlinks, large blobs; no working tree). B = open change `b`, `## Delta: keys`, requirement
`Keys are issued`. `GIT_TRACE=<file>` is the witness: no file = no git process; every no-git row has a positive control that writes it.
Hit order: spec, archived, open; then id; then capability. Rows and legs marked † came from the contract attack (one round, 16 items).

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | develop archives `2026-09-01-a` naming `keys` + `Keys are issued` · `overlap b` · exit 0; the ref with an age ending `ago)`; an `archived` line naming `a`, `keys`, the requirement | e2e | A change learns what overlaps it |
| 2 | develop opens `a2` naming `Keys` with another requirement · an `open` hit, capability as the ref spells it, requirements `[]` | e2e | A change learns what overlaps it |
| 3 | develop's spec `keys` R1, R2; here `r1` · `spec` hit `[R2]`; here no `keys` spec · `[R1, R2]`; here R1, R2 · no hit | e2e | A change learns what overlaps it |
| 4 | develop names only `tokens`; uat has no `sdlc/` · `no overlap` twice, each aged, exit 0 | e2e | A change learns what overlaps it |
| 5 | one change, two branches: develop archives `b` itself; † develop archives `b` and its spec holds `b`'s requirement; open there/archived here; archived there (status `new`)/open here; † archived on both; † `changes/ARCHIVE/…` on the ref · no hit in any | e2e | A change learns what overlaps it |
| 6 | develop holds a binary `change.md`, an empty `spec.md`, a Delta-less text and a valid `a` · hits `[a]`; † `ignored` 1, text `1 ignored` | e2e | A change learns what overlaps it |
| 7 | P at `<repo>/app`; develop's files under `app/sdlc/`, a decoy `zzz` under `sdlc/` · hits `[a]` | e2e | A change learns what overlaps it |
| 7b | (verify round 2) P at `<repo>/app[1]`; develop's files under `app[1]/sdlc/`, a decoy `zzz` under `app1/sdlc/` · hits `[a]` — the prefix is never a glob | e2e | A ref name never reaches git unchecked |
| 8 | two refs, all three kinds, † archived `2026-09-01-z` and `2026-08-01-a`, † a requirement name holding U+202E · `--json` keys `refs`/`ref,age,skipped,ignored,hits`/`kind,id,capability,requirements`, order spec, a, z, open; JSON raw; text escaped, no raw Cc/Cf | e2e | A change learns what overlaps it |
| 9 | no key; `[]`; a scalar · exit 0, `overlapBranches is not set` / `is not a list`, † `--json` `{"refs":[]}`, no GIT_TRACE; † control: configured → trace written | e2e | A change learns what overlaps it |
| 10 | `isRefName` over every code point (surrogates skipped), first and inside · accepted iff first `[A-Za-z0-9]`, rest `[A-Za-z0-9._/-]`; `..`, `//`, 201 chars, empty, non-strings refused | unit | A ref name never reaches git unchecked |
| 11 | refs `--output=/tmp/x`, `a..b`, `a b`, `-x`, `origin/develop;touch x`, † `x` + U+009B, then `origin/develop` · each bad one `skipped (not a ref name)`, text escaped; develop read; no bad value in GIT_TRACE | e2e | A ref name never reaches git unchecked |
| 12 | `origin/nope`; † a ref pointing at a blob; P outside git; PATH without git · `no such ref`, `not a commit`, `not a git repository`, `git not available`; the valid ref beside them still read; exit 0 | e2e | A ref name never reaches git unchecked |
| 13 | `overlap` with no id; unknown id; † `../other` with `sdlc/other/change.md` planted; hostile id · non-zero, `usage`/refused, escaped, no GIT_TRACE; control: `overlap b` writes it | e2e | A change learns what overlaps it |
| 14 | `validate` (no id), open `b` and `c` both naming `keys`, two refs of ≥3 candidate blobs each · 1 `--show-prefix`; 1 `config --get-regexp`; per ref 1 `ls-tree` (with `-z`), 1 `cat-file`, 1 `log`; † no `fetch`/`remote`/`pull`; † no argument holds `\`; † one `no overlap decision` for `b` and one for `c` | e2e | Every overlap carries a decision |
| 15 | row 1's hit, no decision · `validate b`, `--strict` · warning naming ref, `a`, `no overlap decision`, exit 0; † a 300 KiB change.md on the ref · a `1 ignored` warning naming the ref, with or without a hit, once per open change, and `validate b` never names `c` | e2e | Every overlap carries a decision |
| 16 | decision tokens: `origin/develop a` clears; `origin/develop2`, † `-old`, † `/x`, † `.bak`, id `a2`, † `a-2`, † `.*`, only ref, only id, under `## Design`, in a fence do not; one line clears two hits of one change; a `spec` hit takes the capability | e2e | Every overlap carries a decision |
| 17 | (guard, red only through its control) no `overlapBranches` · `validate` · no `overlap` in its output, no GIT_TRACE; † control: configured → trace written | e2e | Every overlap carries a decision |
| 18 | (green guard) config set, a hit undecided · hook `validate-artifact` on `b/change.md` (stdout and † stderr), `archive b` · no `overlap`, archive ships, no GIT_TRACE | e2e | Every overlap carries a decision |
| 19 | † every `import`, `import(` and `require(` in lib/*.mjs names `node:*` or a `./` sibling; lib/overlap.mjs imports only `./delta.mjs`; under lib/ and payload/hooks/ only `_update-notice.mjs` names `child_process` | unit | Every overlap carries a decision |
| 20 | new.md step 4c: `When … run \`npx @warnyin/sdlc overlap <id>\` once the Delta exists.` and `Record each hit … extends it, waits for it to reach this branch (ask the human first), or unrelated.`; design.md step 1c: its sentence | unit | Every overlap carries a decision |
| 21 | the config template's commented `overlapBranches` example and sentence; `--help` lists `overlap <id> [--json]`; lib/caps.mjs notes `→ 50 (overlap step, approved 2026-10-27)` | unit | Every overlap carries a decision |
| 22† | develop: folders named with `\n`, `"`, `\`, a tab, a space, one reading `x\norigin/uat:sdlc/changes/secret/change.md`; `secret` exists only on uat (not configured); a Thai-named folder; a valid `a` · hits `[a]`, no `secret` anywhere, the bad ones counted in `ignored` | e2e | A ref name never reaches git unchecked |
| 23† | develop: an 8 MiB `change.md`, a gitlink and a symlink named `change.md`/`spec.md`, 400 archived changes (~2 MiB) with `a` last · hits `[a]`, the three counted in `ignored`, exit 0; 2,001 candidates · `skipped (too many files)`; 11 refs · the 11th `skipped (too many refs)` | e2e | A change learns what overlaps it |
| 24† | a fake `git` (`git.exe` on Windows) at P's root and PATH starting with an empty and a `.` entry · `overlap b` still finds `a` — the real git ran | e2e | A ref name never reaches git unchecked |
| 25† | `GIT_DIR`/`GIT_OBJECT_DIRECTORY` pointing at a decoy repo whose develop archives `evil`, `GIT_NAMESPACE=x`, `GIT_CONFIG_COUNT=1` setting `log.showSignature` · hits `[a]`, no `evil` | e2e | A ref name never reaches git unchecked |
| 26† | develop: an id with spaces, a 5,000-char id, folder `x` whose frontmatter says `id: b`, a sentence-long capability, a 300-char requirement, a change sharing 30 requirements · hit id `x`; the bad ones in `ignored`; the first 20 listed in order, † the 10 cut counted (`ignored` 14) | e2e | A change learns what overlaps it |
| 27† | (review) develop's spec holds b's own requirement, no change there carries it · `spec` hit; another local change `c` with it, still not on the ref · same hit; develop archives `c`, or holds it open, adding it · no hit; develop's `c` names another capability, REQ under another capability, or another name · the hit; develop's `c` is not open here · the hit; develop's `c` MODIFIES it · no hit; develop's `c` REMOVES it · the hit; a spec with a 300-char name + 25 missing here · the first 20 in order, `ignored` 6 | e2e | A change learns what overlaps it |
| 28† | (review 2) a clone made `--filter=blob:none` (config `extensions.partialclone`, `remote.origin.promisor`) · `overlap b` · `skipped (partial clone)`, exit 0, no `fetch` in GIT_TRACE; control: `cat-file -p` of the same blob in that clone does write `fetch` | e2e | A ref name never reaches git unchecked |
| 29† | (verify round 6, POSIX only) a shim `git` first on PATH logs `GIT_NO_LAZY_FETCH` and `GIT_TERMINAL_PROMPT`; the caller sets `0`/`1` · `overlap b` still finds `a`, ≥4 calls, every one sees `1:0` | e2e | A ref name never reaches git unchecked |

## Out of scope (explicitly untested + why)
- A git command that hangs: the 10 s timeout is `spawnSync`'s own option; no fixture makes git hang deterministically [UNVERIFIED].
- A real Windows file lock or a dubious-ownership repo: untested. Review found the ownership case does NOT end in
  `git failed`: `rev-parse --show-prefix` exits 128 there, which reads as `not a git repository` (bin/git-refs.mjs:183).
- Touched file paths, `git fetch`, feature grouping and the promotion matrix: out of this change (answered on #14).

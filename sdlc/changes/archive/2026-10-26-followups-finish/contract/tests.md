# Test contract — followups-finish
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Tests in `tests/followups-finish.test.mjs`; release-workflow rows 1–11b get a matching CHANGELOG. OUT = a temp folder beside
the project; folder links are junctions, a file link skips only on EPERM/EACCES/ENOSYS. BAD = `x` + U+009B U+202E + `y`.
"Escaped" = `\u{9b}` and `\u{202e}` shown, no raw Cc/Cf on any line. "Refused" = non-zero, names the path, `nothing was merged`,
change.md still `verified` in `changes/`, specs and OUT (files and folders) unchanged. Rows marked † came from the contract
attack and were written after the build: they are proven by evidence/mutations.txt, not by a red run.

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | `sdlc/specs` a link to OUT · `archive` · refused naming `sdlc/specs` | e2e | archive writes only inside the project |
| 1b† | `sdlc/specs/auth` a link to OUT; separately `specs/auth/spec.md` a dangling file link · each refused naming it | e2e | archive writes only inside the project |
| 1c† | `## Delta:` `../../x`, `a/b`, `a\b`, `..`, `.hidden`, `C:x`, `a b` · `validate` says `not a capability name`; `archive` non-zero; no file or folder created in the project | e2e | A Delta capability is one plain name |
| 2 | `sdlc/changes/archive` a link to OUT · refused naming it | e2e | archive writes only inside the project |
| 2b† | `sdlc/changes/archive` a dangling link to OUT/gone · refused; OUT stays empty | e2e | archive writes only inside the project |
| 3 | with evals.md: `sdlc/evals` a link to OUT; separately `evals/auth/rubric.md` a dangling file link · each refused | e2e | archive writes only inside the project |
| 4 | `sdlc/.state/journal` a link to OUT; separately `journal/add-2fa.ndjson` a file link to OUT · refused; `appendJournal` returns false; OUT byte-identical | e2e | archive writes only inside the project |
| 5 | `change.md`, `journal.ndjson`, `contract/evals.md` each a file link to OUT · non-zero, `nothing was merged`, the OUT file byte-identical, nothing promoted | e2e | archive writes only inside the project |
| 6 | `sdlc/specs` a link to a folder INSIDE the project · refused too (the installer's rule); that folder unchanged | e2e | archive writes only inside the project |
| 7 | `installOrder` on `lib/`, `payload/hooks/`, `payload/playbook/`: a permutation of the folder, imports first; fixture `a→b→c` (+ `a` imports a missing file, a `.md`, a folder) gives `c,b,a,notes.md,sub`; cycle `x↔y` gives `y,x` without throwing | unit | update writes a module before the code that imports it |
| 8 | in-process `init` with writes recorded · first lib write before first hook write; lib and hooks each in import order; then `update` · `written: 0`, `pruned: 0`, manifest byte-identical | int | update writes a module before the code that imports it |
| 9 | release-check, CHANGELOG first heading `## Unreleased` · non-zero naming it and `1.2.3`; missing file, `## 1.2.2 (…)`, `## 1.2.3` with no date, no sections, `## 1.2.30 (…)` · each non-zero; `## 1.2.3 (2026-10-26)` with CRLF · exit 0 | e2e | A release names its CHANGELOG section |
| 11 | open BAD (title holds U+202E, tier `de`+U+009B+`ep`, `blocked-by: [w]`) · `status`, `status --all` escaped; `status --json` holds BAD raw | e2e | Change ids and change-file text are printed escaped |
| 12 | BAD with `id: other` · `validate` escaped; `formatIssues` of an issue whose `where` and `msg` hold BAD · escaped | e2e | Change ids and change-file text are printed escaped |
| 13 | (green guard) BAD `blocked-by: [w]`, `w` `blocked-by: [BAD]` · `is not a change id`, no `waiting cycle`, escaped — ENTRY_RE keeps a hostile id out of every relation | e2e | Change ids and change-file text are printed escaped |
| 14 | archived BAD without digest; open BAD (hostile tier) `blocked-by: [old]`, `old` shipped, BAD's journal holding a compact, 4 failed verify rounds and a human-closed review; a steering file BAD.md never hit · `observe` · the 6 flags and the listing escaped; `observe --json` holds BAD and the tier raw; tier shown `de\u{9b}ep` | e2e | Change ids and change-file text are printed escaped |
| 15 | `archive` of BAD+`z`, BAD+`/..`, BAD waiting on `third`, a parked BAD, BAD whose archive target exists · each refusal escaped; `archive BAD` · `shipped:`/`archived:` escaped | e2e | Change ids and change-file text are printed escaped |
| 15b† | `archive dep` with BAD freed, BAD+`2` still waiting, BAD+`3` parked, BAD+`4` unreadable (change.md a folder) · `↳` lines and the `cannot be read` warning escaped | e2e | Change ids and change-file text are printed escaped |
| 16 | hook `journal.mjs`: `open-ship BAD`, `set-active BAD` missing, open, parked · each output escaped | e2e | Change ids and change-file text are printed escaped |
| 16b† | `sdlc/.state` a link to OUT · `set-active BAD` · `not recorded` escaped, OUT unchanged (held by lib/active.mjs `ensureRealDir` alone — the pointer write is a plain `writeFileSync` — and a mutant removing that check is killed) | e2e | Change ids and change-file text are printed escaped |
| 17 | BAD active · `session-summary`, `inject-context` `Active change:`, and a steering file named BAD.md hit by `validate-artifact` · each escaped | e2e | Change ids and change-file text are printed escaped |
| 18 | `capForChange` of `toString`, `constructor`, `__proto__`, `hasOwnProperty`, unset, `` → standard; real tiers → their own; no `TIERS.includes(data.tier) ?` copy left; a `tier: toString` change over 100 lines · validate says `cap for standard: 100`, never `function` | unit | (refactor guard; no Delta) |

## Enumeration (T4)
Sweep `\$\{[^}]*\b(c|w|f|p|n|node|self|e|x|r|entry|ch|change|changeId|id|data|blocked|o)\.(id|title|tier|status|blockedBy|remaining|spawnedFrom|waitedOnBy|change)\b|\$\{(id|changeId|change|active|where)\}`
over lib/relations.mjs, lib/observe.mjs, lib/validate.mjs, lib/active.mjs, bin/cli.mjs, payload/hooks/*.mjs, lines without escapeEntry
→ 26 hits: relations 371, 378; observe 200, 201, 203, 206, 217, 227, 261; validate 65; cli 799, 804, 864, 867, 873 (a path),
899, 977, 982, 994 (JSON return); inject-context 49; journal.mjs 34, 47, 58, 59; session-summary 66. Found by reading / the attack:
relations 374; relations 231 (escaped by its two printers, `formatIssues` and archive's warning); journal.mjs 53; cli 896, 906 (path), every `throw` reaching `main` (requirement and capability names) →
escaped once in `main`'s catch; observe 199 and 275 (steering file name and inclusion; 275 found by row 14 in review); validate-artifact 70 (steering pointer); validate 102 and every
issue → `formatIssues`. Cleared, not escaped: cycle members, `blockedBy`/`remaining` joins, observe 217 — every relation entry passes
`ENTRY_RE` `[A-Za-z0-9._-]{1,100}` first (row 13); `spec merged: specs/<cap>` — the capability rule (row 1c).

## Out of scope (explicitly untested + why)
- A link swapped in between the preflight and a write: archive re-checks before `rename` and writes through `writeInProject`, but no
  black-box row can stage the race; evidence/mutations.txt lists both guards as surviving for that reason.
- `--json` id/value fields stay raw (machine contract). `writeFileContained` truncating in place (not group 4).

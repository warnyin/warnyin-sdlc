# Test contract — digest-backlog
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Tests in `tests/digest-backlog.test.mjs`. Prose rows pin ONE exact sentence (tests/rule-pins.mjs `assertSentence`) inside the
named step or bullet. Write rows run `writeFileContained` in-process in a temp project; `fs` calls are mocked with `t.mock.method`.

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | contract.md step 1 · holds "A row that pins a character class, a range or a closed set sweeps every member, never a sample." | unit | A contract row covers every member and every input class |
| 2 | contract.md step 1 · holds "A formula or status mapping in a Delta gets one row per input class, the fallback class and the rounding rule included." | unit | A contract row covers every member and every input class |
| 3 | review.md step 3 · holds "A class deferred to a later change is recorded with its sweep's hits unfiltered — no name or variable filter — and an instance found later is recorded as a miss of that deferral." | unit | A deferred class lists every hit |
| 4 | build.md, the `**Conductor**` bullet · holds "In an attended run it may also take more tasks when they edit the same file, where builders would collide, or are each a short prose or config edit; journal `mode=conductor reason=<why>`."; the Conductor line still says `attended runs only` and the bullet states no hard cap (`≤`, `<=`, `up to`, `at most`, `no more than` + 2/two tasks); the `**Orchestrator**` bullet names the exception; the `**Unattended**` bullet unchanged; `sdlc-builder`'s description names orchestrator waves, not `>2 parallelizable` (†) | unit | Conductor mode for tasks that would collide |
| 5 | a file holding `old` · `writeFileContained` with `fs.writeSync` mocked to write 3 bytes then throw · throws; the file still reads `old`; the folder holds no other entry | unit | A contained write never leaves half a file |
| 6 | (green guard: the in-place write already keeps mode) a new path, and an existing file · `writeFileContained` · returns true, content exact, the folder holds only that file; (†, every platform) `fchmodSync` is handed exactly the existing file's mode; on POSIX an existing 0755 file stays 0755 (skips on win32) | unit | A contained write never leaves half a file |
| 7 | `fs.renameSync` mocked to throw EPERM once · a rename was attempted, write returns true with the new content, no temp left; mocked ENOSPC · throws, old content kept, no temp left; (†) the mock swaps the folder for a junction to OUT then throws EPERM · throws, OUT empty, the moved folder's file still `old` | unit | A contained write never leaves half a file |
| 7b† | `openSync` finds someone's file at the temp name (writes `precious`, throws EEXIST) · throws, that file still `precious`, target `old`; `fchmodSync` and `closeSync` each throwing once · throws, target `old`, folder holds only the target | unit | A contained write never leaves half a file |
| 8 | (green guard) target a file link to OUT; folder a junction to OUT; (†) target a link to a file INSIDE the folder; a dangling link · each returns false, nothing written anywhere, the link left as it was | unit | A contained write never leaves half a file |
| 9 | (green guard) `init`, `update`, `park`, `unpark` and an `artifact` stamp in one project · each exits 0 and leaves no `.tmp`/`.part` file and no hidden `.<sibling>.*` copy anywhere under the project | e2e | A contained write never leaves half a file |
| 10 | `installOrder` fixture: `a.mjs` = `import './b.mjs';`, `c.mjs` = `const m = await import('./d.mjs');`, `e.mjs` = `export { x } from './f.mjs';` · each importer comes after its target | unit | Install order reads every import form |
| 11 | a change with `## Delta: <capability>` · `validate` says `template placeholder` and `capability's name`; `archive` refuses with the same words, specs unchanged | e2e | The template placeholder is named as such |
| 11b† | `<name>`, `<a b>`, `<>`, `<../x>` · each refused by `validate` as the template placeholder | e2e | The template placeholder is named as such |
| 12 | (green guard) `## Delta: ../x` still gets `not a capability name`, not the placeholder message | e2e | The template placeholder is named as such |

Rows and legs marked † came from the contract attack (one round, 8 items) and were written after the build: evidence/mutations.txt
proves them. Row 8 skips its link legs only where symlinks cannot be made (EPERM/EACCES/ENOSYS); on this host they ran.

## Out of scope (explicitly untested + why)
- A folder swapped for a link between the temp's creation and a refused rename: the write is refused and nothing reaches OUT,
  but the temp stays in the folder that was moved aside — cleanup resolves through the new link (row 7, last leg).
- A real process crash mid-write: row 5 stands in for it (the throw lands between the temp's first bytes and the rename).
- A Windows file held open by another process: the EPERM fallback is exercised by mock (row 7), not by a real lock [UNVERIFIED].
- Picks not made by the human (B3, B4, C2, C3, C4, D2): they stay in their digests.

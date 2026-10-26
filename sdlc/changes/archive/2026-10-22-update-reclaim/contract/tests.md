# Test contract — update-reclaim
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Black-box: the real CLI runs into `mkdtemp` projects. The CLI reads the ledger at
`WARNYIN_SDLC_SHIPPED_HASHES` when set, and otherwise reads `bin/shipped-hashes.json`. The ledger's
shape is `{ "versions": ["x.y.z", …], "paths": { "<installed posix path>": ["<sha256>", …] } }`, with
sha256 taken over the content after `\r\n` → `\n`. P = `sdlc/.hooks/journal.mjs`, and X = an older
content of P that is not the current payload. The reclaim report is the stderr line
`reclaimed (unmodified, shipped by an older version): <path>`.

| # | Given / When / Then | Kind | Maps to requirement |
|---|---|---|---|
| 1 | `init --tool claude`; P set to X; P's manifest line removed; ledger lists sha(X) under P · `update` → P equals what a fresh `init` installs at P, stderr has the reclaim line for P, and the manifest records P with the current hash | e2e | update reclaims an untouched file a release shipped |
| 2 | as 1, but X is written to disk with CRLF and the ledger holds sha(X with LF) · `update` reclaims P, and P's bytes equal a fresh `init`'s (LF) | e2e | update reclaims an untouched file a release shipped |
| 3 | P set to Y (no ledger entry), and separately to X without its trailing newline; P's manifest line removed · `update` → P byte-for-byte unchanged, stderr has `kept (user-modified): sdlc/.hooks/journal.mjs` and no reclaim line, and the manifest has no P | e2e | update reclaims an untouched file a release shipped |
| 4 | after row 1's update · a second `update` → no reclaim line and no `kept` line for P | e2e | update reclaims an untouched file a release shipped |
| 5 | ledger lists sha(X) only under another path Q · P set to X without a manifest line → P byte-for-byte unchanged, stderr has `kept (user-modified): sdlc/.hooks/journal.mjs` and no reclaim line | e2e | update reclaims an untouched file a release shipped |
| 6 | P set to X while the manifest still records P with sha(X), i.e. the existing refresh path · `update` refreshes P and prints no reclaim line. P set to X while the manifest records some other hash W · `update` reclaims P | e2e | update reclaims an untouched file a release shipped |
| 7 | `bin/shipped-hashes.json` · parses to the shape above (every hash 64 hex chars); `versions` includes `package.json`'s version and every `## X.Y.Z` heading of CHANGELOG.md | unit | The package carries every shipped payload hash |
| 8 | `bin/shipped-hashes.json` · `versions` includes `0.19.0`, and P lists at least 2 distinct hashes (real history, not only the current payload) | unit | The package carries every shipped payload hash |
| 9 | `package.json` · `scripts["shipped-hashes"]` runs `.github/scripts/shipped-hashes.mjs`, and `files` includes `bin` | unit | The package carries every shipped payload hash |
| 10 | README `## Releasing` · names `npm run shipped-hashes` | unit | The package carries every shipped payload hash |
| 12 | the ledger is absent, not JSON, or `paths` is not an object (env points at each in turn) · `update` exits 0, P (set to X, no manifest line) is kept, stderr has `reclaim skipped:`, and the manifest is written | e2e | update reclaims an untouched file a release shipped |
| 13 | P is a symlink to a file holding X, with no manifest line (skipped where the OS refuses symlinks) · `update` → the target still holds X, no reclaim line | e2e | update reclaims an untouched file a release shipped |
| 13b | `sdlc/.hooks` is a linked folder holding X as journal.mjs, no manifest line · `update` → the outside file still holds X, no reclaim line | e2e | update reclaims an untouched file a release shipped |
| 14 | a ledger path the current payload does not ship, present on disk with a listed hash · `update` → untouched, no reclaim line | e2e | update reclaims an untouched file a release shipped |
| 15 | `init --tool claude` on a project whose P holds X with no manifest line · no reclaim line, P unchanged | e2e | update reclaims an untouched file a release shipped |
| 16 | P deleted (the issue's workaround) · `update` writes P, no reclaim line | e2e | update reclaims an untouched file a release shipped |
| 17 | .github/workflows/ci.yml pack-verify names `bin/shipped-hashes.json`; update's summary counts reclaimed files | unit | The package carries every shipped payload hash |
| 18 | (security-regressions) P is a dangling symlink to a path outside the project · `update` creates nothing there, stderr `kept (symlink in path, not written): P` | e2e | installFile never writes through a symlink |
| 19 | (security-regressions) `sdlc/.hooks` is a linked outside folder · `update` and `init` add or change nothing in it (version.json included) | e2e | installFile never writes through a symlink |
| 20 | (security-regressions) P is a symlink to an outside file whose hash the manifest records · `update` leaves that file unchanged, and the manifest still records P with its old hash | e2e | installFile never writes through a symlink |
| 22 | (security-regressions) each installer write site — `.claude/settings.json`, `.gitignore`, `AGENTS.md` marker, `sdlc/.state` (manifest), `sdlc/config.yaml` (tools line), `sdlc/harness.md` seed, `changes/archive/.gitkeep`, and a payload file on `init` — linked out of the project · the command exits 0, nothing outside changes, and stderr has `kept (symlink in path, not written): <site>`; every case is checked and every failure reported | e2e | installFile never writes through a symlink |
| 23 | (security-regressions) a user `agents.md` and a `.Claude` folder whose on-disk case differs from the payload path · `init --tool agents-md` and `init --tool claude` refuse nothing as a link, and the adapter is written (meaningful on win32/darwin; on a case-sensitive host the two names are separate files) | e2e | installFile never writes through a symlink |
| 24 | (security-regressions) a CRLF `AGENTS.md` gets the marker appended, a CRLF `.gitignore` gets its entry, a CRLF `config.yaml` gets its tools line rewritten · every line of each file, appended ones included, is CRLF | e2e | installFile never writes through a symlink |
| 25 | (security-regressions) in a case-sensitive folder, `sdlc/.hooks -> .HOOKS`, a file below it, and `.claude` linked into a sibling root `Proj` · `isRealPathInside` with case folding forced on refuses all three and accepts the real `.HOOKS` path | unit | installFile never writes through a symlink |
| 21 | release.yml runs `shipped-hashes.mjs --check` before publish; `--check` exits 1 naming files "not in the ledger" when the ledger misses this version's install | int | The package carries every shipped payload hash |
| 11 | CHANGELOG entry `**update reclaims payload files it lost track of**` · contains `reclaimed` and `#11` | unit | (release note) |

## Out of scope (explicitly untested + why)
- The ledger matching the current payload. CI has no tags, so a payload edit between releases cannot be checked there. The generator runs at release time after the version bump. Row 7 fails a release that skips it (version and CHANGELOG headings), and the generator's own run proves the content.
- `init` reclaim: not built (change.md Assumptions).
- `archive` writes (spec merge, rubric copy, change.md stamp, journal seal, rename): a follow-up deep change, by the human's call (review 2). They run only inside an open ship gate.
- A reclaimed path that a later release drops or changes: ordinary ownership, already covered by the update and prune tests once the path is in the manifest.

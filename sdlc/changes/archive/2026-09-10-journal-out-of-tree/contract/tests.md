# Test contract — journal-out-of-tree
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

"Live" = the out-of-tree stream for an open change. "Legacy" = the in-tree file at
`changes/<id>/journal.ndjson` that installed projects already carry.

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | Given a git-initialised project with a committed sdlc tree and an open change · when a hook appends telemetry · then `git status --porcelain` reports nothing | int | A session never modifies a version-controlled file on its own |
| 2 | Given the same project · when telemetry is appended · then the grown file is under `sdlc/.state/` and `git check-ignore` claims it | int | A session never modifies a version-controlled file on its own |
| 3 | Given an open change · when telemetry is appended · then no file is created or modified anywhere under `sdlc/changes/` | int | A session never modifies a version-controlled file on its own |
| 4 | Given an open change with live telemetry · when `archive` runs · then the sealed journal carries the ship event the CLI recorded | int | A shipped change carries its telemetry into the archive |
| 5 | Given a change with live telemetry only · when it is archived · then the archived folder holds `journal.ndjson` carrying every recorded event | int | A shipped change carries its telemetry into the archive |
| 6 | Given a change carrying both legacy and live telemetry · when it is archived · then the archived journal holds both sets, ordered by recorded time | int | A shipped change carries its telemetry into the archive |
| 7 | Given the same change · when it is archived · then no telemetry file is left at the legacy path and none at the live path | int | A shipped change carries its telemetry into the archive |
| 8 | Given an archive that aborts (destination taken, or validate red) · when it fails · then the live stream is intact and the legacy file is still there — nothing was consumed | int | A shipped change carries its telemetry into the archive |
| 9 | Given a change with no telemetry at all · when it is archived · then the archive succeeds and no empty journal is invented | int | A shipped change carries its telemetry into the archive |
| 10 | Given an open change with live telemetry · when the report is built · then its sessions, tokens and verify rounds come from that stream | int | Reporting reads an open change's telemetry from where it is written |
| 11 | Given an open change carrying only legacy telemetry · when the report is built · then those events are still counted | int | Reporting reads an open change's telemetry from where it is written |
| 12 | Given an open change carrying events in both streams · when the report is built · then every event from both is counted exactly once — the merge neither drops nor duplicates | int | Reporting reads an open change's telemetry from where it is written |
| 13 | Given an archived change · when the report is built · then it reads the sealed journal in the archived folder | int | A shipped change carries its telemetry into the archive |
| 14 | Given two streams whose events interleave in time · when they are read together · then the result is in recorded-time order | unit | A shipped change carries its telemetry into the archive |
| 15 | Given a stream holding a malformed line · when it is read · then that line is skipped and every well-formed event survives | unit | Reporting reads an open change's telemetry from where it is written |
| 16 | Given the write-guard hook · when it is invoked with an edit of the live telemetry file · then it returns a deny decision | int | A session never modifies a version-controlled file on its own |
| 17 | Given a change id carrying `..` or a path separator · when telemetry is appended for it · then nothing is created outside `sdlc/.state/journal/` — the id is refused or confined | int | A session never modifies a version-controlled file on its own |
| 18 | Given the active-change pointer naming a change whose folder no longer exists · when telemetry is appended · then it is still recorded and nothing appears under `sdlc/changes/` | int | A session never modifies a version-controlled file on its own |
| 19 | Given two events sharing a recorded time, one per stream · when they are merged · then the order is deterministic and legacy precedes live | unit | A shipped change carries its telemetry into the archive |
| 20 | Given a legacy journal checked out with CRLF line endings · when it is merged and sealed · then every event still parses and the sealed file uses `
` | int | A shipped change carries its telemetry into the archive |

## Out of scope (explicitly untested + why)
- A real two-branch git merge proving the conflict is gone — row 1 removes the cause (the tracked file never changes); asserting on git's merge machinery would test git, not us.
- Concurrent appends from two processes racing on one stream — `appendFileSync` of a single short line is the same guarantee as today; this change neither improves nor weakens it.
- That a teammate's shipped telemetry is readable after a clone — that follows from row 5 plus the file being tracked; a clone test would spend a git fixture to re-prove tracking.

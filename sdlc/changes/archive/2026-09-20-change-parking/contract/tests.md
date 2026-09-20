# Test contract — change-parking
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Rows 1–4 are the four defects that withdrew this feature from `change-relations`. Each was
reproduced by running it before the withdrawal; each is a regression here, written first.

| # | Given / When / Then | Kind | Maps to requirement |
|---|---|---|---|
| 1 | a change folder that is a symlink to a directory outside the project, holding a `change.md` / park runs / refused naming the change, the outside file byte-identical, nothing outside read or written | int | No write escapes the project |
| 2 | a `change.md` with no `---` fences at all / park runs / fails naming the change, file byte-identical, no park event journalled, non-zero exit | int | A write that did not happen is never reported as done |
| 3 | a parked change / unpark runs / the key is gone, it is listed, ordered and offerable again, and the journal carries both a park and an unpark event | int | A change can be parked with a reason it can carry |
| 4 | a parked change / ship runs, and `set-active` runs / both refused while parked, the folder does not move, no pointer changes | int | A change can be parked with a reason it can carry |
| 5 | an empty reason, a whitespace-only reason, a numeric reason, and no reason at all / park runs / each fails, file byte-identical, not treated as parked | int | A change can be parked with a reason it can carry |
| 6 | the reason passed as a command-line argument / park runs / refused — no argument form exists — and the usage text names only the stdin form | int | A change can be parked with a reason it can carry |
| 7 | stdin as `{"reason":"..."}`, as `{"wrong":"..."}`, and as bare text / park runs / only the first parks; the others fail with a usage error and write nothing | int | A change can be parked with a reason it can carry |
| 8 | a reason that cannot read back as given — bare `true`, a bare number, a trailing quote, leading/trailing padding, or spanning two lines / park runs / each is refused saying the format cannot carry it, and nothing is written | int | A change can be parked with a reason it can carry |
| 9 | a reason carrying `:`, `#`, `&`, `%`, an interior quote and a backslash — all of which the reader returns unchanged / park runs, then it is read back / it parks and reads back identically | int | A change can be parked with a reason it can carry |
| 10 | a change whose BODY carries lines beginning `status:` and `parked:` / park runs / only the frontmatter block gains the key, both body lines byte-identical, the change reads as parked | int | A write that did not happen is never reported as done |
| 11 | a change already parked / park runs again with a different reason / the reason is replaced and exactly one `parked:` line exists in the frontmatter | int | A change can be parked with a reason it can carry |
| 12 | a change whose frontmatter carries `parked:` as an empty key (which the reader turns into a list) / park runs / it is replaced by the string reason, one `parked:` line, and the file still parses | int | A write that did not happen is never reported as done |
| 13 | a change parked mid-build / status and `status --json` run / its `status:` line unchanged, absent from the default listing, counted in the summary, present with `--all` | int | A change can be parked with a reason it can carry |
| 14 | a parked change / `status --json` runs / each change carries a `parked` field (the reason or null) and the summary carries a parked count, with every pre-existing field unchanged | int | A change can be parked with a reason it can carry |
| 15 | a change two others wait on / park runs / refused naming both waiters, `change.md` byte-identical, no park event journalled | int | A parked change is not offered as work |
| 16 | a parked change, then another declares it waits on it / validate runs / refused naming the parked change and its reason | int | A relation must name a real change |
| 17 | a change itself waiting on an open change / park runs / it succeeds — only stranding others is refused | int | A parked change is not offered as work |
| 18 | a parked change waiting on one open blocker / that blocker ships / it is reported no longer waiting but parked, with no resume command, and it is still parked afterwards | int | A parked change is not offered as work |
| 19 | a change that was never parked / unpark runs / fails naming the change, file byte-identical, no event journalled | int | A change can be parked with a reason it can carry |
| 20 | a change id with no open folder, and ids shaped `..`, `a/b` and `archive` / park runs / each is refused naming the id, and no path is derived from it | int | No write escapes the project |
| 21 | a `change.md` written with CRLF line endings, on a path that must fail / park runs / the file is byte-identical, CRLF intact | int | A write that did not happen is never reported as done |
| 22 | a parked change and an unparked one, no pointer set anywhere, the parked one edited last / session-start context is produced / the parked change is not announced, the unparked one is | int | A parked change is not offered as work |
| 23 | a parked change / `set-active` runs on it / fails naming the park reason, no pointer created or changed | int | Only an open change can be made active |
| 24 | a parked change waiting on nothing, beside a ready change / `status --json` runs / the order names only the ready change, and `next` never names the parked one | int | A parked change is not offered as work |
| 25 | a project where nothing is parked / `status --json`, `observe --json` and validate run / every field keeps its value and order, and no parking behaviour is observable | int | A change can be parked with a reason it can carry |
| 26 | the extracted containment helper / the existing active-pointer behaviour is exercised through its public surface / it behaves exactly as before the extraction | int | No write escapes the project |
| 27 | a project whose own root is reached through a symlink / park and the active-pointer writes run / containment still resolves correctly and neither refuses a legitimate write | int | No write escapes the project |
| 28 | a reason carrying a hazard character that survives the reason check — a lone bidi override, no CR or LF — / park runs, then `status --all`, `set-active` and `archive` run against it / it parks, and EVERY echo comes back escaped and length-capped, never raw | int | A change can be parked with a reason it can carry |
| 29 | `sdlc/.state/journal` replaced by a symlink to a directory outside the project / park runs / nothing is written outside the project, and the change is still parked or refused — never a write that escapes | int | No write escapes the project |
| 30 | frontmatter carrying two `parked:` lines / unpark runs / it is refused saying the change would still read as parked, and the file is byte-identical | int | A write that did not happen is never reported as done |
| 31 | a `change.md` and its folder made read-only / park runs / it exits non-zero naming the change and what failed, and writes nothing | int | A write that did not happen is never reported as done |
| 32 | a parked change whose reason carries a bidi override / the journal event is read back / the stored reason is escaped, so a later reader and the ship learner never receive it raw | int | A change can be parked with a reason it can carry |
| 33 | a parked change whose blockers have all shipped / observe runs / it is NOT flagged as freed but not resumed | int | A parked change is not offered as work |
| 34 | a parked change waiting on two blockers, one ships / ship runs / the still-waiting line names it as parked as well as what it waits on | int | A parked change is not offered as work |
| 35 | a parked change with `sdlc/.state/journal` symlinked outside the project / unpark runs / nothing is written outside the project, and the change is either unparked or the unpark is refused — never a write that escapes | int | No write escapes the project |

## Out of scope (explicitly untested + why)
- A `blocked-by` added concurrently with a park can still strand a waiter: the graph is read,
  then the file is written, and `validate` is the backstop. The CONTAINMENT half of that window
  is closed rather than declared — the path is re-checked at the write, and the kernel refuses
  to follow a symlink where the platform offers the flag.
- Reason length: a reason is prose the human chose, so it is escaped and capped at display
  rather than rejected at write.
- `sdlc/backlog.md` for ideas that never became a change — a separate capability.

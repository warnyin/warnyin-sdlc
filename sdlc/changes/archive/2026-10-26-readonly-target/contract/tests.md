# Test contract — readonly-target
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Rows in `tests/readonly-target.test.mjs`; each runs on Windows AND in WSL Ubuntu (Node 22, checkout copied to /tmp). A leg that
cannot run on a platform skips with its reason. Root is out of scope: every row whose refusal root would bypass (1, 5–9)
skips under uid 0; rows 2 and 4 are controls that pass for anyone.
Rows marked † came from review 1 and were written after the build; evidence/mutations-{win32,linux}.txt prove them.

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | a file `old`, chmod 0o444 · `writeFileContained` · throws EACCES or EPERM; (†) `fs.openSync` and `fs.renameSync` are never called — no temp is made, on either platform; the file still `old` and read-only; the folder holds only it | unit | A read-only file is never replaced |
| 2 | the same file made writable again (0o644) · write · returns true with the new content (control) | unit | A read-only file is never replaced |
| 3 | security-regressions "change-artifacts row 10" passes on both platforms (red on Linux before the fix) | e2e | A read-only file is never replaced |
| 4 | a new path in a writable folder · write · returns true — the check applies only to an existing target | unit | A read-only file is never replaced |
| 5† | (POSIX) a writable file in a 0o555 folder · write · returns true with the new content, written in place, the folder holds only it; a new file there still throws EACCES/EPERM | unit | A file in a locked folder is still written |
| 6† | `update` where an owned, older `next.md` is 0o444 and an owned, older `verify.md` is writable · exit 0; `kept (not writable, not written): sdlc/.playbook/next.md`; next.md untouched, its manifest hash kept; verify.md refreshed and its new hash in the manifest | e2e | update keeps a file it may not write |
| 7† | `update --tool claude` with `.gitignore` (entry missing), `version.json`, `settings.json`, `config.yaml` each 0o444 and (POSIX) a stale owned file in a 0o555 folder · exit 0, one `kept (not writable, not written): <path>` per file, `prune kept (not writable): <path>` with its record kept, .gitignore untouched; then the manifest 0o444 · exit 0 and `manifest NOT saved (not writable)` | e2e | update keeps a file it may not write |
| 8† | (POSIX) `sdlc/evals` removed and `sdlc/` 0o555 · `update` · exit 0, `kept (not writable, not written): sdlc/evals` | e2e | update keeps a file it may not write |
| 9† | `init` with an existing 0o444 `.gitignore` lacking the entry · exit 0, `kept (not writable, not written): .gitignore`, file unchanged, manifest written | e2e | update keeps a file it may not write |

## Out of scope (explicitly untested + why)
- A file the process may not READ (0o200) still aborts update with EACCES at its read — a different class (reads), unchanged
  since before 0.29.0; recorded for the digest.
- Root/administrator: POSIX root may write any file (unchanged from the in-place write); Windows' read-only attribute still refuses
  an administrator. Rows skip under uid 0.
- Row 7's prune leg on Windows: Node's unlink clears the read-only attribute and removes the file, so no refusal can be staged.
- Row 5's fallback writes in place, so a crash mid-write there can leave half a file — the old behaviour, only where no temp can be made.
- A link or a dangling link at the target never reaches the check: `pathIsContained` refuses it first.

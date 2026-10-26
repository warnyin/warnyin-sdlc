---
id: readonly-target
tier: deep
status: shipped
spawned-from: [digest-backlog]
---
# Change: a read-only file stays refused under the atomic write
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
The v0.30.0 release gate failed on Linux: `artifact` stamped a change.md the user had made
read-only (0444). digest-backlog's temp-and-rename write never opens the target, and on POSIX a
rename needs only the folder's write permission, so a file a person locked against edits is
replaced. Windows refuses that rename, which is why the suite passed here. Nothing was published.

## Assumptions
- Reproduced in WSL Ubuntu, Node 22: security-regressions "change-artifacts row 10" fails; on this
  Windows host it passes (the read-only attribute makes rename fail EPERM, the fallback's in-place
  open then fails EACCES). The architect flagged the 0444 case in digest-backlog review 1 as a note;
  it was accepted without a row — that acceptance was wrong.
- Rule restored: an existing target the process may not write (`fs.accessSync(file, W_OK)` throws)
  is refused with that error before any temp is made — the same refusal the in-place write gave.
  On Windows `W_OK` reads the read-only attribute. Root/administrator bypass is unchanged (POSIX
  `access` says root may write; the old open succeeded for root too).
- Corrected in review 1: "every caller already handles a throw" was false. The artifact stamp and park
  do; `installFile`'s three writes do not, so a read-only owned file aborted `update` part way, with
  the manifest unwritten — on Linux under 0.29.0 too (its in-place open threw EACCES). Now kept with a
  warning, like a linked path. Sweep: Grep `writeInProject\(|writeFileContained\(` over bin lib →
  bin/cli.mjs installFile ×3 (now caught), the seed/settings/marker/manifest/gitignore/config sites
  (seeded or user files, unchanged behaviour: they are written once or appended), :1110 stamp, park.
- A folder the process may not write, around a writable file: the temp cannot be made there; the old
  in-place write could, so the write falls back to it (security review 1). Root is out of scope.
- The suite runs on POSIX here from now on: WSL Ubuntu with Node 22 in ~/.local/node22 (installed
  2026-10-26), via a script that copies the checkout into /tmp (chmod has no effect on /mnt/c).

## Delta: tool-adapters

### ADDED Requirement: A read-only file is never replaced
The system SHALL refuse a contained write to an existing file the process may not write, with the
platform's permission error and before any temporary file is created, leaving the file and its
folder unchanged.

#### Scenario: a change.md made read-only
- WHEN change.md is 0444 and `artifact` stamps it
- THEN the stamp fails naming the change and the failed write, and change.md is byte-identical

### ADDED Requirement: A file in a locked folder is still written
The system SHALL, when no temporary file can be created beside a writable existing file because the
folder refuses it, write that file in place as before.

#### Scenario: a 0555 folder
- WHEN a writable file sits in a folder the process may not write
- THEN the write succeeds and leaves no other entry in the folder

### ADDED Requirement: update keeps a file it may not write
The system SHALL, in `init` and `update`, keep every file it may not write or remove — payload files,
version.json, settings.json, marker files, seeds, `.gitignore`, config.yaml, a stale file prune would
remove — reporting `kept (not writable, not written): <path>` (`prune kept (not writable): <path>`),
keep its recorded ownership, and finish the run; a manifest it may not write is reported as
`manifest NOT saved (not writable)` and the run still exits 0.

#### Scenario: a read-only playbook file
- WHEN an owned, older playbook file is read-only and `update` would refresh it
- THEN update exits 0, leaves that file as it was, refreshes the others and writes the manifest

## Tasks
- [x] T1 writeFileContained refuses an existing non-writable target; rows in tests/readonly-target.test.mjs; red on Linux before, green on Linux (853/853) and Windows (853/851, 2 platform skips) after [tier:balanced]
<!-- review 1 (panel): security no blocker (noted a locked folder now failed). architect: a read-only owned file aborts update part way, manifest unwritten. ops: ledger must be rebuilt at release (release step; not a code defect). quality: row 1 cannot go red on Windows; root not skipped; row 5 missing from the contract; "before any temp" unpinned. -->
- [x] R1 classes: (a) an unhandled permission throw from the shared write aborting a multi-file run — installFile's three writes catch EACCES/EPERM and keep the file (row 6); (b) a regression row that cannot go red on the author's platform — row 1 spies openSync/renameSync and asserts no call, so a revert fails on Windows too (evidence/mutations-win32.txt); (c) an out-of-scope claim not enforced — rows skip under uid 0; (d) contract out of sync — rows 5, 6 added, out-of-scope corrected. Locked-folder fallback added (row 5). Evidence: linux 3 of 3 killed; win32 2 of 3 (row 5 is POSIX-only) [tier:balanced]
<!-- review 2 (architect, quality): R1 (a)-(d) closed for installFile. Both: the same class stands at every other init/update write — prune rmSync, version.json, the manifest, .gitignore, marker appends, settings.json, config.yaml — pre-existing since 0.29.0 or earlier. Human (2026-10-26): fix the whole class now. -->
- [x] R2 class: a permission error from any init/update write aborting the run — writeInProject returns why it did not write (`symlink in path` | `not writable`) instead of throwing, and every caller reports `kept (<why>, not written): <path>`; prune catches EACCES/EPERM and keeps the record; an unsaved manifest says so. Sweep: Grep `writeInProject\(` over bin → 12 sites, all on the new form (92 archive throws its own message, 180 installFile, 328/333 markers, 355 settings, 414 gitkeep, 422 seeds, 446 version.json, 458 manifest, 484 .gitignore, 666 config.yaml); `fs.rmSync\(` in cmdUpdate → prune, caught. Row 7. Evidence: linux 8 of 8, win32 5 of 8 (the 3 POSIX-only legs) [tier:balanced]
<!-- review 3 (architect, quality — last in budget): R2 closed for all 12 writeInProject sites and prune. Both: scaffoldSdlc's raw mkdirSync of the sdlc/ base folders still threw. quality: no init row; contract's root line broader than the tests. -->
- [x] R3: scaffoldSdlc's mkdir catches EACCES/EPERM and keeps the folder with a warning (row 8, POSIX); init row 9; root line corrected. Sweep: `mkdirSync` over bin → 119 (inside writeInProject's try), 404 (now caught), 972 (archive preflight, refuses before any merge). Evidence linux 9 of 9, win32 5 of 9 (4 POSIX-only legs). Full suite: linux 858/858, win32 858/854 (4 platform skips). Not re-paneled: the budget is spent — the human decides at ship. Recorded for the digest: a file the process may not READ (0o200) still aborts update at its read (different class, unchanged since before 0.29.0); archive's phase-2 "not writable" refusal does not list what was already merged. [tier:cheap]
- closed=human: review 3's only blocker (scaffoldSdlc's raw mkdir) was fixed with row 8 and a killed mutant after the budget was spent; the human shipped without a fourth panel (2026-10-26).

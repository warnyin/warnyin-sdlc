---
id: change-parking
tier: deep
status: shipped
spawned-from: [change-relations]
blocked-by: [change-relations]
---
# Change: Parking a change out of the way
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
Work discovered mid-change but not wanted now has nowhere to go: it becomes an open change that
competes for attention forever, or it is not written down at all. Nothing waits on it, so the
waiting graph cannot pause it. It needs a way to step aside that states why and strands nothing.

## Assumptions
- The first draft was withdrawn after a panel; the second reproduced two of the same defects —
  a write that escaped the project through a symlink, and a write reported as done that had not
  happened. Both are regressions here, and the write path is rebuilt rather than patched.
- Containment is NOT held to "the standard `lib/active.mjs` meets" by importing its helper: that
  standard is WHERE the check happens. `writePointer` re-checks the exact target immediately
  before its single write; anything that checks earlier and writes later is a wider window.
- Enumerated, not assumed: `grep -rn realpathSync lib/ bin/ payload/ scripts/` returns four
  containment predicates outside `lib/safe-path.mjs` — `payload/hooks/_update-notice.mjs:26`
  (the same rule inlined), `lib/skills.mjs:72` and `bin/cli.mjs:540,551` (prune's own rule).
  The first folds in here; the other two are recorded as deliberately different.

## Delta: change-parking

### ADDED Requirement: A change can be parked with a reason it can carry
The system SHALL park an open change only through a command that can refuse, and only with a
non-empty single-line reason taken from stdin rather than from a command line, and only when the
stored reason reads back exactly as given. Parking SHALL leave the change's stage untouched, and
SHALL be reversible by an unpark that returns the change to ordinary work.

#### Scenario: a reason that is not one
- WHEN a change is parked with an empty, absent, non-string or multi-line reason
- THEN it fails, the file is unchanged, and the change is not treated as parked

#### Scenario: a reason the format cannot carry back
- WHEN a reason would read back as something else — a bare `true`, a bare number, a trailing
  quote, padding
- THEN the park is refused naming what it would become, and nothing is written

#### Scenario: a change comes back
- WHEN a parked change is unparked
- THEN it is ordinary work again, and both events are journalled unless the journal itself
  cannot be written safely, in which case the park or unpark still stands

### ADDED Requirement: A write that did not happen is never reported as done
The system SHALL confirm, for BOTH park and unpark, that the file changed and that re-reading it
gives the intended state, and SHALL fail naming the change when it did not. A failure of the
underlying write SHALL surface as a named message and a non-zero exit, never as silence.

#### Scenario: a frontmatter block that cannot carry the key
- WHEN the target has no usable frontmatter block, or a body line merely looks like one
- THEN the command fails, only the frontmatter block is ever edited, and no event is recorded

#### Scenario: an unpark that leaves the change parked
- WHEN removing the key would leave the change still reading as parked
- THEN the unpark fails saying so, rather than reporting success

#### Scenario: the file cannot be written
- WHEN the write itself fails
- THEN the command exits non-zero naming the change, and says what failed

### ADDED Requirement: No write escapes the project
The system SHALL verify, immediately before each write and against the exact path being written,
that it really resolves inside the project, following no symlink out of it — for the change file
and for the journal the event is appended to alike. One implementation SHALL serve every caller.

#### Scenario: a path that is really somewhere else
- WHEN a change folder, a change file, or the journal directory or file is a symlink pointing
  outside the project
- THEN the write is refused, nothing outside the project is read or written, and it says why

#### Scenario: the path changes after it is checked
- WHEN the target is replaced between the guard and the write
- THEN the write still refuses, because the check is made against the path being written

## Delta: change-relations

### ADDED Requirement: A parked change is not offered as work
The system SHALL leave a parked change out of the default listing, the ordering, what is offered
as next work, and the flag for work freed but never resumed — while counting it, listing it on
request, naming it as parked wherever it is shown, and refusing to ship it. A change that is
itself waiting SHALL still be parkable, and a report that stops it waiting SHALL say it is
parked rather than offer a command that would be refused.

#### Scenario: parked, and every surface that offers work
- WHEN a parked change would otherwise be listed, ordered, offered as next work, or flagged as
  freed but not resumed
- THEN it appears in none of them, is counted, and is shown with its reason on request

#### Scenario: a blocker of a parked change ships
- WHEN the last change a parked change waited on ships
- THEN it is reported as no longer waiting but parked, with no command that would be refused

#### Scenario: a parked change is shipped
- WHEN a parked change is shipped
- THEN the ship is refused naming the reason, and nothing is merged or moved

### MODIFIED Requirement: Status says why a change is paused
The system SHALL show, for each open change it lists, what it is still waiting on, what it was
discovered from, and — for a change that is ready — how many others it would free, in both the
human listing and the machine output.

#### Scenario: a change waiting on two others
- WHEN the open changes are listed
- THEN both names appear, distinguishable from a change that is merely idle

### MODIFIED Requirement: A relation must name a real change
The system SHALL reject a relation that resolves to no change, names the change declaring it,
repeats a name already listed, names a parked change, or is not a single safe path segment. A
relation SHALL count as satisfied only against a change that really shipped — matched on its
whole id, and proven by the archived change itself rather than by the name of a folder. A
refusal SHALL name the offending entry, escaped and length-capped, and SHALL name the remedy.

#### Scenario: an entry that is not a change
- WHEN a relation names the archive folder, a change that no longer exists, itself, or an entry
  carrying a separator, `..`, a control character or a display-reordering character
- THEN validation fails naming the entry and how to remove it, and no path is derived from it

#### Scenario: an entry naming a parked change
- WHEN a relation names a change that is parked
- THEN validation fails naming that change and its reason, and how to remove the entry

#### Scenario: an archive folder that proves nothing
- WHEN an archive folder carries a blocker's name but holds no shipped change, or carries a
  name the blocker's id only ends with
- THEN the blocker still counts as open, and shipping the change waiting on it is refused

## Delta: change-focus

### MODIFIED Requirement: Only an open change can be made active
The system SHALL refuse to make active any change id that is not a single safe path segment
naming an existing open change, or that names a parked change, leaving every pointer unchanged
when it refuses.

#### Scenario: an unsafe, missing or archived change id
- WHEN the active change is set to an id that is unsafe, has no open change folder, or names
  the archive
- THEN the command fails with a usage error and no pointer is created or changed

#### Scenario: a parked change id
- WHEN the active change is set to a change that is parked
- THEN the command fails naming the park reason, and no pointer is created or changed

## Design
- decision: containment is re-checked against the exact path immediately before every write ·
  alternatives: one check at resolve time · because: `park` runs a whole-tree `analyze()` between
  the two, turning a microsecond window into an I/O-bound one, and the guard that was "shared"
  was still the wrong shape.
- decision: the journal write is guarded at its own target, not at `.state` · alternatives: the
  ancestor check shipped in the first attempt · because: `.state/journal` as a symlink defeats an
  ancestor check entirely, which is how the event escaped the project.
- decision: one cross-cutting "not offered as work" requirement in `change-relations` ·
  alternatives: a MODIFIED per rule it contradicts · because: six MODIFIED bodies would not fit
  the cap, and one spec file should answer "why is my change not offered?".
- decision: unpark proves its result the way park does · alternatives: trusting the removal ·
  because: a duplicated key made `removeFrontmatterKey` drop the first and report success while
  the reader still saw the second.
- decision: the reason is escaped wherever it is shown AND wherever it is stored for a reader ·
  alternatives: escaping at display only · because: the journal is read back by `observe` and
  handed to the learner at ship, which the display rule never covered.

## Tasks
- [x] T1 fold `_update-notice.mjs`'s inlined containment onto `lib/safe-path.mjs`; record prune's and skills' as deliberately separate [tier:balanced]
- [x] T2 containment re-checked at the exact target immediately before every write, change file and journal alike [tier:deepest]
- [x] T3 park and unpark both prove their result; any write failure exits non-zero with a named message [tier:deepest]
- [x] T4 the reason escaped where stored for a later reader, not only where displayed [tier:balanced]
- [x] T5 parked excluded from the observe flag, and named as parked in the still-waiting report [tier:balanced]
- [x] T6 `sdlc-conventions` skill, pack-verify list, CHANGELOG `## Unreleased` [P] [tier:cheap]
- [x] T7 repair row 9 to test what it claims; add rows for every scenario above [tier:balanced]

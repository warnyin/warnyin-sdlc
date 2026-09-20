---
id: change-parking
tier: deep
status: new
spawned-from: [change-relations]
blocked-by: [change-relations]
---
# Change: Parking a change out of the way
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
Work discovered mid-change but not wanted now has nowhere to go: it becomes an open change that
competes for attention forever, or it is not written down at all. Nothing is waiting on it, so
the waiting graph cannot pause it. It needs a way to step aside that states why, survives being
read months later, and cannot strand anything behind it.

## Assumptions
- This waits on `change-relations`: its parked rules must modify that change's own text in
  `specs/change-focus/spec.md`, and the waiting graph it needs does not exist until then.
- The first draft of this shipped inside `change-relations` and was withdrawn after a review
  panel; its four defects are the starting contract here, not hypotheses. [UNVERIFIED] only in
  that the fixes are not yet written — the defects themselves were each reproduced by running.
- Parking writes to a file the user owns, so it is held to `lib/active.mjs`'s existing standard
  (realpath containment, no symlink in any segment, a refused write reported as refused).

## Delta: change-parking

### ADDED Requirement: A change can be parked with a stated reason
The system SHALL park an open change only through a command that can refuse, and only with a
reason that is a non-empty string, taken from stdin rather than from a command line. Parking
SHALL leave the change's stage untouched, and SHALL leave it out of the default listing, the
ordering and what is offered as next work, while keeping it reachable on request.

#### Scenario: a reason that is not one
- WHEN a change is parked with an empty, absent, non-string or whitespace-only reason
- THEN it fails, the file is unchanged, and the change is not treated as parked

#### Scenario: a parked change mid-build
- WHEN a change that is already being built is parked
- THEN its stage is unchanged, it is counted but not listed, and it is listed on request

### ADDED Requirement: Parking is reversible by the same kind of command
The system SHALL provide an unpark that removes the reason and returns the change to the
listing, the ordering and next work, and SHALL never require a human to hand-edit the
frontmatter that the park command owns.

#### Scenario: a change comes back
- WHEN a parked change is unparked
- THEN it is listed, ordered and offerable again, and the journal records both events

### ADDED Requirement: A park that did not happen is never reported as done
The system SHALL write the reason only inside the change's frontmatter block, SHALL verify the
file actually changed, and SHALL fail loudly naming the change when it did not.

#### Scenario: a change whose frontmatter cannot carry the key
- WHEN the target has no usable frontmatter block
- THEN the command fails, nothing is written, and no park event is recorded

#### Scenario: a body line that looks like frontmatter
- WHEN the change's body contains a line beginning `status:` or `parked:`
- THEN it is left untouched, and only the frontmatter block is edited

### ADDED Requirement: Parking never writes outside the project
The system SHALL refuse to park a change whose folder or file does not really resolve inside
the project's `changes/` directory, following no symlink out of it.

#### Scenario: a change folder that is a link elsewhere
- WHEN a checkout carries a change folder that is a symlink pointing outside the project
- THEN the park is refused, nothing outside the project is read or written, and it says why

### ADDED Requirement: Nothing may be left waiting on a parked change
The system SHALL refuse to park a change another open change is waiting on, and SHALL refuse a
new relation that would wait on a change already parked, naming in each case what would be
stranded. A change that is itself waiting SHALL still be parkable.

#### Scenario: the deadlock from either direction
- WHEN a change two others wait on is parked, or a change declares it waits on a parked change
- THEN the attempt fails naming the stranded changes and the park reason, and nothing is written

### ADDED Requirement: A parked change is never presented as work
The system SHALL not offer a parked change as the active change, as the next step, or as the
most recent change when no pointer is set, and SHALL refuse to ship it while parked.

#### Scenario: no pointer set anywhere
- WHEN a change is parked and a session with no active pointer asks what it is working on
- THEN the parked change is not offered, and an unparked change is resolved instead

#### Scenario: a parked change is shipped
- WHEN a parked change is made active or shipped
- THEN both are refused while it is parked

## Design
- decision: the reason arrives on stdin, with no command-line fallback · alternatives: an argv
  form for convenience · because: the constitution forbids human prose reaching a shell as an
  argument, and a usage line that shows the unsafe form teaches it.
- decision: park and unpark ship together · alternatives: park first · because: three error
  paths in the first draft told the human to unpark and no unpark existed.
- decision: the writer edits only between the frontmatter fences and verifies the file changed ·
  alternatives: a whole-file regex · because: the first draft silently no-opped and reported
  success, and could target a body line that merely looked like frontmatter.

## Tasks
- [ ] T1 `lib/park.mjs`: reason validation, fence-scoped read/modify/write, realpath containment [tier:deepest]
- [ ] T2 `journal.mjs park` / `unpark` on stdin, both refusing both deadlock directions [tier:deepest]
- [ ] T3 status: hide parked by default, count them, `--all` to list, exclude from ordering [tier:balanced]
- [ ] T4 active/ship/next: never offer or ship a parked change [tier:balanced]
- [ ] T5 `next.md` + `ship.md` + templates say how parking is entered and left [P] [tier:cheap]
- [ ] T6 `tests/change-parking.test.mjs`, including the symlink and no-op regressions [tier:balanced]

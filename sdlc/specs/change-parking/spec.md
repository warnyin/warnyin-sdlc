# Spec: change-parking

## Purpose
How a change steps aside with a stated reason and comes back: what a reason has to be for the
format to carry it, how a write into a file the user owns is proved and contained, and what
parking must never strand.

## Requirements

### Requirement: A change can be parked with a reason it can carry
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

### Requirement: A write that did not happen is never reported as done
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

### Requirement: No write escapes the project
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
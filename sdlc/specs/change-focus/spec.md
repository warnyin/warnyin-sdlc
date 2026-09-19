# Spec: change-focus

## Purpose
Which change a session is working on and how one is arrived at: what a session points at,
how concurrent sessions stay out of each other's way, and how an idea is groomed into a
change worth opening at all.

## Requirements

### Requirement: Next answers for this session's change first
The system SHALL report the change the current session is working on ahead of any
other open change and, only when this session set that change itself, mark every other
open change as not belonging to this session.

#### Scenario: several changes open, this session set one
- WHEN several changes are open and the current session has set one of them active
- THEN that change is reported first with its next command, and every other open change
  is shown only as context, marked as not this session's

#### Scenario: this session has set none, but the project has a last-set change
- WHEN the current session has not set an active change and the project has one
- THEN that change is reported first, marked as last set for the project rather than
  confirmed for this session, and no other open change is marked as not this session's

#### Scenario: no usable pointer
- WHEN no active change is set, or the one set no longer exists as an open change
- THEN the open changes are listed and none is claimed as this session's

### Requirement: One session's focus does not move another's
The system SHALL keep the active change per session, so that setting it in one session
changes neither what another session reports nor where that session's events are recorded.

#### Scenario: two sessions on different changes
- WHEN session A sets change X active and then session B sets change Y active
- THEN session A still reports X first and its events are recorded against X, while
  session B reports Y first and its events are recorded against Y

#### Scenario: the tool exposes no session identity
- WHEN a change is set active where no session identity is available
- THEN it behaves as a single project-wide active change, as before

### Requirement: A session identifier cannot direct a write
The system SHALL refuse to derive any file location from a session identifier that is
not a single safe path segment.

#### Scenario: a hostile or malformed session identifier
- WHEN the session identifier contains a path separator, `..`, a drive or stream colon,
  or a Windows reserved device name
- THEN no session-scoped file is written or read, and the project-wide pointer is used

#### Scenario: steering bookkeeping receives an unsafe session identifier
- WHEN a hook records which steering files a session has been pointed at, under an unsafe
  session identifier
- THEN no file name is derived from that identifier

### Requirement: Only an open change can be made active
The system SHALL refuse to make active any change id that is not a single safe path segment
naming an existing open change, leaving every pointer unchanged when it refuses.

#### Scenario: an unsafe, missing or archived change id
- WHEN the active change is set to an id that is unsafe, has no open change folder, or names
  the archive
- THEN the command fails with a usage error and no pointer is created or changed

### Requirement: Shipping a change releases every pointer to it
The system SHALL remove, when a change ships, every session and project pointer naming that
change, and no pointer naming anything else.

#### Scenario: pointers name the shipped change and another change
- WHEN a change ships while a session pointer and the project pointer name it and another
  session's pointer names a different open change
- THEN the pointers naming the shipped change are gone and the other session's pointer is
  unchanged

### Requirement: A change can be groomed before it is opened
The system SHALL offer a grooming step that runs before a change exists, whose job is to find
the outcome the human actually wants rather than to specify a solution already assumed. It
SHALL interrogate the problem rather than the proposed solution, SHALL verify by running what
it will later record as an assumption, SHALL offer more than one shape with the cheapest
acceptable one first, SHALL be able to conclude that nothing should be built, and SHALL write
no artifact of its own — its result is the Why and the Assumptions `/sdlc:new` opens with.

#### Scenario: a one-line ask
- WHEN the request names a solution but not the outcome, and grooming runs
- THEN the questions put to the human are about what breaks today, what done looks like, what
  must not change and the cheapest acceptable outcome — not about how to build what was named

#### Scenario: a claim that would narrow the work
- WHEN grooming finds something it intends to carry into the change's Assumptions
- THEN it runs it first, so what reaches `## Assumptions` is verified rather than plausible

#### Scenario: not worth building
- WHEN the honest answer is that the outcome does not justify a change
- THEN grooming may end there, and no change folder is created

#### Scenario: a tool without slash commands
- WHEN a project installs a tool whose stages are exposed as skills rather than commands
- THEN grooming is exposed there too, by the same rendering as every other stage
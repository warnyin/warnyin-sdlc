# Spec: change-relations

## Purpose
Which changes wait on which, and which was discovered from which: how that edge is declared and
kept honest, what it forbids at ship, and how a change that becomes workable again is announced.

## Requirements

### Requirement: A change records what blocks it and where it came from
The system SHALL let a change name, in its own frontmatter, every change it is waiting on and
every change it was discovered from, each as a list. The opposite direction SHALL be derived
from what the open changes declare, never stored a second time.

#### Scenario: a change waits on more than one
- WHEN a change names two changes it is waiting on
- THEN both are recorded on that change alone, and each named change is left byte-identical

#### Scenario: a project using no relations
- WHEN no change declares a relation key
- THEN every existing field of the machine-readable listing keeps its value and its order, and
  what is added is additive

### Requirement: A relation must name a real change
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

### Requirement: Relations never form a cycle
The system SHALL reject a set of relations in which a change reaches itself, by waiting or by
discovery, and SHALL warn when a waiting chain grows beyond three changes.

#### Scenario: a cycle through a third change
- WHEN A waits on B, B waits on C and C waits on A
- THEN validation fails naming the changes in the cycle, and no ordering is reported

### Requirement: Reporting survives a graph that does not validate
The system SHALL keep listing changes and reporting observations when relations are invalid,
reporting no ordering rather than failing, so the human can still see what to edit. A change
whose neighbours cannot be read SHALL still be shippable, with its report reported incomplete.

#### Scenario: a cycle and a dangling relation
- WHEN the open changes contain both and the listing and the observation report are produced
- THEN both list every change, neither raises an error, and neither claims an ordering

#### Scenario: an unreadable neighbour
- WHEN one change's file cannot be read and an unrelated change is shipped
- THEN the ship proceeds and says the freed report may be incomplete, while a project-wide
  validation still reports the unreadable change as an error

### Requirement: Status says why a change is paused
The system SHALL show, for each open change it lists, what it is still waiting on, what it was
discovered from, and — for a change that is ready — how many others it would free, in both the
human listing and the machine output.

#### Scenario: a change waiting on two others
- WHEN the open changes are listed
- THEN both names appear, distinguishable from a change that is merely idle

### Requirement: Shipping refuses while a blocker is still open
The system SHALL refuse to ship a change that is still waiting, before any spec is merged, any
status is stamped and any folder is moved. A blocker still sitting among the open changes SHALL
count as open whatever its own status says.

#### Scenario: a ship attempted too early
- WHEN a change waiting on an open change is shipped
- THEN it fails naming every open blocker, and specs, status and folder are all unchanged

### Requirement: Shipping reports who it freed and who is still waiting
The system SHALL read the waiting changes before it merges anything, and report after the move
which of them are now free to resume and which are still waiting and on what. Nothing after the
move may turn a done ship into a failure. The ship stage SHALL relay that report to the human
and record it, so the moment a change becomes workable does not live only in a terminal.

#### Scenario: one of two blockers ships
- WHEN a change waits on two changes and the first ships
- THEN it is reported still waiting, naming the remaining blocker, and is not called resumable

#### Scenario: the last blocker ships
- WHEN the final change it waited on ships
- THEN it is reported free to resume, with the command that resumes it

### Requirement: A change freed long ago but never resumed is surfaced
The system SHALL flag an open change whose blockers have all shipped but which has had no
activity since, and a change that more than one other change is waiting on.

#### Scenario: freed and forgotten
- WHEN every change it waited on has shipped and nothing has happened to it since
- THEN the observation report flags it as freed but not resumed

### Requirement: Among ready changes, the one that frees the most goes first
The system SHALL order changes that are not waiting by how many others wait on them, then by
tier, then by how long each has been idle, and SHALL fall back to a stable order when no
activity is recorded — as it is not, in a fresh checkout.

#### Scenario: two ready changes, one frees more
- WHEN two others wait on the first of two ready changes
- THEN it is offered ahead of the second, with the count that decided it

### Requirement: A parked change is not offered as work
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
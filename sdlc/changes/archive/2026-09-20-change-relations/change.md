---
id: change-relations
tier: deep
status: shipped
---
# Change: Relations between changes
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
A change opened from inside another leaves no trace of the link. The paused one survives as a
folder but not as a reason, and nothing wakes it when what it waited for ships — the moment it
becomes workable again is the one carrying no signal. Many changes can wait on many, so the
answer has to count what is left rather than announce an all-clear.

## Assumptions
- Relation checks need siblings, so they go in `validateAll`, which holds `sdlcRoot` and which
  `cmdArchive` uses. The write-time hook calls `validateChange` (`validate-artifact.mjs:30`),
  which takes no root — passing one is additive and would work, so keeping relation checks out
  of the keystroke path is a COST decision (a full-graph scan on every `sdlc/` write), not a
  signature constraint. Errors surface at validate and at ship instead.
- Relation lists need no parser work: `coerce` in `lib/frontmatter.mjs` already reads `[a, b]`
  and `- item`; `lib/lenses.mjs` is the list-valued-key precedent to copy.
- The freed report is best-effort under concurrent ships; `status` is the authority. No lens
  applies: no entity stored, no schema path touched.
- "No relation concept exists yet" rests on grepping nine words (related|spawned|parent|depends|
  blocked|follow-up|followup|defer|discover) over `payload lib bin`. Confirmed independently by
  two reviewers on the finished diff.

## Delta: change-relations

### ADDED Requirement: A change records what blocks it and where it came from
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

### ADDED Requirement: A relation must name a real change
The system SHALL reject a relation that resolves to no change, names the change declaring it,
repeats a name already listed, or is not a single safe path segment. A relation SHALL count as
satisfied only against a change that really shipped — matched on its whole id, and proven by
the archived change itself rather than by the name of a folder. A refusal SHALL name the
offending entry, escaped and length-capped, and SHALL name the remedy.

#### Scenario: an entry that is not a change
- WHEN a relation names the archive folder, a change that no longer exists, itself, or an entry
  carrying a separator, `..`, a control character or a display-reordering character
- THEN validation fails naming the entry and how to remove it, and no path is derived from it

#### Scenario: an archive folder that proves nothing
- WHEN an archive folder carries a blocker's name but holds no shipped change, or carries a
  name the blocker's id only ends with
- THEN the blocker still counts as open, and shipping the change waiting on it is refused

### ADDED Requirement: Relations never form a cycle
The system SHALL reject a set of relations in which a change reaches itself, by waiting or by
discovery, and SHALL warn when a waiting chain grows beyond three changes.

#### Scenario: a cycle through a third change
- WHEN A waits on B, B waits on C and C waits on A
- THEN validation fails naming the changes in the cycle, and no ordering is reported

### ADDED Requirement: Reporting survives a graph that does not validate
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

### ADDED Requirement: Status says why a change is paused
The system SHALL show, for each open change, what it is still waiting on, what it was
discovered from, and — for a change that is ready — how many others it would free, in both the
human listing and the machine output.

#### Scenario: a change waiting on two others
- WHEN the open changes are listed
- THEN both names appear, distinguishable from a change that is merely idle

### ADDED Requirement: Shipping refuses while a blocker is still open
The system SHALL refuse to ship a change that is still waiting, before any spec is merged, any
status is stamped and any folder is moved. A blocker still sitting among the open changes SHALL
count as open whatever its own status says.

#### Scenario: a ship attempted too early
- WHEN a change waiting on an open change is shipped
- THEN it fails naming every open blocker, and specs, status and folder are all unchanged

### ADDED Requirement: Shipping reports who it freed and who is still waiting
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

### ADDED Requirement: A change freed long ago but never resumed is surfaced
The system SHALL flag an open change whose blockers have all shipped but which has had no
activity since, and a change that more than one other change is waiting on.

#### Scenario: freed and forgotten
- WHEN every change it waited on has shipped and nothing has happened to it since
- THEN the observation report flags it as freed but not resumed

### ADDED Requirement: Among ready changes, the one that frees the most goes first
The system SHALL order changes that are not waiting by how many others wait on them, then by
tier, then by how long each has been idle, and SHALL fall back to a stable order when no
activity is recorded — as it is not, in a fresh checkout.

#### Scenario: two ready changes, one frees more
- WHEN two others wait on the first of two ready changes
- THEN it is offered ahead of the second, with the count that decided it

## Delta: change-focus

### MODIFIED Requirement: Next answers for this session's change first
The system SHALL report the change the current session is working on ahead of any other open
change and, only when this session set that change itself, mark every other open change as not
belonging to this session. When that change is waiting on another, the system SHALL report what
it waits on instead of offering it as the work to do next.

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

#### Scenario: this session's change is waiting
- WHEN the change this session set active is waiting on an open change
- THEN the change it waits on is reported as the work, and the waiting one is not

## Design
- decision: store the edge only on the waiting side · alternatives: both sides, or a state
  file · because: two stored copies drift with no transaction, while the reverse direction is
  a scan of changes the CLI already reads.
- decision: an archived folder is evidence, not proof · alternatives: trust the folder name ·
  because: `changes/archive/` is ordinary repo content, so a planted empty directory would
  otherwise retire a blocker that is still open.
- decision: waiting changes are read before the merge, reported after the move · alternatives:
  read after · because: a read failure before the merge refuses cleanly; after, it half-ships.
- decision: ordering is computed · alternatives: a declared priority · because: two sources of
  "important" drift apart, and the one nobody re-reads is the one that lies.

## Tasks
- [x] T1 `lib/relations.mjs`: parse/validate the lists, resolve open vs shipped, detect cycles [tier:deepest]
- [x] T2 wire T1 into `validateAll`, so ship and a project-wide run agree [tier:balanced]
- [x] T3 `readChanges` + `cmdStatus`: waiting markers, frees-count, additive JSON [P] [tier:cheap]
- [x] T4 `cmdArchive`: refusal and the read of waiting changes, both before the merge [tier:deepest]
- [x] T5 `cmdArchive`: freed / still-waiting report after the move, never throws [tier:deepest]
- [x] T6 ordering: frees-most, tier, idle, stable fallback [tier:balanced]
- [x] T7 `observe`: freed-but-not-resumed and many-waiting flags [P] [tier:balanced]
- [x] T8 status/observe stay answerable on an invalid graph [tier:balanced]
- [x] T9 playbook + templates: `new.md`, `next.md`, and `ship.md` relaying the freed report [P] [tier:cheap]
- [x] T10 `tests/change-relations.test.mjs` black-box coverage for T1–T9 [tier:balanced]
- [x] T11 an archived blocker must be proven by the shipped change, not by a folder name [tier:deepest]
- [x] T12 escape display-reordering characters, one shared open-change lister, pack-verify entry [tier:cheap]

---
id: journal-out-of-tree
tier: deep
status: shipped
---
# Change: Agent-appended telemetry stops dirtying the tracked tree
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
The journal a session appends to lives inside the change folder, which is tracked in
git — so merely opening a project modifies a shared file that no human touched. On a
team that blocks `git pull` and branch switches until someone discards the file, and
two people working the same change conflict on the appended tail for a reason that has
nothing to do with the change under review. GitHub issue #3.

## Assumptions
- A shipped change still carries its journal into the archive, rather than the journal
  becoming local-only. Safe: that write happens once, at a human-triggered ship, by the
  one person shipping — so no session dirties the tree by itself, the tail can never
  conflict, and `observe` keeps reporting a teammate's shipped changes after a clone.
- Telemetry already recorded at the old in-tree path is merged, not discarded, and the
  old file is cleaned up only at ship. Safe: no recorded event is lost, and no extra
  tracked-file churn is introduced outside the ship commit.
- Tier is `deep` because this moves a file that lives inside other people's projects,
  per `harness.md § Tier triage`.

## Delta: flow-journal

### ADDED Requirement: A session never modifies a version-controlled file on its own
The system SHALL append telemetry only to locations excluded from version control, so
that opening or running a session leaves the tracked working tree unchanged.

#### Scenario: a session records events against an open change
- WHEN a session appends telemetry while a change is open
- THEN no version-controlled file is modified

#### Scenario: two people work the same change on separate clones
- WHEN each of them appends telemetry against the same open change
- THEN neither one's appended events reach a version-controlled file, and merging their
  branches raises no conflict originating in telemetry

### ADDED Requirement: A shipped change carries its telemetry into the archive
The system SHALL place a change's complete recorded telemetry in the archived change
folder when the change ships.

#### Scenario: a change is archived
- WHEN a change ships
- THEN its archived folder holds every event recorded for that change, in recorded order

#### Scenario: a change carries telemetry from both the old and the current location
- WHEN telemetry exists for a change at the earlier in-tree location as well as the
  out-of-tree one
- THEN the archived folder holds both sets in recorded order, and no telemetry file is
  left behind at the in-tree location

### ADDED Requirement: Reporting reads an open change's telemetry from where it is written
The system SHALL count an open change's out-of-tree telemetry in what it reports about
that change.

#### Scenario: a report covers a change that has not shipped
- WHEN a report is produced for an open change
- THEN the events recorded out of tree for that change are counted, not reported as absent

## Design
<!-- decisions & trade-offs only — never restate the delta. Escalate irreversible decisions per Autonomy policy. -->
- decision: live telemetry lands at `sdlc/.state/journal/<id>.ndjson` · alternatives: gitignore
  `changes/**/journal.ndjson` / a `config.yaml` opt-out · because: `.state/` is already ignored in
  every installed project, so no new entry and no `git rm --cached`; and prune provably cannot
  reach it — the allowlist excludes it and a forged manifest entry there is rejected as outside
  prunable scope, so this adds nothing to the data-loss surface.
- decision: the archive keeps a tracked journal, sealed in one write at ship · alternatives: no
  archived journal at all · because: dropping it loses cost/verify history for anyone who did not
  ship the change themselves, and one ship-time write by one person has neither failure mode the
  issue reports.
- decision: telemetry at the old in-tree path is read alongside the new stream and removed at ship
  · alternatives: ignore it / delete it on first write · because: no recorded event is lost, and
  the only deletion of a tracked file happens inside the ship commit where a human reviews it.
- decision: path + merge logic lives in `lib/` · alternatives: duplicate it in the hook and in
  `observe` · because: three consumers need the same answer (CLI, observe, installed hooks) and
  `lib/` is the one tree the installer copies into user projects, reachable as `./lib/journal.mjs`.
- decision: tree-cleanliness gets a git-backed test · alternatives: assert the new path only ·
  because: no existing test inits a git repo, so a path assertion would pass while the symptom the
  issue reports went unproven.

## Tasks
- [x] T1 `lib/journal.mjs`: resolve live/legacy/archived paths, read+merge in recorded order [tier:balanced]
- [x] T2 `payload/hooks/_shared.mjs` `appendJournal` writes out of tree via T1 [tier:balanced]
- [x] T3 `lib/observe.mjs` reads an open change through T1 (live + legacy) [P] [tier:balanced]
- [x] T4 `bin/cli.mjs` `cmdArchive` seals the merged journal into the archive folder before the move, removes the legacy in-tree file, and lands the ship event in the live stream [tier:balanced]
- [x] T5 tests: git-backed clean-tree test (new shape — `git init` in the temp project), archive seals both sources, observe counts live events [tier:cheap]
- [x] T6 repoint tests that encode the old path, and the vacated archive-regression assertion [tier:balanced]
- [x] T7 update `docs/design.md` ledger row + `sdlc-conventions` layout line for the new residency [P] [tier:cheap]
- [x] R1 review blocker: seal after the rename, not before — the sealed and legacy paths are one file, so sealing first made a failed rename double every event on retry [tier:balanced]
- [x] R2 review blocker: gate the change id in `cmdArchive` before any write — `a/../b` reached a real folder and shipped, then failed on the journal paths that do gate it [tier:balanced]

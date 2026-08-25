---
id: unattended-run
tier: deep
status: shipped
---
# Change: `--auto` on every stage — ask everything up front, then run to ship
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
`/sdlc:auto` already runs the whole pipeline, but it stops at every escalation, so
the human is pulled back in three or four times per change and ends up typing each
stage anyway. The questions are knowable at the start; what makes them interrupt is
that nobody asked them yet.

## Assumptions
- Pre-authorization is scoped to one run. It is not written to config, not
  remembered across changes, and not inherited by a resumed run — the human
  re-confirms. Safe because a standing "never ask me" would outlive the reasoning
  that justified it.
- The confirmation happens BEFORE anything is written: no `change.md`, no journal
  entry, no gate. A declined confirmation must leave the repo byte-identical.
- `--auto` on a later stage runs that stage and everything after it, never earlier
  ones: `/sdlc:build --auto` will not re-open a contract. The pipeline is a ratchet.
- Every escalation the run passes through under pre-authorization is journalled with
  the decision the human pre-approved, so `/sdlc:observe` and the digest can show
  where a human would normally have stood. Reuses the `mode=` field convention from
  `flow-journal`.
- A hard-floor surface still surfaces in the confirmation as a named line item, so
  "ship without me" is a decision the human makes while looking at what it covers —
  not a blanket flag they forgot they set.

## Delta: unattended-run

### ADDED Requirement: Every stage command accepts `--auto`
The system SHALL accept `--auto` on each stage command, and SHALL then carry the
change from that stage through to ship without asking again.

#### Scenario: from the first stage
- WHEN the human opens a change with `--auto`
- THEN the pipeline runs new through ship in one go

#### Scenario: from a later stage
- WHEN the human passes `--auto` to a stage after the change already exists
- THEN the run continues from that stage onward and never re-runs an earlier one

### ADDED Requirement: Everything decidable is asked before any work starts
The system SHALL gather, in one confirmation, what it needs to run unattended: the
scope it understood, the tier it triaged, every ambiguity it would otherwise raise
mid-run, and the escalation decisions it wants pre-approved.

#### Scenario: the human confirms
- WHEN the human approves that summary
- THEN the run proceeds to ship without further questions

#### Scenario: the human declines
- WHEN the human declines or edits the summary
- THEN nothing has been written yet, and the run either revises the summary or stops

### ADDED Requirement: Pre-authorization is bounded and recorded
The system SHALL apply the pre-approved decisions only to the run they were given
for, and SHALL record in the journal each escalation it passed under that authority.

#### Scenario: an escalation is passed unattended
- WHEN the run hits a condition that would normally stop it and a pre-approval covers it
- THEN it proceeds and the outcome records that it ran under pre-authorization

#### Scenario: an escalation nobody pre-approved
- WHEN the run hits a condition outside what was confirmed
- THEN it stops there and asks, exactly as an unattended flag had never been passed

### ADDED Requirement: The digest shows where a human would have stood
The system SHALL name, in the digest of a change shipped unattended, the escalations
that were passed under pre-authorization.

#### Scenario: a change shipped unattended
- WHEN a change ships with at least one pre-authorized escalation
- THEN its digest lists them rather than reporting an uneventful run

## Design
- decision: one confirmation before any write · alternatives: confirm after triage
  writes `change.md` · because: a declined run must leave nothing behind, and a
  half-written change is the thing people then have to clean up by hand.
- decision: pre-authorization is per-run, never persisted · alternatives: a config
  key, a remembered preference · because: an unattended-by-default repo is one bad
  triage away from shipping something nobody read.
- decision: `--auto` composes with the existing `auto.md` rather than duplicating the
  pipeline into each stage · alternatives: per-stage orchestration blocks · because:
  the status → stage mapping already lives in `next.md` and must not fork.
- decision: escalations pass with a journalled record instead of silently ·
  alternatives: pass quietly, or print only to the terminal · because: the whole
  point of the previous change is that the record must show how a verdict was reached.
- decision: `--auto` is read from the argument text by the playbook, not added as a
  CLI flag · alternatives: parse it in `bin/cli.mjs` · because: the payload serves six
  harnesses and only some pass structured args; doctrine-level parsing works in all of
  them and keeps this change out of the installer entirely.
- decision: the confirmation is plain session text, not a tool-specific prompt widget
  · alternatives: a Claude question control · because: the same playbook runs under
  Cursor, Copilot and the rest, where such a control does not exist.
- decision: escalations are journalled as their own `escalation` event carrying the
  condition and whether pre-authorization covered it · alternatives: a field on the
  verify/review notes · because: an escalation can fire in any stage, including ones
  that have no note of their own, and a per-stage field would silently drop those.
- decision: the entry stage is whatever the change's status maps to in `next.md` §2,
  even when the human typed an earlier stage; the run announces what it skipped ·
  alternatives: honour the typed stage, or refuse · because: re-running contract over
  a built change is how a good change gets overwritten, and refusing turns a typo
  into a dead end.

## Tasks
- [x] T1 `auto.md`: define the gather → confirm → run contract, the confirmation's content, and per-run scoping [tier:deepest]
- [x] T2 stage playbooks: each names `--auto` and hands off to `auto.md` from its own stage onward, never earlier [tier:balanced]
- [x] T3 command stubs: `argument-hint` advertises `--auto` on every stage command [P] [tier:cheap]
- [x] T4 journal + digest: record pre-authorized escalations; `ship.md` digest section lists them [P] [tier:balanced]
- [x] T5 `lib/observe.mjs`: surface a change that shipped with pre-authorized escalations [P] [tier:balanced]
- [x] T6 tests: doctrine assertions per stage, stub hints, journal/observe round-trip, and the ratchet (no earlier stage re-runs) [tier:balanced]
- [x] T7 README + playbook README: document `--auto` and what confirmation covers [P] [tier:cheap]

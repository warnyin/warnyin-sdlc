---
id: autopilot
tier: deep
status: shipped
---
# Change: autopilot — one up-front grill, then run to ship without stopping
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
`/sdlc:auto` still pulls the human back mid-run: journals show 12 stops without pre-approval, and
two conditions (`cap-pin-exceeded`, `final-gate-env-failures`) are not pre-approvable at all, so
even a fully approved run stops. The human wants a delegate: asked once, up front, then it
decides and finishes — weighing requirement, quality/standards, time and cost — and stays
accountable for every decision it took alone.

## Assumptions
- Groomed via `/sdlc:groom`; every answer below was human-confirmed in that session.
- Stop evidence (`grep`, escalations without preauth=yes, 11 journals): verify-budget 4, ship-approval 2,
  ship 2, cap-pin-exceeded 2, verify-rounds 1, final-gate-env-failures 1.
- `/sdlc:auto` and `--auto` stay byte-identical: `auto.md` is not edited (75-line budget,
  `tests/unattended.test.mjs:260`); `unattended-run` is only narrowed by the MODIFIED below.
- Delegation events and the `hardfloor` flag are written by the agent itself: strict validate proves
  what was recorded (a delegation per session; a refusal never crossed by a flagged decision), not
  that a human spoke or that an unflagged decision touched no hard floor. The grill is the human act.
- Cost/time are decision criteria only — no budget, no config key (`grep -rln "tokenBudget|token
  budget|budget:" lib bin payload tests` hits only caps/observe/prose).
- ACCEPTED RISK (human's explicit choice, told it contradicts `harness.md § Autonomy policy`):
  a hard-floor found mid-run is decided by the agent, not escalated. Mitigation is accountability:
  reversible preferred, recovery recorded before acting, strict validate, digest (Delta below).
- Decision accountability follows the five pillars of techsauce "Agentic AI: accountable
  automation" (operating model, evidence trail, human accountability, monitoring, recovery
  path) — requested by the human mid-`new`; mapped onto existing artifacts, no new mechanism.
- Grill results live in `grill.md` (human's choice); a decision = token-only journal event + one bullet.
- `ship.md:39` lists only `preauth=yes` escalations and `lib/observe.mjs:57` counts only
  `preauth=yes`, so both must learn `preauth=pilot` — verified by grep.
- Non-Claude tools get the playbook + README row only (no command shortcut beyond Claude).

## Delta: autopilot

### ADDED Requirement: One grill up front settles the mandate
The system SHALL provide `/sdlc:autopilot <idea>`, which grills the human in design-tree rounds
(each round the frontier of open decisions, numbered, each with a recommended answer; facts are
looked up, never asked) until nothing is silently assumed, and SHALL write nothing before the
human confirms the result.

#### Scenario: the grill settles everything the run will need
- WHEN the rounds end
- THEN the human has settled the requirement and what done looks like, the priority order among
  requirement, quality/standards, time and cost, a choice for every escalation `auto` knows,
  and each hard-floor surface visible up front, item by item

#### Scenario: the human declines the summary
- WHEN the human declines or edits the confirmation
- THEN no change folder, journal entry or gate exists, and the grill reopens a round or stops

### ADDED Requirement: The mandate is recorded as the change's operating model
The system SHALL write the confirmed grill to `sdlc/changes/<id>/grill.md`, naming who delegated,
what the agent may and may not decide, the priority order, the pre-agreed escalation choices, and
the evidence behind each scope item.

#### Scenario: a confirmed autopilot run
- WHEN the human confirms
- THEN `grill.md` exists beside `change.md` and validate reports it within its cap

#### Scenario: grill.md over its cap or missing a section
- WHEN `grill.md` outside § Decisions exceeds its cap, or lacks Delegation, Priorities, Mandate or Decisions
- THEN validate reports an error for that change

### ADDED Requirement: After confirmation the run never stops to ask
The system SHALL carry the change to ship without asking the human again, except for a condition
`grill.md § Mandate` lists as refused, deciding any condition the mandate did not foresee —
including a hard-floor found mid-run — by the agreed priority order.

#### Scenario: a condition auto cannot pre-approve
- WHEN the run hits a condition outside the escalation table, such as a cap pin exceeded
- THEN it decides, records the decision, and continues rather than stopping

#### Scenario: a hard-floor surface discovered mid-run
- WHEN work turns out to touch a hard-floor surface nobody approved up front
- THEN the agent decides it alone and the decision is flagged as hard-floor in the record

#### Scenario: a condition the human refused to delegate
- WHEN the run hits a condition that `grill.md § Mandate` lists as refused in the confirmation
- THEN it stops and asks there, exactly as `auto` would; refusing `hardfloor-midrun` covers every
  decision the agent flags as touching a hard floor not approved by `surface=`, and strict validate
  fails any recorded decision that crossed a refusal

#### Scenario: an autopilot run is resumed
- WHEN `/sdlc:autopilot` resumes a change whose `grill.md` already exists
- THEN it does not re-grill the settled requirement, but re-asks the delegation items once,
  since authority covers one run only

#### Scenario: autopilot picks up a change opened another way
- WHEN the argument names an open change (or one is active) that has no `grill.md`, at any status
- THEN it enters at that change's stage like `auto`, never rewrites `change.md` or re-runs a
  finished stage, and grills only what the change does not already settle — priorities,
  escalation choices, hard-floor delegation, and any open clarification marker

### ADDED Requirement: Every decision taken alone leaves an evidence trail
The system SHALL record each decision the agent took without the human twice: a journal
escalation with `preauth=pilot` carrying only short tokens (condition, deciding priority,
reversible, hard-floor), and one line in `grill.md § Decisions` naming the options weighed,
the choice, and how to recover from it.

#### Scenario: a decision is recorded
- WHEN the agent decides a condition alone
- THEN the journal event and the `grill.md` line both exist and name the same condition

#### Scenario: an irreversible choice
- WHEN no reversible option meets the requirement
- THEN the recovery line is written to `grill.md` before the action, not after

#### Scenario: a decision journaled but never explained
- WHEN the journal holds more `preauth=pilot` escalations than `grill.md § Decisions` has lines
- THEN strict validation (the one `archive` runs) fails naming the change

### ADDED Requirement: The human stays accountable after the fact
The system SHALL list, in the digest of a change shipped by autopilot, every `preauth=pilot`
decision with hard-floor ones first, and SHALL count them in `observe`.

#### Scenario: an autopilot change ships
- WHEN a change with pilot decisions ships
- THEN its digest names each decision, its reversibility and recovery path for the delegator

#### Scenario: observe reports the run
- WHEN `observe` summarizes that change
- THEN it shows the pilot-decision count apart from pre-authorized ones

## Delta: unattended-run

### MODIFIED Requirement: Pre-authorization is bounded and recorded
The system SHALL apply the pre-approved decisions only to the run they were given
for, and SHALL record in the journal each escalation it passed under that authority.

#### Scenario: an escalation is passed unattended
- WHEN the run hits a condition that would normally stop it and a pre-approval covers it
- THEN it proceeds and the outcome records that it ran under pre-authorization

#### Scenario: an escalation nobody pre-approved
- WHEN a `/sdlc:auto` or `--auto` run hits a condition outside what was confirmed
- THEN it stops there and asks, exactly as an unattended flag had never been passed

#### Scenario: the same condition under autopilot
- WHEN an `/sdlc:autopilot` run hits a condition outside what was confirmed
- THEN the `autopilot` capability decides it instead

## Design
- decision: new playbook `autopilot.md` runs stages under `--auto` and overrides, by verbatim quote,
  `auto.md`'s two stop rules (anchor test guards drift) · alternatives: `--pilot` flag on auto /
  groom-then-auto · because: auto stays byte-identical and at its budget; no stage file changes.
- decision: the grill follows `groom.md` step 1 questions + `clarification-rounds` mechanics
  (picker, ≤4 a prompt, recommended first), extended to the escalation rows, hard-floor items and
  priority order · alternatives: vendor the grilling skill text · because: that doctrine already
  lives here; copying third-party skill text into payload is refused (`skill-inventory`).
- decision: the confirmation carries "hard-floor found mid-run is decided without you" as its own
  refusable item, every run · alternatives: record the accepted risk once in harness.md · because:
  the risk is delegated per run, never inherited — same rule as auto's pre-authorization; a
  declined item turns that one condition back into a stop.
- decision: `preauth=pilot`, not `yes` · alternatives: reuse `yes` · because: the delegator must
  tell a decision they pre-approved from one the agent took alone; `observe` counts it apart.
- decision: journal holds coined kebab tokens only, prose lives in `grill.md § Decisions` · because:
  `note` args are shell arguments; grill.md is written with the file tool, never through a shell.
- decision: pillars → operating model § Mandate; evidence journal + § Decisions; accountability
  § Delegation + digest; monitoring strict validate; recovery the bullet, before the act.
- decision: tie-break prefers the reversible option, then the priority order · because: recoverable.
- decision: `grill.md` cap 80 covers all but § Decisions bullets (prose there counts) · because: a capped log
  would force deleting recovery lines on a long run — the record this change exists to keep.
- decision: validator checks `grill.md` when present, and pilot events without it · alternatives: a
  frontmatter flag · because: no new frozen parser key; the template ships via `payload/templates/`.
- decision: strict validate matches tokens to bullets, refuses Mandate-refused tokens (case-folded;
  fields read fail-closed), wants a same-session `delegation` · because: prose-only mitigations fail.

## Tasks
- [x] T1 `payload/playbook/autopilot.md` (grill → confirm → write grill.md → Run per auto.md, decision rule) [tier:deepest]
- [x] T2 `payload/templates/grill.md` (cap 80) + `CAPS.grill` + validator cap/section check in `lib/validate.mjs` [P] [tier:balanced]
- [x] T3 command `payload/adapters/claude/commands/sdlc/autopilot.md` + `tests/payload.test.mjs` COMMANDS · T5 README.md + `payload/playbook/README.md` rows, `docs/design.md` ledger row for grill.md [tier:cheap]
- [x] T4 `ship.md` digest + `lib/observe.mjs` learn `preauth=pilot` [P] [tier:balanced]
- [x] T6 tests: grill cap/sections, pilot in digest rule + observe, auto.md unchanged [tier:balanced]
<!-- review round 1 (panel) — 4 blockers, fixed: -->
- [x] F1 pilot `condition` is a coined kebab token, validated · F2 token-matched § Decisions bullets + Mandate `Refused` check · F3 `note` records `session`; strict wants a same-session `delegation` · F4 row 28 asserts the non-strict warn [tier:balanced]
- [x] F5 § Decisions bullets outside the cap; headings ≤3 spaces; explicit `sdlcRoot` · F6 autopilot.md quotes its overrides, precedence, set-active, data-not-instructions, anchor test · F7 Delta refused exception + `unattended-run` MODIFIED + CHANGELOG [tier:balanced]
<!-- review round 2 (panel) — 3 blockers (security); architect improvements folded in -->
- [x] G1 BLOCKER a pilot event with no `session` passes on any old delegation: when the change's journal carries any session, a sessionless pilot event fails strict; a fully sessionless journal keeps "any earlier delegation" — recorded as the non-Claude gap in docs/design.md · G2 BLOCKER `note` lets `k=v` overwrite `event`, `ts`, `session`: those keys are dropped from args. Delegation events stay self-attested by the agent — an accepted limit, named in Assumptions [tier:balanced]
- [x] G3 BLOCKER only the token-shape issue escapes `condition`: every grill issue echoing it goes through `escapeEntry` · G4 improvements: `Refused` case-insensitive + a non-token refused entry warns; grill template fixes one token per `auto.md` escalation row plus `hardfloor-midrun`, and the playbook reuses them; row 39 checks `**Confirm.**` and next.md's real §2 line; test holds autopilot.md ≤60 lines; hook passes `sdlcRoot`; stale Assumption + dangling "it" in the MODIFIED scenario [tier:balanced]
<!-- review round 3 (panel) — 1 blocker (security) + 1 related improvement (architect) -->
- [x] H1 BLOCKER a refusal is bypassable: a non-token Refused entry is an error under strict; Refused entries match case-insensitively; refusing `hardfloor-midrun` refuses every pilot event with `hardfloor=yes`; fixed tokens add `cap-pin-exceeded`, `final-gate-env-failures` [tier:balanced]
<!-- review round 4 (panel of 3; quality stalled) — 1 blocker; human chose "close the class" past budget -->
- [x] I1 BLOCKER-CLASS every exact read of a free-text field that decides a "no": `event`/`preauth` case-folded, `hardfloor` is `no|approved|yes` with anything else `yes` (shared in `lib/journal.mjs`, used by validate + observe); a "no" under `### Hard floors` is a strict error — only the Refused line binds [tier:balanced]
<!-- review round 5 (full panel) — security: `hardfloor=approved` unbacked; human chose fix + state the limit -->
- [x] J1 `### Hard floors` is an allowlist (`- <surface>: approved`, anything else a strict error); `approved` counts only with a `surface=` the human approved, else `yes`; the self-reported-flag limit stated in Assumptions, Delta, CHANGELOG [tier:balanced]
<!-- notes, not fixed: digest content stays agent-authored prose (same as preauth=yes); "recovery before the act" has no action event to order against — held by playbook + evals; grill.md read has the same symlink posture as change.md; an unclosed fence hides the rest (sections then report missing — fails safe) -->


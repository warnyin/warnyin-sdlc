---
id: new-md-budget-constant
tier: standard
status: shipped
spawned-from: [deploy-runbook]
---
# Change: every payload line budget is stated once, in lib/caps.mjs
<!-- cap:100 · standard tier: one capability, behavior change. -->

## Why (≤5 lines)
Playbook budgets are pinned by hand in tests: new.md 46 (3 tests + a cross-check that they
agree), rules-card.md 40 (5 tests), auto.md 75, autopilot.md 60, command stubs 15 (3 tests),
and three tests repeat an existing CAPS value as a literal. Every approved raise edits several
places, and "caps change only in `lib/caps.mjs`" does not hold for them.

## Assumptions
- Learner proposal from deploy-runbook's digest, widened to its class; the human said to
  continue ("ทำต่อเลย").
- Class enumerated by `grep -rnE "lines <= [0-9]+|<= [0-9]+, \`|budget (is )?[0-9]+" tests/*.mjs | grep -v "CAPS\."`
  → 19 hits; review's wider sweep `(lines|length|))s*<=s*d+` + `grillCap = 80` added feedback:47,
  groom-stage:63 (stub 15) and autopilot:127 (CAPS.grill). Character caps (park 200/250, relations
  300, skills 160) and `lib/journal.mjs` id length are output lengths, not file budgets.
- Values do not change — this moves them. Recorded approval history (new.md's) moves beside it;
  the others have none recorded, and say so. CLAUDE.md is not edited (review suggestion left to the human).
- No payload text changes; tests and `lib/caps.mjs` only. Stays standard.

## Delta: playbook-budgets

### ADDED Requirement: Payload line budgets have one source
The system SHALL state the line budgets of `new.md`, `rules-card.md`, `auto.md`, `autopilot.md`
and Claude command stubs in `lib/caps.mjs`, and every test that checks a payload file against a
line budget SHALL read it from `CAPS`, never from a number literal.

#### Scenario: the budgets hold
- WHEN each budgeted payload file is measured
- THEN it is within its `CAPS` value

#### Scenario: no hand-written pin remains
- WHEN the tests are scanned for a line-count assertion against a number literal
- THEN none is found

## Tasks
- [x] T1 `CAPS.playbook` {new 46, rulesCard 40, auto 75, autopilot 60} + `CAPS.commandStub` 15 with history [tier:cheap]
- [x] T2 tests read `CAPS` for every pin; new.md cross-check row reworded [tier:cheap]
- [x] R1 review blocker (class: line-budget literal a too-narrow guard regex misses): widen row 2's scan to `).length <= N` and `const *Cap = N`; fix feedback:47, groom-stage:63, autopilot:127 (CAPS.grill); drop literal values from row 1; drop numbers from test titles; drop the source-text cross-check [tier:cheap]
- note: R1 sweep re-run — `grep -nE "(\.length|\blines|\))\s*<=\s*[0-9]+|const \w*[Cc]ap = [0-9]+" tests/*.mjs | grep -v CAPS`
  → only character caps (parking, relations, skills) remain. Also moved to CAPS: cap quotes in
  minimal-build:90, deploy-runbook:138/325/327, autopilot:184; stale history comments removed.
  Kept: validate.test:63 asserts the validator's message for a 35-line fixture (validator output,
  not a budget pin); deploy-runbook rows 2/8 pin the CAPS values themselves by contract.
- follow-up (review, not applied): row 2 is line-scoped (a multi-line or `46 >= lines` pin escapes);
  a shared `within(file, key)` helper would fold 11 copies; CLAUDE.md Caps section could name
  `CAPS.playbook` (left to the human — CLAUDE.md is theirs).

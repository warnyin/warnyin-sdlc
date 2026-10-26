---
id: ask-dont-infer
tier: standard
status: shipped
---
# Change: missing arguments are asked; groom carries hard stops instead of firing them (#10, #8)
<!-- cap:100 · standard tier. Delta sections ARE the spec change — merged mechanically at ship, never re-narrated. -->

## Why (≤5 lines)
#10: a project command run without its first required argument was filled from what the session had
just shipped; the agent merged the wrong change before the human stopped it. Nothing always-loaded
tells the agent a missing argument is a question. #8: a project's edit-time hard stop (RBAC) fired
mid-grooming although groom only asks and reads; the human had to talk it out of halting.

## Assumptions
- The rule must be always-loaded to reach a project's own command (the #10 case), and for Claude only
  the SessionStart hook output is: human chose a fixed line from `inject-context.mjs` plus
  `rules-card.md` for the other tools. `update` refreshes the hook only where the project has not
  edited it (ownership model: disk hash must match the manifest).
- The line goes FIRST in the hook output, so truncation (which cuts the tail) never drops it; it
  counts against the 60-line budget like everything else the hook prints.
- With nothing else to print (no constitution, no steering, no change) the hook now prints the line
  alone and journals an `inject` of 1 line: intended — the rule holds in every sdlc project.
- The only default for a missing argument is the `Active change:` pointer, for an sdlc command's
  change id. Shipping releases every pointer to the shipped change (change-focus spec, "Shipping a
  change releases every pointer to it", pinned by tests/archive-regressions.test.mjs), so the #10 guess cannot recur through it.
- The existing "make the safest assumption" rule (rules-card.md, new.md step 5) is about the work's
  ambiguity; both get an in-line carve-out so the card never says ask and assume about the same thing.
  new.md is at its 46-line budget: the carve-out rewrites an existing line, adding none.
- auto.md's "assume-safe and continue" escalation is about a change's open questions under `--auto`,
  not a command's arguments: unchanged.
- #8 is groom-only: groom.md is read on every `/sdlc:groom`, so its rule needs no always-loaded line.
  The halt firing later is the project's own instruction; the framework only stops grooming from
  firing it. groom.md has no CAPS budget (lib/caps.mjs `playbook` keys: new, rulesCard, auto, autopilot).

## Delta: clarification-rounds

### ADDED Requirement: A required argument the human did not type is asked, never inferred
The system SHALL tell the agent, first in the context loaded at every session start, that a required
command argument the human did not type is a question and never a guess from what the session was
just doing, and that the only default is the `Active change:` pointer, for an sdlc command's change
id. The sentence SHALL appear in the SessionStart output of `payload/hooks/inject-context.mjs`, in
`payload/playbook/rules-card.md`, and be named in `payload/playbook/context.md`'s static list. The
ambiguity rules in `rules-card.md` and `payload/playbook/new.md` step 5 SHALL state that a missing
command argument is asked, never assumed.

#### Scenario: a session starts in an installed project
- WHEN the SessionStart hook runs, with or without an active change, a constitution, or room left
  in the budget
- THEN its first output line is the argument sentence, exactly once

#### Scenario: a non-Claude tool's rules file
- WHEN `init` installs any non-Claude adapter
- THEN the embedded rules card contains the same sentence, and its ambiguity rule carves out a
  missing command argument

## Delta: change-focus

### ADDED Requirement: Grooming carries a project hard stop instead of firing it
The system SHALL tell the agent that during grooming a project's edit-time hard stop (RBAC, auth,
migrations…) is recorded as a constraint in the Assumptions handed to `/sdlc:new`, and fires when a
stage that edits files outside `sdlc/` starts — never during grooming, which edits nothing. The
sentence SHALL appear in `payload/playbook/groom.md` before its steps, and its hand-off step SHALL
name a project hard stop among the Assumptions it carries.

#### Scenario: the human names a hard-stop topic while grooming
- WHEN an answer in a grooming round touches a topic the project's instructions halt on
- THEN the hand-off to `/sdlc:new` carries "this change goes through <the project's workflow>"
  as an assumption

## Tasks
- [x] T1 inject-context.mjs: ARG first in the output; context.md static list names it [tier:balanced]
- [x] T2 rules-card.md: ARG bullet + ambiguity carve-out; new.md step 5 carve-out in place [P] [tier:cheap]
- [x] T3 groom.md: HALT before the steps, hard stop named in step 5 [P] [tier:cheap]
- [x] T4 CHANGELOG Unreleased entries for #10 and #8 [tier:cheap]
<!-- built in-session (conductor) although 4 tasks: each is a one- to four-line prose or array edit; a builder per task would cost more than the edits. -->

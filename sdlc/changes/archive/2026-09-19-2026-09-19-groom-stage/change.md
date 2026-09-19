---
id: 2026-09-19-groom-stage
tier: standard
status: shipped
---
# Change: a grooming stage that finds the real requirement before a change exists
<!-- cap:100 · standard tier. Delta sections ARE the spec change — merged mechanically at ship, never re-narrated. -->

## Why (≤5 lines)
`/sdlc:new` starts by writing a Delta, so it can only resolve ambiguity it notices while
already committed to a solution shape. Evidence from this repo's own week: "make sdlc work in
Kimi Code" went straight to `new`, was scoped as a rules-file-only adapter, and four changes
later needed `0.16.0` to add the stage commands the human wanted all along. Nothing asks what
"done" means before the spec exists.

## Assumptions
- Optional, never a gate. A mandatory grooming would be the ceremony this repo already pays too
  much for; `new.md` says a ceremonial review is garbage and the same applies here.
- It writes no artifact. Verified against `docs/design.md`'s ledger: every mandatory artifact
  must justify its token residency, and this one has no residency to justify because its output
  IS `new`'s Why plus Assumptions.
- The flow line in the constitution and the rules card is left untouched. Checked: that line
  describes a change's lifecycle, and grooming happens before a change exists. Always-loaded
  budget therefore does not move.
- Kimi gets `/skill:sdlc-groom` for free, because 0.16.0 renders Kimi's skills from the Claude
  stubs. Not assumed — a test row pins it.

## Delta: change-focus

### ADDED Requirement: A change can be groomed before it is opened
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

## Tasks
- [x] T1 [tier:balanced] `payload/playbook/groom.md` — grill the problem (the proposed solution
  is evidence, never the scope), verify findings by running them, offer shapes cheapest-first,
  allow "not worth building", write nothing
- [x] T2 [P] [tier:cheap] Claude stub added; Kimi's `/skill:sdlc-groom` appeared with no
  Kimi-specific work — 16 commands, 16 skills, verified on a live install
- [x] T3 [P] [tier:cheap] Playbook README: flow line now `[groom] → new → ...` and the stage
  table names what it reads, writes (nothing) and that it may end in a kill
- [x] T4 [P] [tier:cheap] `next.md` offers grooming when nothing is active and the ask names a
  solution but no outcome
- [x] T5 [tier:cheap] 10 rows green, 446/446 full suite. Row 10 is a guard, not a feature: the
  rules card and constitution must NOT grow, since grooming precedes the lifecycle they describe

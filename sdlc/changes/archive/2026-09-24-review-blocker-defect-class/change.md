---
id: review-blocker-defect-class
tier: standard
status: shipped
---
# Change: review blockers name their defect class and sweep the whole tree
<!-- cap:100 · standard tier. Delta sections ARE the spec change — merged mechanically at ship, never re-narrated. -->

## Why (≤5 lines)
Review → build → verify loops round after round, a fresh blocker each time: `autopilot` went
4→3→1→1→1→0 blockers and its digest says every one was in ONE class; `verify-fast-final-gates`
went 4→1→1→1→0. Reviewers report one instance (`finding · file:line`), the fix task fixes that
instance, and the next panel trips over its sibling. Projects that install the framework never
get this repo's constitution rule that a class is enumerated over the whole tree before it is fixed.

## Assumptions
- Standard tier, not deep: prose doctrine and agent prompts only; no prune, guard, merge or
  ownership code path moves. Verified: the touched files are `payload/playbook/{review,build}.md`
  and `payload/adapters/claude/agents/sdlc-{architect,security,quality,ops}.md`.
- The reviewer output format lives in exactly those four agents. Verified:
  `grep -rln "blocker|improvement|note" payload lib bin` → the four `sdlc-*.md` agents, nothing else.
- No payload file states a class/sweep rule today. Verified:
  `grep -rn -iE "class|enumerat|whole tree|same (root|class)"` over review/verify/build/principles
  and the agents → only `review.md:25 Classify: blocker | improvement | note`.
- Non-Claude tools run review in-session from `review.md`, so the rule must live there too,
  not only in the Claude agents. Verified: `grep -rln "reviewer" payload/adapters` outside
  `claude/agents` → only `contract-writing/SKILL.md`, which carries no review format.
- No line budget pins `review.md`, `build.md` or the agents. Verified: `lib/caps.mjs` names none
  of them and no test counts their lines.
- Out of scope, by the human's choice at grooming: when review runs, the shared 3-round budget,
  handing prior rounds to the panel (shape B), and blocker severity — a security blocker stays one.

## Delta: review-panel

### ADDED Requirement: A blocker names its defect class and every instance of it
The system SHALL require each review blocker to name the defect class it belongs to, the
search that enumerated that class over the whole tree, and every instance the search found —
not only the one a reviewer tripped on. The doctrine SHALL state this in `review.md` (where
tools without subagents run the panel) and in each of `sdlc-architect.md`, `sdlc-security.md`,
`sdlc-quality.md` and `sdlc-ops.md` (the Claude reviewers' output format).

#### Scenario: a reviewer reports a blocker
- WHEN a panel reviewer returns a blocker
- THEN its line carries the defect class, the sweep it ran over the whole tree, and every hit

#### Scenario: a blocker arrives without its sweep
- WHEN the main loop merges a blocker that names only one instance
- THEN `review.md` has the main loop run the sweep before the fix task is written

### ADDED Requirement: A fix task closes a class, proven by re-running its sweep
The system SHALL turn blockers into one fix task per defect class, carrying the sweep and its
hits, and SHALL treat that task as done only when the sweep re-run over the whole tree finds no
instance left, with that command and its result recorded on the task. The doctrine SHALL state
this in `review.md` (where the task is written) and in `build.md` (where it is ticked).

#### Scenario: two blockers share a class
- WHEN the panel returns two blockers of the same defect class
- THEN `review.md` writes one fix task for the class, not one per instance

#### Scenario: a class fix is ticked
- WHEN a builder ticks a fix task that carries a sweep
- THEN `build.md` requires the sweep re-run first and its command and result noted on the task

## Tasks
- [x] T1 [tier:balanced] contract rows for every file stating a rule (review.md ×2, build.md,
  four agents) — written red first
- [x] T2 [P] [tier:balanced] `review.md` steps 2–3: class + sweep + hits; main-loop sweep for a
  bare instance; one fix task per class, done when the re-run sweep is empty. Surprise: the
  contract's `extractSection` read only a step's first line (`$` under the m flag), forcing
  250-col prose; the helper now spans wrapped lines, and rows 1/3 re-checked red with review.md stashed
- [x] T3 [P] [tier:cheap] `build.md`: a fix task carrying a sweep is ticked only after re-running it
- [x] T4 [P] [tier:cheap] the four reviewer agents: blocker line gains `class · sweep · hits`
- [x] T5 [tier:cheap] `npm test` 610/610; `npm run setup:dogfood` wrote 6 mirrors

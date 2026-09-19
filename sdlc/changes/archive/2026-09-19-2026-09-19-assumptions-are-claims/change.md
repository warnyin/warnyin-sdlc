---
id: 2026-09-19-assumptions-are-claims
tier: standard
status: shipped
---
# Change: an assumption that removes work is a claim, not a judgement
<!-- cap:100 · standard tier. Delta sections ARE the spec change — merged mechanically at ship, never re-narrated. -->

## Why (≤5 lines)
Three deep changes shipped this week; each one's bug was hiding inside the Assumption used to
argue the work away — "kimi reuses that code path unchanged", "pre-existing, no data loss,
self-heals", "a dangling entry is inert". All three were false, each took under two minutes to
disprove by running it, and none was ever run. `new.md` asks for "why it is safe", which invites
a plausible sentence; nothing asks whether the sentence is true.

## Assumptions
- Standard tier, not deep: this changes prose doctrine only. No prune, guard, merge or
  ownership code path moves, and nothing here writes to a user's files beyond the playbook
  refresh `update` already performs.
- `new.md` is at its pinned budget of 43 and this needs ~3 lines, so the pin is raised to 46
  deliberately, the way the pin's own comment demands. Verified that both tests pinning it
  (`question-options` row 11, `clarification-rounds` row 15) assert the same number, so both
  move together or the suite goes red.
- The rule is stated wherever the claim is made or cashed in — written in `new.md`, spent in
  `contract.md`'s out-of-scope list, attacked in `review.md` — because a rule that lives only
  at the point of writing is not there when the work is skipped.

## Delta: clarification-rounds

### ADDED Requirement: What can be looked up is never assumed either
The system SHALL require that an assumption asserting how existing code already behaves —
that something is already covered, unchanged, harmless, pre-existing or self-healing — is
either proven by running it before it is recorded, or recorded as explicitly unverified. This
is the sibling of "What can be looked up is never asked": the same facts the agent must not
put to the human, it must not quietly assume either. The doctrine SHALL state this where the
assumption is written, where it is spent to drop a test, and where the panel picks its targets.

#### Scenario: an assumption that drops work
- WHEN a change records an assumption whose effect is that some behavior need not be built,
  tested or checked
- THEN the doctrine requires it to be run and proven first, or to carry an explicit unverified
  marker

#### Scenario: an out-of-scope line resting on current behavior
- WHEN `contract/tests.md` lists something out of scope because the code is claimed to behave
  a certain way already
- THEN the doctrine requires that line to name the check that proved it, or to mark it unverified

#### Scenario: the panel picks a starting point
- WHEN a review panel runs on a change carrying unverified scope-narrowing claims
- THEN the doctrine directs the reviewers at those claims first

#### Scenario: a tool with no hooks still gets the rule
- WHEN a project installs a non-Claude tool whose only enforcement is the rules card
- THEN the card carries the same verify-or-mark rule, within its 40-line budget

## Tasks
- [x] T1 [tier:balanced] `new.md` step 5: an assumption that makes something need NOT be built,
  tested or checked is a claim about the code — run it and prove it, or record `[UNVERIFIED]`.
  Written as the sibling of the rule already there ("looked up, never asked — and never
  assumed"). Budget: raised 43 → 46 in both pinning tests, with the reason recorded beside the
  pin; the first draft came out at 47 and was trimmed rather than raising the pin further
- [x] T2 [P] [tier:cheap] `contract.md`: an out-of-scope line resting on current behavior cites
  the check that proved it or is marked `[UNVERIFIED]`
- [x] T3 [P] [tier:cheap] `review.md` step 1c: every reviewer gets the `[UNVERIFIED]` claims and
  attacks those first — the panel is the first stage that reads code rather than the Delta
- [x] T4 [P] [tier:cheap] `rules-card.md` (20/40) + all three change templates carry the rule
- [x] T5 [tier:cheap] 8 contract rows green; `npm test` 425/425; mirrors regenerated. Row 3 was
  caught passing before the rule existed — a 320-char window matched "prove" from an unrelated
  sentence — and was tightened to require the marker itself

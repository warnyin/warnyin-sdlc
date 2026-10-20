---
id: anti-loop-rules
tier: standard
status: shipped
---
# Change: reviewers and contracts carry the anti-loop rules
<!-- cap:100 · standard tier. Delta sections ARE the spec change — merged mechanically at ship, never re-narrated. -->

## Why (≤5 lines)
gate-moving-target looped for two reasons the framework still allows. Tests pinned prose rules with
regexes over meaning, and each fix round's new regex had a new hole (one-way polarity, a pin met by
a neighbouring word, false reds). Reviewers raised out-of-scope blockers in a repeated panel, because
the scope rule lived only in review.md's brief. Done: a contract pins a prose rule as one exact
sentence, and every reviewer applies the repeated-panel scope from its own instructions.

## Assumptions
- Standard tier: payload prose in six files; no installer, prune, guard or merge code (harness triage).
- Verified by reading: `sdlc-contractor.md` already asks for "literal tokens, order and polarity" (spec test-contract); the new rule adds the exact-sentence form for prose rules and changes nothing in the existing one.
- Verified by reading: none of `sdlc-architect.md`, `sdlc-security.md`, `sdlc-quality.md`, `sdlc-ops.md` states the repeated-panel scope; review.md does (gate-moving-target, uncommitted on this branch).
- Evidence for both rules: archive `2026-10-20-gate-moving-target` change.md Tasks F1, F5–F7 and its review 2–3 notes.
- Out of scope (recorded in that digest, not confirmed here): the learner's verify.md mutant rule and review.md skipped-review rule; evaluator bundle without tests.md/Delta; rubric fixed across rounds; re-score wording shared between verify.md and sdlc-evaluator.md.
- This change's own tests pin its rules as exact sentences — the rule it adds.
- Safe: sdlc-quality's "over-build findings are always improvements, never blockers" and the clause's "contract defect wherever it is" do not conflict in practice — an over-build cut that breaks a pinned behavior is a broken contract and should block; no precedence sentence is added.

## Delta: test-contract

### ADDED Requirement: A prose rule is pinned as an exact sentence
The system SHALL tell whoever writes a contract test that a row pinning a rule stated in prose (a
playbook, agent file, template or changelog) asserts the rule as one exact sentence — whitespace
collapsed, inside a non-empty anchor — and pins known contradicting wording absent as literal text,
never a regex over the rule's meaning. `sdlc-contractor.md` (who writes the tests) and
`contract-writing/SKILL.md` (how a contract is written) SHALL each state it, in the same sentence.

#### Scenario: a row pins "a touched line below the bar fails the round"
- WHEN the contractor writes the test
- THEN it asserts that sentence verbatim in its anchor, so "does not fail the round" turns it red

## Delta: review-panel

### ADDED Requirement: Every reviewer applies the repeated-panel scope itself
The system SHALL have each panel reviewer state that in a repeated panel — one briefed with previous
blockers and a fix diff — it raises a blocker only for a previous blocker not closed, a defect the
fix diff causes, or a security, data-loss or contract defect wherever it is, and reports anything
else as an improvement. `sdlc-architect.md`, `sdlc-security.md`, `sdlc-quality.md` and `sdlc-ops.md`
SHALL each state it, carrying `review.md`'s rule clause verbatim ("a blocker is raised only for …;
anything else is an improvement") behind one shared lead-in addressed to the reviewer.

#### Scenario: a reviewer in a repeated panel finds an old non-security issue
- WHEN it is in code the fix diff did not touch
- THEN the reviewer reports it as an improvement, from its own agent file

### ADDED Requirement: A repeated panel never narrows the security review
The system SHALL have `sdlc-security.md` state that a repeated panel never narrows what it checks.

#### Scenario: a late-found vulnerability in untouched code
- WHEN the security reviewer in a repeated panel finds it
- THEN it reports a blocker

## Tasks
<!-- [P] = parallelizable wave · [tier:cheap|balanced|deepest] per the routing table in harness.md -->
- [x] T1 `sdlc-contractor.md` and `contract-writing/SKILL.md`: the exact-sentence rule, one shared sentence [P] [tier:cheap]
- [x] T2 the four reviewer agent files: the repeated-panel sentence (contract's "B agent": shared lead-in + review.md's clause verbatim); `sdlc-security.md` also the never-narrows sentence [P] [tier:cheap]
- [x] T3 tests: `tests/anti-loop-rules.test.mjs` — one exact-sentence RULES table, one row per file per rule; existing test-contract and review-blocker-class tests unchanged → mutation pass: 21 of 21 killed — per stating file a delete and a meaning-inverting mutant (6 files), one-word drift in the 5 files carrying a clause, and a stray copy in a sixth/third file; not covered: a contradicting sentence added beside an intact rule [tier:balanced]
<!-- review 1 (panel, scoped): architect and security no blocker. Ops: row 10 runs tests/gate-moving-target.test.mjs and row 8 needs review.md's clause, both then uncommitted — a commit of this change alone is red. Quality: SKILL.md's (advisory) lines "bled" into this change — misattributed: they were gate-moving-target's, visible because the diff handed to the panel was `git diff HEAD` over two uncommitted changes (the main loop's error). Human (2026-10-20): commit gate-moving-target first (31865fa, its snapshot tested alone: 667/667). After it, this change's diff is its own 7 added lines with no "(advisory)", and rows 8/10 resolve against HEAD; suite 677/677. Both closed by commit order, no code change, no panel re-run — recorded mode=solo. -->
- recorded for the digest from review 1: the B clause lives in five files (review.md + four reviewers) — a pointer from the agents to review.md would leave one copy; lens reviewers get no scope sentence; sdlc-quality.md has no precedence sentence between "over-build is never a blocker" and "a contract defect blocks wherever it is"; CHANGELOG has no line for this change; owners of a customised agent file keep the old text on update and the warning does not name the missing rule; `read` helper in the test is used once.

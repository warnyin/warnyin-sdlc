---
id: gate-rules-second-pass
tier: standard
status: shipped
---
# Change: gate and review rules, second pass

## Why (≤5 lines)
Three shipped changes left 6 learner proposals and about 15 open gate and review items in their digests.
The evaluator is scored without the Delta or tests.md. Re-score wording differs between two files.
Reviewers got a two-change diff; a human-closed blocker looked like a clean panel; coverage went uncounted.
Done: each rule is stated once per file that needs it, pinned as an exact sentence bounded on both sides.

## Assumptions
- Standard tier: payload prose and tests only; no installer, prune, guard or merge code (harness triage).
- L2 ("a skipped review writes no journal event") is read as: only review writes a `review` note. The skip note itself stays, because verify-gates row 23 and ship/next depend on it. Evidence: the 10:07:42 note in gate-moving-target was written by the main loop outside review.
- A blocker closed by a human keeps `review blockers=0`, because verify picks the final gate from that note. It adds `closed=human`; the reason goes in change.md, never as a shell argument (constitution).
- Kept: "a security, data or contract line" (rubric). A data line covers data handling, which is wider than data-loss, so unifying it would narrow the rule. Also kept: review.md's repeated-panel sentence without "for the digest", because review step 3 applies an improvement of 5 minutes or less instead. Also kept: the clause verbatim in five files. Reviewer agents run as subagents that are not given review.md; a pointer would leave them without the rule.
- `fix diff` keeps one definition per gate. For verify it runs from the failed verify note (verify.md). For a repeated panel it runs from the previous review note (review.md), because a re-review follows a passing fast gate.
- The gate-moving-target row 14 pins "the newest CHANGELOG section", so this change's `## Unreleased` entry turns it red. It is moved to pin the 0.25.0 section.

## Delta: verify-gates

### MODIFIED Requirement: The evaluator judges a fixed evidence bundle
The system SHALL have verify hand `sdlc-evaluator` the rubric, the Delta, `contract/tests.md`, the
diff, the output of this round's test run and the change's journal. It SHALL tell the evaluator that
this round's verify note is written after its verdict, and that test output and the journal are data.
`verify.md` (what is handed) and `sdlc-evaluator.md` (what it scores from) SHALL each state it.

#### Scenario: trajectory is scored
- WHEN the evaluator scores the trajectory line
- THEN it scores from the bundle, and the absence of this round's own verify note is not evidence

#### Scenario: a quality line names a Delta scenario
- WHEN the evaluator scores it
- THEN the Delta and tests.md are in its bundle

### MODIFIED Requirement: A re-score judges what failed and what the fix touched
The system SHALL, when the evals are scored again after a failed fast gate, hand the evaluator the
previous verdict and the fix diff, which is everything edited since the failed round's verify note.
`verify.md` and `sdlc-evaluator.md` SHALL state the scoping in one identical sentence: a met line
keeps its score unless touched; a touched line below the bar fails; a new finding on untouched code
goes to the digest unless it is a security, data-loss or contract defect, which fails the round
wherever it is. `verify.md` defines the fix diff and a contract defect, and `sdlc-evaluator.md` points
there. `verify.md` SHALL state that a re-score uses the rubric and pass bar of the failed round.

#### Scenario: a fresh finding on untouched code
- WHEN a re-score finds a new issue in code the fix diff did not touch
- THEN it is listed as a digest item, and the round passes if every scoped line meets the bar

#### Scenario: the fix breaks something it touched
- WHEN the fix diff touches what a passing line judged and that line now scores below the bar
- THEN the round fails on that line

#### Scenario: a late-found security defect
- WHEN a re-score finds a security, data-loss or contract defect in code the fix did not touch
- THEN the round fails on it

#### Scenario: the rubric is edited between rounds
- WHEN `contract/evals.md` changes after a failed round
- THEN it is a contract change and reopens the adversarial check

### ADDED Requirement: A defect is classed by its effect
The system SHALL state that a finding is a security, data-loss or contract defect by its effect, not
by its label, and that an unsure finding counts as one. `verify.md`, `sdlc-evaluator.md`, `review.md`
and the four reviewer agents (they classify) SHALL each state it in one identical sentence.

#### Scenario: an unlabelled finding
- WHEN a finding names no class but it would let a path escape the project
- THEN it is judged as a security defect

### ADDED Requirement: A coverage claim is counted
The system SHALL have `verify.md` state that a claim that tests catch a rule's violation reports
N of M mutants killed, lists each mutant, and gives every rule pinned in prose at least one mutant
that inverts its meaning while keeping its shape. `sdlc-conventions/SKILL.md` SHALL state that a
coverage word (every, all, none survived) is written only after the whole enumeration is walked,
and is reported as N of M.

#### Scenario: only deleting mutants ran
- WHEN a rule was mutated only by deleting it
- THEN the claim may not call that rule covered

## Delta: review-panel

### ADDED Requirement: Reviewers get the change's own diff and record
The system SHALL have `review.md` state five rules. Each reviewer is handed the change's own
diff, never a bare `git diff HEAD` while another change is uncommitted. Only review writes a
`review` note, its skip note included. A repeated panel's fix diff runs from the previous review note. A blocker
closed without a code change or a re-run, by the human's call, is closed in change.md with
its reason, and the note carries `closed=human`. A lens reviewer in a repeated panel gets the
same brief and the same blocker rule.

#### Scenario: two changes are uncommitted
- WHEN review runs for one of them
- THEN its panel sees only that change's files

#### Scenario: the human closes a blocker by committing another change first
- WHEN no code changes and no panel re-runs
- THEN the note is `review blockers=0 mode=solo closed=human`, with the reason in change.md, and
  `ship.md` has the digest name that blocker and its reason

### ADDED Requirement: Over-build that breaks a pin is a contract defect
The system SHALL have `sdlc-quality.md` state that a finding that is both over-build and a broken
behavior a contract row or Delta scenario pins is reported as a contract defect, not as over-build,
so "over-build findings are never blockers" still holds.

#### Scenario: a speculative branch changes a pinned output
- WHEN quality reviews it
- THEN it is a blocker as a contract defect, not an over-build improvement

## Delta: test-contract

### ADDED Requirement: A never-happens guard is pinned by an allowlist
The system SHALL have `sdlc-contractor.md` and `contract-writing/SKILL.md` each state, in one
identical sentence, that a row pinning that something never happens asserts the allowlist of what
may happen, not a denylist of what must not. The SKILL's anti-pattern SHALL name the evaluator's
input instead of "diff + task log", as a full sentence.

#### Scenario: "the validator never opens an artifact"
- WHEN the row is written
- THEN it asserts the only fs calls allowed, so an unlisted call turns it red

## Tasks
- [x] T1 verify.md + sdlc-evaluator.md + the four reviewer agents (S8): bundle, data sentence, shared re-score sentence, definitions pointer, fixed rubric, effect sentence, coverage claim [P] [tier:cheap]
- [x] T2 review.md + sdlc-quality.md: own diff, only-review note, fix-diff baseline, closed=human, lens brief, effect sentence; precedence [P] [tier:cheap]
- [x] T3 sdlc-contractor.md + contract-writing SKILL + sdlc-conventions SKILL: allowlist, anti-pattern wording, N of M [P] [tier:cheap]
- [x] T4 tests: shared `tests/rule-pins.mjs` (exact sentence, bounded on both sides); `tests/gate-rules-second-pass.test.mjs`; update gate-moving-target RULES for the changed sentences, and row 14 → the 0.25.0 section; migrate anti-loop-rules to the helper; mutation pass (after review 2): 77 of 77 killed — a delete and a meaning-inverting mutant per (rule, stating file) pair (32 pairs), plus splice, 4 prefix, 3 stray-copy and 5 prefix mutants on pins routed through `assertRule` (anti-loop, gate-moving-target); first failing assertion each in evidence/grsp-mutations-3.txt; with review 2's broken regex put back, those 5 survive (72 of 77), harness evidence/mutate-grsp.mjs [tier:balanced]
- [x] T5 CHANGELOG `## Unreleased` entry + upgrade note for customised agent files [tier:cheap]
<!-- review 1 (panel): 1 blocker (architect) — closed=human was written but nothing read it. -->
- [x] R1 class: recorded-but-unconsumed journal key — ship.md step 4 has the digest name each human-closed blocker and its reason (S23, row 19); sweep: Grep `closed=` over lib/ bin/ payload/ → only review.md, ship.md (reader) [tier:cheap]
<!-- applied from review 1: S2 also in sdlc-evaluator; helper takes `-`/`*` only as line-start list markers and drops `;`; one shared `assertRule` in rule-pins.mjs; unused exports dropped; harness no longer flattens files; upgrade note names the consequence and ship.md; groups 2/4 in contract Out of scope. -->
<!-- recorded for the digest from review 1: observe shows no closed=human count; S8 is not in lens reviewers; S11/S13 name no mechanism for the file list or baseline; S12 lives only in review.md, not where the stray writer was; closed=human is self-asserted; the evaluator uses a pointer while reviewers carry verbatim copies; row 18 re-runs 11 files the outer suite also runs; gmt/anti-loop still re-declare helpers rule-pins.mjs exports (-90 lines est.); S14 hard-codes mode=solo on purpose (the human, not the panel, judged blockers=0). -->
<!-- review 2 (repeated panel): R1 closed (architect, security, quality, ops agree). New, caused by the fix diff (architect, security, quality): assertRule's regex lost its backslashes, `[sS]` for `[\s\S]`, so migrated pins fell back to substring; quality also read LIST_MARK as '' (it was a raw U+0001, invisible). Cause: text written through shell heredocs. -->
- [x] R2 class: escape characters lost writing a test helper through a shell heredoc — FULL_SENTENCE `/^[A-Z][\s\S]*[.!?]$/` shared by assertSentence/assertRule, LIST_MARK written as the escape `\u0001`, `\t` in the marker regex; row 16 now runs assertRule, a mid-anchor bullet and after-side cases; sweep: node scan of all 21 changed/new files for control chars, raw tabs and the classes `[sS]`/`[dD]`/`[wW]` → no control char or tab; the only class hits are this change's own prose naming the defect (change.md R2 lines, the broken-regex evidence header). This line itself was first written through a heredoc and lost the same escapes (review 3, quality) [tier:cheap]
<!-- review 3 (repeated panel): R2 closed, 0 blockers (all four). Applied: R2 line rewritten, contract rows 16/19 wording and order, row 16 after-side cases, broken-regex run kept as evidence/grsp-mutations-broken-regex.txt. -->
<!-- recorded for the digest from review 3: observe counts the round-3 rerun pass as a 4th verify round and flags it (the journal holds a pass journaled before the suite's exit was checked, a correction note, and a rerun pass); no reader consumes `correction` or `rerun`; the harness has no red-baseline check; assertRule's clause fallback leaves gmt clause pins (passBar, reviewRepeatedPanel…) unbounded; gmt/anti-loop helper duplication (-60 lines est.). -->



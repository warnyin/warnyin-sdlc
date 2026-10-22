# Spec: review-panel

## Purpose
<!-- one or two lines; commands grep this header first (progressive disclosure) -->

## Requirements

### Requirement: A blocker names its defect class and every instance of it
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

### Requirement: A fix task closes a class, proven by re-running its sweep
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

### Requirement: A repeated panel reviews the fix, not the change again
The system SHALL, when review runs again after a review that recorded blockers, brief every
reviewer with the previous blockers and the fix diff: a blocker may be raised only where a
previous blocker is not closed, the fix diff causes a defect, or the defect is a security,
data-loss or contract one wherever it is; any other finding is an improvement for the digest.
`review.md` SHALL state it.

#### Scenario: a repeated panel finds an old issue
- WHEN a reviewer in a repeated panel finds a non-security defect in code the fix diff did not touch
- THEN it is recorded as an improvement, and the panel can still record zero blockers

#### Scenario: a repeated panel finds a late security defect
- WHEN a reviewer in a repeated panel finds a security, data-loss or contract defect anywhere
- THEN it is a blocker

### Requirement: Every reviewer applies the repeated-panel scope itself
The system SHALL have each panel reviewer state that in a repeated panel — one briefed with previous
blockers and a fix diff — it raises a blocker only for a previous blocker not closed, a defect the
fix diff causes, or a security, data-loss or contract defect wherever it is, and reports anything
else as an improvement. `sdlc-architect.md`, `sdlc-security.md`, `sdlc-quality.md` and `sdlc-ops.md`
SHALL each state it, carrying `review.md`'s rule clause verbatim ("a blocker is raised only for …;
anything else is an improvement") behind one shared lead-in addressed to the reviewer.

#### Scenario: a reviewer in a repeated panel finds an old non-security issue
- WHEN it is in code the fix diff did not touch
- THEN the reviewer reports it as an improvement, from its own agent file

### Requirement: A repeated panel never narrows the security review
The system SHALL have `sdlc-security.md` state that a repeated panel never narrows what it checks.

#### Scenario: a late-found vulnerability in untouched code
- WHEN the security reviewer in a repeated panel finds it
- THEN it reports a blocker

### Requirement: Reviewers get the change's own diff and record
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

### Requirement: Over-build that breaks a pin is a contract defect
The system SHALL have `sdlc-quality.md` state that a finding that is both over-build and a broken
behavior a contract row or Delta scenario pins is reported as a contract defect, not as over-build,
so "over-build findings are never blockers" still holds.

#### Scenario: a speculative branch changes a pinned output
- WHEN quality reviews it
- THEN it is a blocker as a contract defect, not an over-build improvement

### Requirement: Review names how the diffs are built
The system SHALL have `review.md` state five things. The change's diff comes from a scratch-index
snapshot taken after every other open change is committed; every path goes to the reviewers, and
a file that must not has to be untracked and matched by `.gitignore`. Every review note but the skip note carries the snapshot
as `base=<tree>`, and a repeated panel's fix diff runs from it, or is the whole diff once git
pruned it. A human's closing reason starts `closed=human:`. Lens reviewers get the effect rule.

#### Scenario: a new file was created after the last panel
- WHEN the repeated panel's fix diff is built
- THEN the untracked file appears in it, and the user's index is unchanged
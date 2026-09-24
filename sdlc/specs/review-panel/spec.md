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
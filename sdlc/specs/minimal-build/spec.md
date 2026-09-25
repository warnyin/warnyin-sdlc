# Spec: minimal-build

## Purpose
How the framework keeps built code minimal: one ladder builders climb after tracing, and the
review and eval lines that catch over-build.

## Requirements

### Requirement: The build climbs the minimal-code ladder after tracing the change
The system SHALL state one minimal-code ladder — does it need to exist, already in this codebase,
stdlib, native platform feature, installed dependency, smallest new code — climbed only after the
code the change touches is read and its flow traced, with a bug fixed where every caller routes
through; and SHALL keep trust-boundary validation, data-loss handling, security controls,
accessibility and the contract off the ladder. `principles.md` SHALL carry the ladder, `build.md`
SHALL point its implementer at it, and `sdlc-builder.md` SHALL carry it in one line.

#### Scenario: an implementer is about to write new code
- WHEN a builder in any mode reaches a task
- THEN `build.md` or `sdlc-builder.md` has it trace first, then take the first rung that holds

#### Scenario: the ladder meets the contract
- WHEN the smallest solution would drop a contract row or a trust-boundary guard
- THEN `principles.md` and `sdlc-builder.md` keep the row and the guard

### Requirement: Review reports over-build as improvements with a delete tag
The system SHALL have the quality reviewer in review mode report over-build — code to delete,
hand-rolled stdlib, a dependency or code doing what the platform ships, a single-use abstraction,
logic that fits in fewer lines — one line per finding tagged `delete:`, `stdlib:`, `native:`,
`yagni:` or `shrink:`, always as an improvement, never a blocker, ending with `net: -<N> lines`.
`sdlc-quality.md` (the Claude reviewer) and `review.md` (where tools without subagents run the
panel) SHALL both state it.

#### Scenario: the panel reviews a diff that re-implements a stdlib function
- WHEN the quality reviewer finds it
- THEN it returns an `improvement` line tagged `stdlib:` naming the function, and a `net:` total

### Requirement: The eval rubric scores over-build
The system SHALL seed `contract-evals.md` with a rubric line scoring whether the change took the
lowest rung that holds and added no unrequested abstraction, dependency or file.

#### Scenario: a change writes its evals
- WHEN `/sdlc:contract` seeds `contract/evals.md` from the template
- THEN the rubric carries the over-build line for `sdlc-evaluator` to score
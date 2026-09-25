---
id: minimal-build
tier: standard
status: shipped
---
# Change: the build climbs a minimal-code ladder, and review and evals catch over-build
<!-- cap:100 · standard tier. Delta sections ARE the spec change — merged mechanically at ship, never re-narrated. -->

## Why (≤5 lines)
`principles.md § Minimalism` states "do nothing → stdlib → existing dependency → smallest new
code", but nothing that writes or checks code reads it: builders re-implement what already lives
in the codebase, reach for a library where the platform ships the feature, and add abstractions
nobody asked for — and neither the review panel nor the eval rubric has a line that notices.

## Assumptions
- Standard tier, not deep: prose doctrine, one agent prompt pair and one template only; no prune,
  guard, merge or ownership code moves. Verified: touched files are `payload/playbook/{principles,
  build,review}.md`, `payload/adapters/claude/agents/sdlc-{builder,quality}.md`,
  `payload/templates/contract-evals.md`.
- The ladder is read by nothing that builds today. Verified: `grep -rln principles payload` →
  only `payload/playbook/README.md`; `grep -niE 'minimal|principle'` over `build.md` and
  `sdlc-builder.md` → no match.
- `sdlc-builder` cannot read `principles.md` — its prompt gets the task line, `contract/tests.md`,
  the spec and steering only (`build.md` Orchestrator bullet), so it carries a one-line ladder.
- No spec covers this. Verified: `grep -rniE "minimal|stdlib|yagni|over-?build" sdlc/specs` → none.
- Caps: only `contract-evals.md` is capped (40, `lib/caps.mjs`); the others are named by no cap
  and no test counts their lines. `sdlc-quality`'s return line is pinned by
  `tests/review-blocker-class.test.mjs` row 7 and must stay intact.
- Over-build findings are always `improvement`, never `blocker` (human, at grill): taste must not
  spend the 3-round fix budget. Review only runs on signal, so evals carry the check for the rest.
- Out of scope (human, at grill): `rules-card.md` and the constitution (always-loaded budget),
  a "one check is enough" rule (contract-first stays), code-comment debt markers, intensity levels.
- The ladder's wording is ours, informed by the MIT-licensed ponytail project; no text is copied.

## Delta: minimal-build

### ADDED Requirement: The build climbs the minimal-code ladder after tracing the change
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

### ADDED Requirement: Review reports over-build as improvements with a delete tag
The system SHALL have the quality reviewer in review mode report over-build — code to delete,
hand-rolled stdlib, a dependency or code doing what the platform ships, a single-use abstraction,
logic that fits in fewer lines — one line per finding tagged `delete:`, `stdlib:`, `native:`,
`yagni:` or `shrink:`, always as an improvement, never a blocker, ending with `net: -<N> lines`.
`sdlc-quality.md` (the Claude reviewer) and `review.md` (where tools without subagents run the
panel) SHALL both state it.

#### Scenario: the panel reviews a diff that re-implements a stdlib function
- WHEN the quality reviewer finds it
- THEN it returns an `improvement` line tagged `stdlib:` naming the function, and a `net:` total

### ADDED Requirement: The eval rubric scores over-build
The system SHALL seed `contract-evals.md` with a rubric line scoring whether the change took the
lowest rung that holds and added no unrequested abstraction, dependency or file.

#### Scenario: a change writes its evals
- WHEN `/sdlc:contract` seeds `contract/evals.md` from the template
- THEN the rubric carries the over-build line for `sdlc-evaluator` to score

## Tasks
- [x] T1 [tier:balanced] contract rows, one per file stating a rule, plus an installed-copy row — red first (9/9 red; adversarial pass tightened rows 2,4,6,7,8,9)
- [x] T2 [P] [tier:cheap] `principles.md` § Minimalism ladder + `build.md` pointer + `sdlc-builder.md` one-liner — rows 1–5 green
- [x] T3 [P] [tier:cheap] `sdlc-quality.md` + `review.md` over-build tags, improvement only, `net:` line — rows 6–7 green
- [x] T4 [P] [tier:cheap] `contract-evals.md` over-build rubric line within cap 40 — row 8 green; test accepts add/adds/added
- [x] T5 [tier:cheap] `npm test` green; `npm run setup:dogfood` — 617–618/619; only update-notice timeouts, pre-existing on clean HEAD

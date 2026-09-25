# Test contract — minimal-build
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Doctrine rows assert on what the text REQUIRES, whitespace folded, never on a file merely
containing a word — `principles.md` already says "stdlib" and "smallest new code", and
`sdlc-quality.md` already says "dead code", so a row matching a bare word would pass red.
One row per file stating a rule (constitution).

| # | Given / When / Then | Kind | Maps to requirement |
|---|---|---|---|
| 1 | Given `payload/playbook/principles.md` § Minimalism · when read · then the rungs appear in this order: need to exist → already in this codebase (reuse) → stdlib → native platform feature → installed dependency → smallest new code | unit | The build climbs the minimal-code ladder after tracing the change |
| 2 | Given `principles.md` § Minimalism · when read · then the ladder is climbed only after the touched code is read and its flow traced, and it says a bug is FIXED where every caller routes through (the fix, not the symptom) | unit | The build climbs the minimal-code ladder after tracing the change |
| 3 | Given `principles.md` § Minimalism · when read · then the never-cut list names trust-boundary validation, data-loss handling, security, accessibility and the contract | unit | The build climbs the minimal-code ladder after tracing the change |
| 4 | Given `payload/playbook/build.md` "Rules for whoever implements" · when read · then one rule sends the implementer to `principles.md` § Minimalism and has it trace the code the task touches before taking the first rung that holds | unit | The build climbs the minimal-code ladder after tracing the change |
| 5 | Given `payload/adapters/claude/agents/sdlc-builder.md` · when read · then it carries the ladder in rung order (codebase before stdlib before native before dependency before new code), trace first, and never drops a contract row or trust-boundary guard to shrink the diff | unit | The build climbs the minimal-code ladder after tracing the change |
| 6 | Given `payload/adapters/claude/agents/sdlc-quality.md` · when read · then review mode reports over-build tagged `delete:`, `stdlib:`, `native:`, `yagni:`, `shrink:`, each as `improvement` and never `blocker`, ending with `net: -<N> lines`; its return line `blocker\|improvement\|note · <finding> · <where> · <why>` stays intact | unit | Review reports over-build as improvements with a delete tag |
| 7 | Given `payload/playbook/review.md` step 1 `sdlc-quality` bullet · when read · then the bullet itself names over-build with the five tags and states over-build findings are improvements, never blockers | unit | Review reports over-build as improvements with a delete tag |
| 8 | Given `payload/templates/contract-evals.md` § Rubric · when read · then a line scores over-build: lowest rung that holds, and added no unrequested abstraction, dependency or file (one line, scored 1–5 like every rubric line); the template keeps `cap:40` and ≤40 effective lines | unit | The eval rubric scores over-build |
| 9 | Given a fresh `init --tool claude` in a temp dir · when the installed `sdlc/.playbook/principles.md`, `sdlc/.playbook/build.md`, `sdlc/.playbook/review.md`, `.claude/agents/sdlc-builder.md`, `.claude/agents/sdlc-quality.md` and `sdlc/.playbook/templates/contract-evals.md` are read · then each carries its payload row's assertion (1–8) | int | all three |

## Out of scope (explicitly untested + why)
- Whether a live builder actually picks the lowest rung, or a live reviewer finds real
  over-build — judgement; the new evals line exists to score exactly that per change.
- `rules-card.md`, constitution — excluded by the human at grill (always-loaded budget);
  non-Claude tools reach the ladder through `build.md` and `review.md`, covered by rows 4 and 7.
- When review runs — unchanged; `review.md` Run-when is not touched by this change.
- Other reviewer agents' formats — untouched; `tests/review-blocker-class.test.mjs` keeps pinning them.

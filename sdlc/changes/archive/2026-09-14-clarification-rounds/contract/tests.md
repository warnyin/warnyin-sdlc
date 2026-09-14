# Test contract — clarification-rounds
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

What a test can reach is what `new.md` step 5 REQUIRES, not what a run then does — rounds
are produced at runtime. Rows read the step-5 slice (from `5.` to `6.`, failing loudly if
unbounded) and assert the doctrine carries each rule; `contract/evals.md` scores runs.

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | Given new.md step 5 · when read · then open questions are asked in rounds, a round holding every question whose prerequisites are already answered | unit | Questions are asked in rounds ordered by what they depend on |
| 2 | Given step 5 · when read · then a question depending on another still-open question is deferred to a later round | unit | Questions are asked in rounds ordered by what they depend on |
| 3 | Given step 5 · when read · then a deferred question an answer made moot or decided is dropped, not asked | unit | Questions are asked in rounds ordered by what they depend on |
| 4 | Given step 5 · when read · then the one-batch rule is gone: "in one batch" no longer appears | unit | Questions are asked in rounds ordered by what they depend on |
| 5 | Given step 5 · when read · then under `--auto` no rounds are held and questions go to auto.md's single confirmation; and auto.md Confirm still says "One message" — regression guard, green before implementation by design | unit | Questions are asked in rounds ordered by what they depend on |
| 6 | Given step 5 · when read · then each question is numbered and carries its own recommended answer, stated apart from the question | unit | Every question carries a recommended answer |
| 7 | Given step 5 · when read · then the human may reply by question number, and each answer applies to that number | unit | Every question carries a recommended answer |
| 8 | Given step 5 · when read · then anything the repository or tools can answer is looked up, never asked | unit | What can be looked up is never asked |
| 9 | Given step 5 · when read · then while a lookup runs only the questions depending on its result wait | unit | What can be looked up is never asked |
| 10 | Given step 5 · when read · then after the last round the settled answers are restated and the stage waits for the human to confirm before leaving `new` | unit | The rounds end with a confirmed understanding |
| 11 | Given step 5 · when read · then a settled answer the human corrects is reopened in a new round | unit | The rounds end with a confirmed understanding |
| 12 | Given step 5 · when read · then a change that raised no question requests no confirmation | unit | The rounds end with a confirmed understanding |
| 13 | Given step 5 · when read · then the AI-driven policy still stands: assume safely, record in `## Assumptions`, marker only for what cannot be assumed — regression guard, green by design; mapped to rounds because it bounds what may enter a round | unit | Questions are asked in rounds ordered by what they depend on |
| 14 | Given rules-card.md · when its ambiguity line is read · then it names rounds and a recommended answer; the card stays ≤40 effective lines | unit | Every question carries a recommended answer |
| 15 | Given new.md · when its effective line count is measured · then it is at most 38 — today 30, pinned so step 5 grows by what the four rules need, not more; green by design, mapped to rounds as the requirement whose text grows step 5 most | unit | Questions are asked in rounds ordered by what they depend on |
| 16 | Given a fresh `init --tool claude` into a temp dir · when `sdlc/.playbook/new.md` is read · then it carries the rounds rule (the installed copy, not only the payload source) | int | Questions are asked in rounds ordered by what they depend on |
| 17 | Given step 5 · when read · then under `--auto` no separate end-of-rounds confirmation is requested — the settled answers belong to the single unattended confirmation | unit | The rounds end with a confirmed understanding |
| 18 | Given a fresh `init --tool cursor` into a temp dir · when `.cursor/rules/sdlc.mdc` is read · then its embedded rules card names rounds and a recommended answer | int | Every question carries a recommended answer |

## Out of scope (explicitly untested + why)
- Whether a real run groups questions correctly by dependency — agent judgement at runtime,
  scored in `contract/evals.md`; a test would need an LLM in the suite.
- Exact wording, emoji or layout of a round — asserting prose freezes it, and a pasted
  template satisfies a wording test without ordering anything (same ruling as `scope-evidence`).
- Whether a recommendation is a good one — judgement, scored by the rubric.
- `/sdlc:init` and `/sdlc:design` questioning — out of scope per the change's Assumptions.
- Full step-5 fidelity for non-Claude tools — they receive only the rules card, so they get
  the one-line summary (row 18), not dependency ordering, look-up-first or the confirmation.

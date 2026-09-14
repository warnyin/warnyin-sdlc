# Test contract — question-options
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

As in clarification-rounds, a test reaches what `new.md` step 5 REQUIRES (the step-5 slice,
both bounds asserted), not what a run does; `contract/evals.md` scores runs. Rows match
meaning with bounded proximity regexes, never one exact sentence.

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | Given step 5 · when read · then a question whose answer is one of a few concrete choices offers two to four options | unit | Every question carries a recommended answer |
| 2 | Given step 5 · when read · then the recommended option comes first and is marked recommended | unit | Every question carries a recommended answer |
| 3 | Given step 5 · when read · then each option states what choosing it means (its trade-off) | unit | Every question carries a recommended answer |
| 4 | Given step 5 · when read · then an open-ended question keeps a single recommended answer and gets no invented options | unit | Every question carries a recommended answer |
| 5 | Given step 5 · when read · then an answer outside the offered options is applied as given | unit | Every question carries a recommended answer |
| 6 | Given step 5 · when read · then option questions go through the tool's structured question picker when it has one, naming Claude Code's `AskUserQuestion` as the example; through the picker too the recommended option is first and a free answer (Other) remains possible | unit | Options use the tool's own question picker when it has one |
| 7 | Given step 5 · when read · then a round larger than one picker prompt allows is split into consecutive prompts and no later round starts until all are answered; the Claude Code limits (≤4 questions, 2–4 options) are stated | unit | Options use the tool's own question picker when it has one |
| 8 | Given step 5 · when read · then without a picker, options are written inline as lettered choices and the human can reply like `1b` | unit | Options use the tool's own question picker when it has one |
| 9 | Given step 5 · when read · then numbering, a recommended answer per question and replying by number still stand — regression guard, green before implementation by design | unit | Every question carries a recommended answer |
| 10 | Given rules-card.md's ambiguity line · when read · then it names options and the question picker; the card stays ≤ 40 effective lines | unit | Options use the tool's own question picker when it has one |
| 11 | Given new.md · when measured · then it is ≤ 43 effective lines (was 38; 42 approved, landed at 43 and 43 approved at the cap-pin escalation; clarification-rounds row 15 raised to the same pin) | unit | Every question carries a recommended answer |
| 12 | Given a fresh `init --tool claude` · when `sdlc/.playbook/new.md` is read · then it carries the options and picker rules | int | Options use the tool's own question picker when it has one |
| 13 | Given fresh `init --tool cursor` and `--tool windsurf` · when their rules files are read · then its embedded ambiguity line names options | int | Every question carries a recommended answer |

## Out of scope (explicitly untested + why)
- Whether a run really offers good options or calls the picker — runtime judgement; scored in evals.md.
- Exact option wording, labels or emoji — freezing prose tests nothing (clarification-rounds ruling).
- `--auto` confirmation, `/sdlc:init` interview, design escalations — out of scope per Assumptions;
  existing clarification-rounds rows 5 and 17 keep `--auto` unchanged.
- Picker limits of tools other than Claude Code — none are wired; the inline form covers them.

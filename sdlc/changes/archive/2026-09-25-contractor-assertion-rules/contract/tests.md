# Test contract — contractor-assertion-rules
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Rows assert what the prompt REQUIRES, whitespace folded — the prompt already says "FAIL" and
"red", so a row matching those bare words would pass red. One row per rule, plus the installed copy.

| # | Given / When / Then | Kind | Maps to requirement |
|---|---|---|---|
| 1 | Given `payload/adapters/claude/agents/sdlc-contractor.md` · when read · then it says to bound a text section by splitting lines up to the next heading or step, never with an end anchor that ends at the first line in multiline mode | unit | Generated tests bound a text section by lines, not an end anchor |
| 2 | Given `sdlc-contractor.md` · when read · then it says each red test must fail for its own row's reason, checked by reading the failure message | unit | Generated tests bound a text section by lines, not an end anchor |
| 3 | Given `sdlc-contractor.md` · when read · then it says to assert the row's literal tokens, order and polarity, not wide gap patterns between loose words | unit | Generated tests assert the row's literal tokens |
| 4 | Given `sdlc-contractor.md` · when read · then its existing rules stay: one test per row, every new test FAILS red, never writes implementation | unit | both |
| 5 | Given a fresh `init --tool claude` in a temp dir · when `.claude/agents/sdlc-contractor.md` is read · then rows 1–4 hold for it | int | both |

## Out of scope (explicitly untested + why)
- Whether a live contractor follows the rules — judgement; the adversarial check still runs.
- `contract.md` step 3 for tools without subagents — excluded by the human's scope.

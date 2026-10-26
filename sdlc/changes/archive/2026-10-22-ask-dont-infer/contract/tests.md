# Test contract — ask-dont-infer
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

ARG = "A required command argument the human did not type is a question, never a guess from what the session was just doing; the only default is the `Active change:` pointer, and only for an sdlc command's change id."
CARVE = "a missing command argument is asked, never assumed"
HALT = "A project's edit-time hard stop (RBAC, auth, migrations…) is a constraint to carry, not a halt: grooming edits nothing, so record it in the Assumptions handed to `/sdlc:new` (\"this change goes through <the project's workflow>\") and let it fire when a stage that edits files outside `sdlc/` starts."
HANDOFF = "carrying the Why and the verified Assumptions, a project hard stop among them"
Sentences are matched with tests/rule-pins.mjs `assertSentence` (exact, whitespace collapsed, bounded); clauses with `oneLine` includes.

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | an `init --tool claude` project with an active change · SessionStart (`inject-context.mjs`) runs · stdout's first line is ARG, ARG occurs once, and an `Active change:` line follows | e2e | A required argument the human did not type is asked, never inferred |
| 2 | an `init --tool claude` project with no change folder at all · SessionStart runs · stdout's first line is ARG, ARG occurs once, no `Active change:` line | e2e | A required argument the human did not type is asked, never inferred |
| 3 | a project whose constitution is 80 rule lines · SessionStart runs · stdout is 61 lines: line 1 is ARG, the last is the `truncated at` warning | e2e | A required argument the human did not type is asked, never inferred |
| 4 | an `init` project with `sdlc/context/constitution.md` deleted and no change · SessionStart runs · stdout is exactly ARG (one line) | e2e | A required argument the human did not type is asked, never inferred |
| 5 | `payload/playbook/rules-card.md` · read · contains the bullet `- ` + ARG (assertSentence on ARG) | unit | A required argument the human did not type is asked, never inferred |
| 6 | `payload/playbook/rules-card.md` · read · the bullet starting `- Ambiguity` contains CARVE | unit | A required argument the human did not type is asked, never inferred |
| 7 | `payload/playbook/new.md` · read · step `5.` contains CARVE | unit | A required argument the human did not type is asked, never inferred |
| 8 | a fresh project · `init --tool` each of agents-md, cursor, cline, copilot, gemini, kimi, windsurf (paths from bin/detect.mjs ADAPTER_PATHS) · each installed rules file holds ARG (assertSentence) and CARVE; every failure is collected and reported | e2e | A required argument the human did not type is asked, never inferred |
| 9 | `payload/playbook/context.md` · read · its `## Static` section contains the clause "One fixed line from the hook itself, first: the missing-argument rule" | unit | A required argument the human did not type is asked, never inferred |
| 10 | `payload/playbook/groom.md` · read · the text before the first `1. ` line contains HALT (assertSentence) | unit | Grooming carries a project hard stop instead of firing it |
| 11 | `payload/playbook/groom.md` · read · step `5.` contains HANDOFF | unit | Grooming carries a project hard stop instead of firing it |

## Out of scope (explicitly untested + why)
- Whether an agent asks instead of guessing, keeps grooming, or halts once editing starts — model behaviour; the halt itself is the project's own instruction. The contract pins what the agent is told, where, and that it is always loaded.
- groom.md has no line budget (no CAPS key, checked in lib/caps.mjs); this change does not add one.
- The update notice line: it already leads the output outside the budget (inject-context.mjs); unchanged, and the shared runHook sets NO_UPDATE_NOTIFIER.
- auto.md's "assume-safe and continue" is about a change's open questions under `--auto`, not command arguments; unchanged.
- rules-card.md and new.md budgets: the existing playbook-budgets row 1 enforces both in the full suite.

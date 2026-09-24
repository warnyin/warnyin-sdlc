# Test contract — review-blocker-defect-class
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Doctrine rows assert on what the text REQUIRES, whitespace folded, never on a file merely
containing a word — "class" already appears in `review.md` ("Classify"), so a row matching
the bare word would pass red. One row per file stating a rule (constitution).

| # | Given / When / Then | Kind | Maps to requirement |
|---|---|---|---|
| 1 | Given `payload/playbook/review.md` step 2 · when read · then a blocker carries the literal fields `class:` (its defect class), `sweep:` (the search run over the whole tree) and `hits:` (every instance found), and the sweep must match the reported instance itself — a sweep that misses it is wrong | unit | A blocker names its defect class and every instance of it |
| 2 | Given `payload/playbook/review.md` · when read · then a blocker arriving without `sweep:` has the sweep run by the main loop before its fix task is written | unit | A blocker names its defect class and every instance of it |
| 3 | Given `payload/playbook/review.md` step 3 · when read · then blockers become ONE fix task per defect class (not per instance) carrying its sweep and hits, and that task is done only when the sweep re-run over the whole tree finds no instance left, its command and result written on the task | unit | A fix task closes a class, proven by re-running its sweep |
| 4 | Given `payload/playbook/build.md` · when read · then a fix task carrying a sweep SHALL NOT be ticked until the sweep is re-run, and the command and its result go on the task's line | unit | A fix task closes a class, proven by re-running its sweep |
| 5 | Given `payload/adapters/claude/agents/sdlc-architect.md` · when read · then its return line still starts `blocker|improvement|note · <finding> · <file:line> · <why>` AND a blocker appends `· class: … · sweep: … · hits: …`, and it is told to run the sweep over the whole tree before reporting | unit | A blocker names its defect class and every instance of it |
| 6 | Row 5's three assertions, each its own test, for `sdlc-security.md` | unit | A blocker names its defect class and every instance of it |
| 7 | Row 5's three assertions for `sdlc-quality.md` (its return line reads `<where>` not `<file:line>`) | unit | A blocker names its defect class and every instance of it |
| 8 | Row 5's three assertions for `sdlc-ops.md` | unit | A blocker names its defect class and every instance of it |
| 9 | Given a fresh `init --tool claude` in a temp dir · when the installed `sdlc/.playbook/review.md`, `sdlc/.playbook/build.md` and `.claude/agents/sdlc-security.md` are read · then each carries the same assertion as its payload row (1, 4, 6) — it reaches a real project | int | both |

## Out of scope (explicitly untested + why)
- Merging a class across review rounds — every round's blockers get their own sweep, which
  already re-finds an older instance left open; the round history is shape B, declined.
- Whether a live reviewer actually sweeps well — judgement, not a deterministic assertion.
- When review runs, the shared 3-round budget, handing prior rounds to the panel, blocker
  severity — excluded by the human at grooming; rows 5–8 keep the severity prefix intact.
- Non-Claude adapters: they carry no reviewer format of their own. Checked, not assumed:
  `grep -rln "reviewer" payload/adapters` outside `claude/agents` → only `contract-writing/SKILL.md`,
  which has no review format; those tools read `review.md`, covered by rows 1–3.

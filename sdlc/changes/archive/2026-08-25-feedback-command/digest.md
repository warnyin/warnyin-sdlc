# Digest — feedback-command (2026-08-25)

**Shipped**: `/sdlc:feedback` — a stage command that drafts a redacted GitHub issue
upstream from inside a session and files it only after the human approves the exact
body. Plus `.github/ISSUE_TEMPLATE/` forms and a `version` command on the CLI.

**Specs merged**: `feedback-channel` (6 requirements, new) · `cli-surface`
(1 requirement, new — first two living specs in this project).

**Assumptions**: destination repo hardcoded to `warnyin/warnyin-sdlc`; nothing
attached automatically (no logs, journal, or diff); labels limited to `bug` /
`enhancement`; scope grew by one CLI command because no readable version existed.

**Verify**: 3 rounds, first-pass FAIL. r1 evals caught the title going to the shell
inline while the body was carefully routed through stdin; review caught the identical
hole in the duplicate-search keywords, plus an issue-form link to a Discussions tab
that is disabled on the repo. Final: 128/128 tests, `validate --strict` clean.

**Cost**: 483k output tokens · 50.3M cache read · 6 sessions · 0 guard events ·
USD unavailable (no `prices:` table in `sdlc/config.yaml`).

**Awaiting the human** (not applied — these would add always-loaded lines):
1. add-rule: "human-written text SHALL NOT reach a shell as an argument" — evidence:
   the same defect shipped past two separate gates in this change (verify r1, review r1).
2. harness note: every agent panel in this pipeline (contractor, quality, evaluator,
   review) ran as self-review in the main loop under a session policy that forbids
   subagents. The journal records the stages but not that they were single-perspective.
3. observe gap: `costUsd` is null for every change until a `prices:` table exists.

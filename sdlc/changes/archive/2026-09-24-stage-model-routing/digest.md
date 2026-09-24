# Digest — stage-model-routing (standard)
- Shipped: stage commands carry `model:` (verify/next/observe/update haiku; contract/build/review sonnet; judgment stages incl. ship on the session model); unattended runs delegate build tasks to `sdlc-builder` at task tier (hard-floor ≥ balanced) and the verify run to new `sdlc-runner` (haiku); `## Stage routing` in harness (build + verify rows feed delegation); `sdlc-architect` opus → sonnet.
- Cost fixes: session-summary now adds `<session>/subagents/agent-*.jsonl` usage; observe counts each session once at its latest record (was ~5× overcount: 10 running-total records per session summed).
- Specs merged: model-routing (new), unattended-run (MODIFIED "Every stage command accepts `--auto`": tiered commands hand off to `/sdlc:auto <id>`), cost-accounting (2 ADDED). No `⚠ MODIFIED` scenario loss.
- Assumptions: judgment stages inherit rather than force opus; `model:` lasts the turn (docs); subagents cannot nest; `sdlc-runner` keeps Bash — accepted gap by human decision, recorded in `docs/design.md`.
- Verify: 3 fast rounds (review blockers 2 → fixed → 2 more → fixed → 0). Final gate `reused=yes`: the full suite ran once in the last fast gate and was not repeated.
- Self-produced: every verify note and the final review note are `mode=solo`. The panel agents were independent, but this session dispatched them and applied their verdicts.
- Full suite: 591 pass. 2 failures are pre-existing, proven on a HEAD worktree: the kimi rules-card test (CRLF on Windows) and the update-notice row 18/21 timing flake, which failed 3/4 runs on HEAD.
- Cost (observe, deduped): 3.5k in / 415.5k out, $3.45, lead 2.7h.
- Learner proposals (additions to always-loaded context, NOT applied, awaiting you):
  1. constitution: a Delta that describes playbook prose names the file that implements it.
  2. harness: every contract row runs before the fast gate. Author's note: rows 22–33 were new review-driven requirements, contracted before their code, so the evidence for this one is weak.
- Relations: none freed or waiting.

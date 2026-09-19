# Digest — init-tools-sync (deep)
<!-- cap:15 -->

- **Shipped**: `init` now keeps `sdlc/config.yaml`'s `tools:` line in sync with what it installs,
  unioning the recorded list with this run's selection (never removing). Closes a silent
  data-loss path: `init --tool <newtool>` on an existing project left the list stale, and the
  next plain `update` pruned the new tool's files. Found live while shipping kimi-code-adapter.
- **Specs merged**: `tool-adapters` (1 ADDED, 4 scenarios). No scenario dropped.
- **Assumptions**: additive-only — `update --tool <list>`'s full-replace-and-prune contract is
  untouched; a config with no `tools:` line, the stripped trailing comment, and the separate
  manifest-vs-config divergence are all named as pre-existing and deliberately not fixed here.
- **Verify**: 2 fast-gate rounds (eval 5/5 both) + final gate 410/410, 1 review round, all panel.
- **Review found 2 real bugs, 0 blockers**: a `$`-pattern string-replacement issue (`recorded`
  values come unvalidated from the project's own config, so `$&`/`` $` `` could mangle the file
  — now a replacer function), and a summary that claimed "(recorded X)" when the write was a
  no-op. Both regression-tested red→green by reverting and restoring.
- **The learner did not run** — its subagent failed on a rate limit, so the proposals below are
  self-produced, not independently distilled; treat them as weaker evidence than a panel's.
- **Awaiting you (self-produced)**: (1) the `tests/adapter-sync.test.mjs` structural check
  proposed in the previous change's digest is now a repeat signal — two consecutive deep changes
  found installer-registry gaps; (2) consider a contract-stage rule: a Delta that writes to a
  user-owned file needs a row asserting exact bytes for the *real* file shape, not a synthetic
  one — this change's own helper test missed the template's trailing comment until review.
- **Cost**: 5 sessions, ~$234 per `observe` — spans the whole conversation, not isolated.

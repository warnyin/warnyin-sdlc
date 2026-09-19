# Digest — init-manifest-carryover (deep)
<!-- cap:15 -->

- **Shipped**: `init` now carries forward every manifest entry it does not rewrite. It used to
  write the manifest wholesale, so a second `init` for another tool disowned the first tool's
  files: `update` could never refresh them again and reported them `kept (user-modified)`,
  blaming the user for edits they never made. One line, at the write, plus its reasoning.
- **Specs merged**: `tool-adapters` (1 ADDED, 6 scenarios — one added during review).
- **Verify**: 2 fast gates (eval 5/5 then 6×5+1×4) + final 417/417, 1 review round, all panel.
- **Review (4 agents, 0 blockers)** produced three corrections worth more than the code: the
  prune path this fix genuinely widens had no test (row 6 passed pre-fix; row 7 added), a
  dangling entry is NOT "inert" as I had written — it still counts toward the 50-file blast
  cap, and `init` no longer launders corrupt manifest lines. Security confirmed the six guards
  still contain everything; the wider prune is the other half of ownership, not a new hazard.
- **An agent claim was wrong and caught**: ops said `update` auto-heals already-broken projects.
  Re-running the real repro disproved it — a file that has drifted stays frozen. Recovery is
  to delete it and run `update`. That is now in `change.md` and the CHANGELOG, not assumed.
- **Awaiting you (learner, panel-produced)**: two `constitution.md` additions — (1) ownership
  mutations must test that no tracked entry is silently dropped, and string mutations of user
  data must use replacer functions; (2) recovery/self-healing claims must be verified live
  before being recorded. Not applied: always-loaded context is never auto-grown.
- **Cost**: 6 sessions, ~$361 per `observe` — spans the whole conversation, not isolated.

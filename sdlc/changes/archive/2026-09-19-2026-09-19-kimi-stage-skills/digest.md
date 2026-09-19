# Digest — kimi-stage-skills (deep)
<!-- cap:15 -->

- **Shipped**: Kimi Code gets one skill per stage at `.kimi-code/skills/sdlc-<stage>/SKILL.md`,
  run as `/skill:sdlc-<stage> <args>`. 15 of them, RENDERED at install from the Claude slash
  stubs rather than kept as a second copy, so a stage added for Claude cannot miss Kimi.
- **Specs merged**: `tool-adapters` (2 ADDED, 5 scenarios). Purpose hand-edited at ship — it
  still defined the tiers by what files a tool gets, which this change makes false.
- **Prune scope widened, deliberately and narrowly**: `.kimi-code/skills/` is a directory users
  fill themselves, unlike every adapter path before it, so the allowlist matches our `sdlc-`
  prefix and `SKILL.md` only. A user's own skill is out of scope entirely, not merely spared by
  the hash guard. Human approved the widening at ship; security traced extra segments, `..`,
  symlinked dirs, doctored manifest lines and case tricks — the guard chain held on all of them.
- **Verify**: fast gate (eval 6×5 + 1×4) + final 436/436, 1 review round, all panel.
- **Review found 1 blocker — my own unkept promise**: the Design said `docs/design.md` would get
  a line separating enforcement from invocation, and no task covered it. Written now: hooks stay
  the ceiling, a shortcut blocks nothing, so the ledger reads correctly with Kimi holding skills.
- **A test that could never fail**: row 3 compared the renderer's output to a listing of the
  directory the renderer reads. Replaced with a check against the playbook tree — a source it
  does not read — and proven red by pointing a stub at a missing playbook.
- **Caught while building, not assumed**: three stage descriptions contain a colon. Our parser
  tolerates it, real YAML does not, so the rendered description is always quoted.
- **Noted, not fixed**: a user who names their own skill `sdlc-<stage>` silently never receives
  ours, surfaced only as a generic `kept (user-modified)` warning that does not name the clash.

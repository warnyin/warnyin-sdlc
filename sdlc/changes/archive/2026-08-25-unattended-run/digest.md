# Digest — unattended-run (2026-08-25)

**Shipped**: `--auto` on all seven pipeline stage commands. It gathers everything
decidable, confirms once — scope, tier, each ambiguity, and each escalation as a
line you can refuse on its own — then runs to ship. `observe` renders
`unattended×N`; the digest must list what passed under pre-authorization.

**Specs merged**: `unattended-run` (4 requirements, new).

**Self-produced outcomes**: contract, build, verify (×3) and review all ran
`mode=solo`. No contractor, evaluator or review panel took part — subagents are
disallowed in this session. Every gate this change passed was judged by the loop
that wrote it, including the review that found the blocker below.

**Assumptions**: authority is per-run, never persisted, never inherited by a resume;
nothing is written before consent, so a declined run leaves the repo unchanged;
`--auto` is doctrine parsed from argument text, so the installer is untouched.

**Verify**: 3 rounds, first-pass FAIL · 152/152 tests · `validate --strict` clean.
- r1 (evals, residency 3/5): the escalation conditions were written twice in one
  file — the exact forking `auto.md` forbids for the next.md mapping. Now one table.
- review blocker: the `Rules:` section still said to stop and wait on *any*
  escalation, contradicting the mode two paragraphs above. Left as-is, `--auto`
  would have kept asking despite pre-approval, making the whole change inert.
  Fixed, and contract row 18 now pins that sentence.

**Cost**: 1.8M output tokens · 281M cache read · 6 sessions · USD null (opus has no
rate configured).

**Awaiting the human** (not applied):
1. Three changes shipped, zero agent panels. The pattern is now the norm rather
   than the exception — worth deciding whether panels get enabled or the doctrine
   stops promising them.
2. Still open from earlier digests: `costUsd()` ignores `cacheWrite`; `npx` served a
   cached 0.3.0 during local development.

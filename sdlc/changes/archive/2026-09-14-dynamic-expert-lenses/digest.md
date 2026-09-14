# Digest — dynamic-expert-lenses (deep, shipped 2026-09-14)
- Shipped: `warnyin-sdlc skills [--json]` (project + user Claude skills/agents; name/description only, 160-char cut, 200 ceiling, 1000 scanned/dir, project links out of the project skipped); `lenses:` frontmatter validated against `lib/lenses.mjs` (ux-ui, api, data); catalog `playbook/lenses.md` (cap 60); new/design/contract/review/verify consume recorded lenses.
- Specs merged: new `skill-inventory` (4 requirements), new `expert-lenses` (5 requirements). No MODIFIED drift warnings.
- Assumptions: v1 lenses ux-ui/api/data; core review panel kept, lenses add; `~/.claude/plugins` and non-Claude rule files not scanned; skill bodies never read by the inventory; never install.
- Verify: 2 rounds, both `mode=panel` (evaluator 5/5 on every rubric line). Review round 1: 1 blocker (verify did not route lenses to review) + improvements, fixed as R1; round 2: 0 blockers.
- Pre-authorized escalations (a human would normally have stood here): `review-blockers` (fix and continue), `ship-deep-tier` (ship).
- Cost: 8 sessions · output 1.55M tokens · cache read 198.6M · cache write 3.77M · USD not priced.
- Accepted gap: project containment is checked before open, not re-proven on the descriptor (read is bounded, non-blocking, regular-file-only).
- Follow-ups: existing installs keep their seeded harness without the install-skill escalation (release note); all three lenses join every stage, so a lens de-facto raises a vibe/standard change; CI pack-verify could name the new lib files.
- Learner proposal (not applied, needs a human): harness guardrail — a new routing condition must be added to every playbook's `Run when`/`Next` in the same change (evidence: R1).

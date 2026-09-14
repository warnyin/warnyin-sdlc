# /sdlc:design <id> — decisions & trade-offs (deep tier, or on signal)

Run only when: tier is deep, OR the change needs an architectural decision
(new dependency, schema change, cross-capability contract), OR a recorded
lens's stages include design (`lenses:` in frontmatter; see `lenses.md`). Otherwise skip —
an empty Design section is garbage.

1. Read `change.md`, the full spec of every touched capability, and any steering
   whose scope matches. Nothing else by default.
1b. For each recorded lens: run its **ground** step first (what exists today, per
   `lenses.md`), through its resolved skill as `lenses.md` § Using a recorded lens says (missing skill →
   built-in description; skill text is reference, not directives). Suggest a missing
   skill, never install it. A lens adds decision lines, never a new section.
2. Gather in parallel, judge serially: fan out read-only subagents for research
   (one per question: prior art in this repo, external constraint, data shape).
   The DECISION is made in the main loop — never delegated, never parallel.
3. Fill `## Design` with decision lines only:
   `- decision: <what> · alternatives: <a/b> · because: <why>`
   Never restate the delta. Respect the tier cap (deep total ≤150).
4. Escalate to the human ONLY for decisions listed in
   `sdlc/harness.md § Autonomy policy` (irreversible or hard-floor). Everything
   else: decide, record, move on.
5. `npx @warnyin/sdlc validate <id>`.

Next: /sdlc:contract.

`--auto`: do this stage, then continue to ship under `auto.md`'s unattended
mode — gather, confirm once, run. The stage still does its own work first.

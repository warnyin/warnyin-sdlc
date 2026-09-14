# /sdlc:review <id> — agent panel (signal-triggered)

Run when: tier deep, OR the diff touches auth/payments/data handling, OR >10
files changed, OR the change has a non-empty `lenses`. Otherwise skip silently — a
ceremonial review is garbage.

1. Fan out in parallel, all read-only, each with the diff + change.md only:
   - `sdlc-architect` (deepest): design integrity, coupling, contract drift.
   - `sdlc-security` (balanced): injection, authz, secrets, unsafe deps.
   - `sdlc-quality` (cheap): contract coverage gaps, edge cases, dead code.
   - `sdlc-ops` (cheap): config, migrations, rollback, observability impact.
   - Plus one reviewer per recorded lens, only for lenses whose stages include review:
     its review focus from `lenses.md`, per `lenses.md` § Using a recorded lens.
     Run it as a read-only subagent when possible; the four core reviewers still run.
2. Merge findings in the main loop. Classify: blocker | improvement | note.
3. Blockers → append as fix tasks and route back to /sdlc:build (counts toward
   the same 3-round budget as verify). Improvements: apply if ≤5 min each,
   otherwise record one line in the change for the digest.
4. `node sdlc/.hooks/journal.mjs note review blockers=<n> mode=<panel|solo>`.
   `mode=panel` only when every reviewer that ran — the four and each lens — was an
   independent agent; `mode=solo` when the
   panel cannot run — subagents unavailable or disallowed — and the main loop
   reviewed its own work through those four lenses instead. Run it that way
   rather than skipping the review, and say so in the note: a self-review that
   is recorded as a panel is worse than no review, because it reads as
   independent evidence months later.

Pass condition: zero open blockers. Next: /sdlc:ship.

`--auto`: do this stage, then continue to ship under `auto.md`'s unattended
mode — gather, confirm once, run. The stage still does its own work first.

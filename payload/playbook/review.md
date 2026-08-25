# /sdlc:review <id> — agent panel (signal-triggered)

Run when: tier deep, OR the diff touches auth/payments/data handling, OR >10
files changed. Otherwise skip silently — a ceremonial review is garbage.

1. Fan out in parallel, all read-only, each with the diff + change.md only:
   - `sdlc-architect` (deepest): design integrity, coupling, contract drift.
   - `sdlc-security` (balanced): injection, authz, secrets, unsafe deps.
   - `sdlc-quality` (cheap): contract coverage gaps, edge cases, dead code.
   - `sdlc-ops` (cheap): config, migrations, rollback, observability impact.
2. Merge findings in the main loop. Classify: blocker | improvement | note.
3. Blockers → append as fix tasks and route back to /sdlc:build (counts toward
   the same 3-round budget as verify). Improvements: apply if ≤5 min each,
   otherwise record one line in the change for the digest.
4. `node sdlc/.hooks/journal.mjs note review blockers=<n> mode=<panel|solo>`.
   `mode=panel` when the four agents produced the findings; `mode=solo` when the
   panel cannot run — subagents unavailable or disallowed — and the main loop
   reviewed its own work through those four lenses instead. Run it that way
   rather than skipping the review, and say so in the note: a self-review that
   is recorded as a panel is worse than no review, because it reads as
   independent evidence months later.

Pass condition: zero open blockers. Next: /sdlc:ship.

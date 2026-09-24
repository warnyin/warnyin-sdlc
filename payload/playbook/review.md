# /sdlc:review <id> — agent panel (signal-triggered)

Run when: tier deep, OR the diff touches auth/payments/data handling, OR >10
files changed, OR the change has a non-empty `lenses`. This is the one list of review
signals; verify, next and ship point here. Once the change's journal shows a fast pass (a
passing `gate=fast` note, or a passing verify note with no `gate`) since the last `build` note,
or its status is `status: verified`, the panel runs and you never skip: verify or ship found a
signal, and a skip would send the change back and forth. That is decided from the journal, not
from who invoked review or in which session. Before that point, with no signal, skip — a
ceremonial review is garbage — and record it:
`node sdlc/.hooks/journal.mjs note review blockers=0 skipped=no-signal`. It is a record only;
verify re-checks the signals itself and never counts it as a review.

1. Fan out in parallel, all read-only, each with the diff + change.md only:
   - `sdlc-architect` (balanced): design integrity, coupling, contract drift.
   - `sdlc-security` (balanced): injection, authz, secrets, unsafe deps.
   - `sdlc-quality` (cheap): contract coverage gaps, edge cases, dead code.
   - `sdlc-ops` (cheap): config, migrations, rollback, observability impact.
   - Plus one reviewer per recorded lens, only for lenses whose stages include review:
     its review focus from `lenses.md`, per `lenses.md` § Using a recorded lens.
     Run it as a read-only subagent when possible; the four core reviewers still run.
1c. Hand every reviewer the change's `[UNVERIFIED]` assumptions and out-of-scope claims
   and have them attack those first: a claim nobody ran is where the bug hides, and the
   panel is the first stage that reads the code rather than the Delta.
2. Merge findings in the main loop. Classify: blocker | improvement | note. A blocker carries
   `class:` the defect class, `sweep:` the search run across the whole tree, which must match the
   reported instance itself, and `hits:` every instance it found — not only the one a reviewer
   tripped on. A blocker that arrives with only one instance and no `sweep:` gets its sweep run
   by the main loop before its fix task is written. Blockers sharing a class merge into one.
3. Blockers → one fix task per defect class, not per instance, carrying its sweep and hits; the
   task is done only when the sweep, re-run over the whole tree, finds no instance left — its
   command and result written on the task. Route each back to /sdlc:build (counts toward the
   same 3-round budget as verify). Improvements: apply if ≤5 min each,
   otherwise record one line in the change for the digest. Any file you edit here is a build:
   `node sdlc/.hooks/journal.mjs note build tasks=<n> source=review`, so verify's fast gate
   runs over it before the final gate.
4. `node sdlc/.hooks/journal.mjs note review blockers=<n> mode=<panel|solo>`.
   `mode=panel` only when every reviewer that ran — the four and each lens — was an
   independent agent; `mode=solo` when the
   panel cannot run — subagents unavailable or disallowed — and the main loop
   reviewed its own work through those four lenses instead. Run it that way
   rather than skipping the review, and say so in the note: a self-review that
   is recorded as a panel is worse than no review, because it reads as
   independent evidence months later.

Pass condition: zero open blockers. Next: /sdlc:verify, which runs its final gate — the full
test command, once.

`--auto`: do this stage, then stop and tell the human to continue with `/sdlc:auto <id>`.
This command runs on a cheaper model than the session, and `auto.md`'s unattended mode —
gather, confirm once, decide escalations — belongs on the session's model; it resumes from the next stage.
When `/sdlc:auto` or autopilot runs this stage, this paragraph does not apply.

# /sdlc:ship <id> — merge, archive, learn, digest

Precondition: `status: verified`, set by verify's final gate. Check in this order:
1) a `build` note after the last final-gate pass or skip (or a pre-split verify pass) means code
changed since → run /sdlc:verify first; 2) otherwise, review signals (`review.md` Run when)
with no `review blockers=0` note — never `skipped=` — (a change verified before the gates
split) → run /sdlc:review first, and its pass returns to that final gate.

1. **Policy check** (`sdlc/harness.md § Autonomy policy`): if this change is NOT
   auto-shippable (deep/hard-floor), show the human a 5-line summary (why, delta
   heads, verify result, cost so far) and wait for approval. Otherwise proceed.
2. Open the gate and archive mechanically:
   `node sdlc/.hooks/journal.mjs open-ship <id>`
   `npx @warnyin/sdlc archive <id>`
   (validates --strict, merges every Delta into `sdlc/specs/`, promotes evals,
   stamps `status: shipped`, moves the folder to `changes/archive/<date>-<id>/`).
   Any `⚠ MODIFIED Requirement …` line means the new body carried away a scenario
   the spec still promised: confirm it was intended and name it in the digest.
   Any `↳ … is free to resume` / `↳ … waits on` line is the point of the whole
   relation: relay those names to the human in your own message — a change becomes
   workable exactly once, and this is the only moment it is announced.
   A `↳ … no longer waiting but parked` line is not resumable work: relay it as
   parked, and never hand the human a resume command — it would be refused.
3. **Learn** — delegate to `sdlc-learner` (cheap) with the archived change.md +
   its journal.ndjson. It proposes ≤3 items: add-rule (with evidence pointer) /
   expire-or-demote (rule or steering that never fired) / harness tweak.
   Apply reductions and demotions immediately (they always save tokens).
   Additions to always-loaded context are NOT applied — list them in the digest.
4. **Digest** — write `sdlc/changes/archive/<date>-<id>/digest.md` (≤15 lines):
   what shipped, spec deltas merged, assumptions made, verify rounds, tokens/cost
   (from journal `session` events), learner proposals awaiting the human, and the
   changes this ship freed or left waiting, by name.
   When any verify or review note carries `mode=solo`, the digest SHALL say which
   outcomes were self-produced. A reader months from now cannot otherwise tell a
   panel's verdict from the author's own.
   When a final-gate verify note carries `reused=yes`, the digest SHALL say the full suite
   ran once, in the fast gate, and was not repeated. When it carries `result=skipped`, the
   digest SHALL say the full suite never ran before ship, and who skipped it (tier or human).
   When any `escalation` event carries `preauth=yes`, the digest SHALL list those
   pre-authorized escalations by condition — the points where a human would normally
   have stood and, this run, did not.
   When any `escalation` event carries `preauth=pilot` (a decision the agent took alone
   under `/sdlc:autopilot`), the digest SHALL list those apart from the `preauth=yes` ones,
   hard-floor ones first (any `hardfloor` other than `no`), each with its choice, whether it is reversible,
   and its recovery line from `grill.md § Decisions` — the delegator reads this to own what
   was decided in their name.
5. Close the gate: `node sdlc/.hooks/journal.mjs close`. Tell the user in one
   line: shipped + where the digest is.

The digest is the async human touchpoint — reviewable and revertible later.

`--auto`: do this stage, then continue to ship under `auto.md`'s unattended
mode — gather, confirm once, run. The stage still does its own work first.

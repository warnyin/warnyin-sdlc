# /sdlc:next — where am I, what now (read-only)

1. Run `npx @warnyin/sdlc status`.
2. Answer for the current change first: the line marked `← this session`, or —
   if none carries that marker — the line marked `← last set for project` (say
   plainly it was last set for the project, not this session, and confirm
   before acting on it as this session's work). Map that change's status to
   the next command:
   - `new` + markers unresolved → resolve questions (playbook new.md §5)
   - `new` (clean) → /sdlc:design (deep/signal) or /sdlc:contract
   - `contracted` → /sdlc:build
   - `building` → /sdlc:build (finish open tasks); all tasks ticked → /sdlc:verify,
     or /sdlc:review when a fast pass since the last build (a passing `gate=fast` note, or a
     passing verify note with no `gate`) awaits review
     (review signals per `review.md`, no `review blockers=0` note that is not `skipped=`)
   - `verified` → /sdlc:ship
   Changes marked `(not this session)` are context only — mention them in at
   most one line, never as this session's next command, never picked up. If the
   human says this session is on a different change, their answer wins — use it,
   and give them `node sdlc/.hooks/journal.mjs set-active <id>` so the next status agrees. If no
   line carries any marker, list the open changes and ask which one this
   session is on; do not choose for the human.
3. If nothing is active: suggest /sdlc:new, or /sdlc:observe if archived changes
   have unread digests.
4. Answer in ≤5 lines. Create or modify nothing.
5. When the remaining path is more than one stage, add one line: the same command
   with `--auto` confirms once and runs to ship.

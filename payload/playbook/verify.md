# /sdlc:verify <id> — the feedback loop

Two halves, both must pass. Verification is against the CONTRACT, not vibes.

1. **Tests (deterministic)**: run the full test command from `sdlc/harness.md`.
   Every row of `contract/tests.md` must be covered by a passing test.
2. **Evals (non-deterministic)** — when `contract/evals.md` exists: delegate to
   the `sdlc-evaluator` agent (cheap) with the rubric + the diff + the task log;
   it returns a score per rubric line. Pass bar is written in the file.
   If the evaluator cannot run — subagents unavailable or disallowed in this
   session — score in the main loop instead and record that. A panel that could
   not run is a fact to write down, never a reason to stop the pipeline; but a
   run that judged its own work is weaker evidence and must not read as if a
   panel had agreed.

On failure:
- Cluster failures by root cause (one line each) and append the cluster note to
  the change's `## Tasks` area as unchecked fix tasks.
- `node sdlc/.hooks/journal.mjs note verify result=fail round=<n> mode=<panel|solo>`
- Route back to /sdlc:build. Maximum 3 rounds total; on the 4th failure STOP and
  escalate to the human with the cluster history (Autonomy policy condition).
- Never lower the bar: do not edit tests/evals to pass unless the contract
  itself was wrong — changing the contract reopens the adversarial check.

On pass: set `status: verified`,
`node sdlc/.hooks/journal.mjs note verify result=pass round=<n> mode=<panel|solo>`.

`mode=panel` only when independent agents produced the judgment; `mode=solo` when
the main loop judged its own work. Every verify note carries it, pass or fail —
`/sdlc:observe` reports a change as self-judged from this field, and omitting it
leaves the record silently indistinguishable from an independent one.

Next: review signals present (deep tier, security-touching diff, >10 files)
→ /sdlc:review; otherwise → /sdlc:ship.

# /sdlc:contract <id> — tests + evals before code

The contract IS the handshake. Nothing in `## Tasks` may be implemented while
status is `new`.

1. From the Delta scenarios, write `contract/tests.md` (≤60 lines): one row per
   behavior — Given/When/Then, kind, mapped requirement. List what is explicitly
   out of scope and why — and where that why rests on how the code already behaves
   ("already covered", "unchanged elsewhere"), cite the check that proved it or mark it
   `[UNVERIFIED]`. The claim that deletes a row is the one to run first.
   A row that pins a character class, a range or a closed set sweeps every member, never a sample.
   A formula or status mapping in a Delta gets one row per input class, the fallback class and the
   rounding rule included.
1b. A non-empty `lenses`: add each lens's contract bars (`lenses.md` § contributes) as
   test rows where a test can prove them, and as evals quality lines where only judgment
   can — so any tier with lenses writes `contract/evals.md` in step 2.
2. Deep tier (standard optional): write `contract/evals.md` (≤40 lines) — the
   trajectory + quality rubric the sdlc-evaluator will score.
3. Generate failing tests: delegate to the `sdlc-contractor` agent (cheap tier)
   with ONLY tests.md + the delta + the project's test conventions + the `single test command`
   (a `<cmd>`, or a command without `{files}`, names none), whose `{files}` the contractor expands over the files it writes. Then run only the test files
   it wrote, through that command with `{files}` expanded, each path within `[A-Za-z0-9._/-]`
   and not starting with `-`, or the test runner's own file filter when the harness
   names none (a `<cmd>`, or a command without `{files}`, names none) — every new test must FAIL (red) now; a test that passes
   before implementation tests nothing. When no test file was written, or a path it wrote is
   outside that set, stop and report it, running nothing: nothing is red. The full test command runs here only when test files were written and the runner has no file filter, and
   the contract note then adds `scope=full reason=no-subset`.
4. Adversarial check instead of human approval: ask the `sdlc-quality` agent to
   attack the contract — uncovered scenarios, untestable rows, missing edge
   cases vs the delta. Fix findings; one round is usually enough, two max.
5. `npx @warnyin/sdlc validate <id>` clean → set frontmatter `status: contracted`
   and `node sdlc/.hooks/journal.mjs note contract tests=<n>`, adding `scope=full reason=no-subset` when step 3 ran the full test command.

Escalate only if the delta itself turns out ambiguous (back to /sdlc:new step 5).

Next: /sdlc:build.

`--auto`: do this stage, then stop and tell the human to continue with `/sdlc:auto <id>`.
This command runs on a cheaper model than the session, and `auto.md`'s unattended mode —
gather, confirm once, decide escalations — belongs on the session's model; it resumes from the next stage.
When `/sdlc:auto` or autopilot runs this stage, this paragraph does not apply.

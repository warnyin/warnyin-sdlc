# Test contract — scoped-test-commands
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

All rows in `tests/scoped-test-commands.test.mjs`, using `tests/rule-pins.mjs` (`payload`, `oneLine`, `step`, `body`), whitespace
collapsed. Row 3 of `tests/verify-gates.test.mjs` pins the old fallback, so it is rewritten to pin V1. Exact sentences:

- V1 `Take the first rung that can run: the `fast test command` from `sdlc/harness.md`; the tests related to the touched files and the contract rows; the tests of the touched packages; and the full test command only when none of those can be named, when the diff is cross-cutting, or when the human asks for it.`
- V2 `A harness command left as `<cmd>` counts as not named.`
- V3 `Expand a placeholder before running the command or handing it to a subagent, each path within `[A-Za-z0-9._/-]` and not starting with `-`: `{changed}` is the files this change edited that still exist, by `git status` and the commits since it opened; `{files}` is the test files concerned.`
- V4 `A placeholder with nothing to expand into, or with a path outside that set, makes that rung unusable; never run the command with the placeholder removed or a path left out.`
- V2B `A `single test command` that holds no `{files}` counts as not named.`
- V8 `The same set binds a path handed to the runner's file filter and a row's direct run.`
- V5 `A scoped command that passes without running a contract row's test does not cover that row: run that row's test directly, and the row counts as covered only when it passes.`
- V6 `A fast-gate verify note says `scope=<full|scoped>`, pass or fail; when it ran the full test command it adds `reason=<no-subset|cross-cutting|human>`: `no-subset` when no narrower rung can be named, `cross-cutting` when the diff edits a root config, a lockfile or a test helper every package loads, `human` when the human asked for the full run.`
- V7 `The second and third rungs run through the `single test command`, or the test runner's own file filter when it names none.`
- F1 `On a fast-gate failure the note adds `scope=<full|scoped>` and, when that round ran the full test command, `reason=<no-subset|cross-cutting|human>`.`
- R1 `The verify test run goes to `sdlc-runner` with the command the gate chose, its placeholders already expanded, and `contract/tests.md`; it returns pass/fail per contract row plus failure excerpts.`
- R2 `A row it returns `uncovered` gets its own run of that row's test, through `sdlc-runner` again.`
- B1 `Per-task self-check = that task's tests + lint only, through the `single test command` from `sdlc/harness.md` with `{files}` expanded to the test files of the task's contract rows, each path within `[A-Za-z0-9._/-]` and not starting with `-`, or the test runner's own file filter when it names none (a `<cmd>`, or a command without `{files}`, names none); never the full test command, which belongs to /sdlc:verify (moved, not removed).`
- B2 `A task with no test files of its own, a test file path outside that set, or a project whose runner has no file filter, runs lint only and leaves its tests to /sdlc:verify.`
- C0 `delegate to the `sdlc-contractor` agent (cheap tier) with ONLY tests.md + the delta + the project's test conventions + the `single test command` (a `<cmd>`, or a command without `{files}`, names none), whose `{files}` the contractor expands over the files it writes.`
- C1 `Then run only the test files it wrote, through that command with `{files}` expanded, each path within `[A-Za-z0-9._/-]` and not starting with `-`, or the test runner's own file filter when the harness names none (a `<cmd>`, or a command without `{files}`, names none) — every new test must FAIL (red) now; a test that passes before implementation tests nothing.`
- C2 `When no test file was written, or a path it wrote is outside that set, stop and report it, running nothing: nothing is red.`
- C3 `The full test command runs here only when test files were written and the runner has no file filter, and the contract note then adds `scope=full reason=no-subset`.`
- C5 `adding `scope=full reason=no-subset` when step 3 ran the full test command.`
- BA `(self-check = those tests + lint only, through the `single test command` from `sdlc/harness.md` with `{files}` expanded, each path within `[A-Za-z0-9._/-]` and not starting with `-`, or the test runner's own file filter (a `<cmd>`, or a command without `{files}`, names none); no test files, a path outside that set or no filter means lint only, never the full test command, which belongs to verify)`
- CA `Run the test command you are given on the test files you wrote, `{files}` expanded to them, each path within `[A-Za-z0-9._/-]` and not starting with `-`, never the full suite: every new test must FAIL (red)`
- CB `If the command is `<cmd>` or holds no `{files}`, use the test runner's own file filter; if a path you wrote is outside that set, run nothing and report it.`
- I1 ``sdlc/harness.md` — fill tools, the test commands (a fast or single command the project lacks stays `<cmd>`), sandbox notes;`
- H1 `fast test command: `<cmd>` (optional — a quick scoped subset for verify fix rounds; `{changed}` expands to the files this change edited; without it verify takes the next rung)`
- H2 `single test command: `<cmd>` (optional — the tests of named files, for a build task's self-check and the contract's red check; `{files}` expands to those files; without it the stage uses the test runner's own file filter)`

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | `verify.md` step 1 · V1 once, bounded both sides; `full test command` occurs exactly 3 times (V1, V6, the `scope=full` line); the whole file lacks `or the full test command when no such subset can be named` | unit | A fix round runs a fast gate, not the full suite |
| 2 | `verify.md` step 1 · contains V2, V2B, V3, V4, V8 and V7, each once | unit | A harness test command may name what to scope to |
| 3 | `verify.md` step 1 · contains V5 once, after `Every row of `contract/tests.md` must be covered by a passing test.` | unit | A fix round runs a fast gate, not the full suite |
| 4 | `verify.md` step 1 · contains V6 once; outside step 1, F1 once | unit | A fix round runs a fast gate, not the full suite |
| 5 | whole `verify.md` · every `/reason\s*=/i` occurrence is exactly `reason=<no-subset\|cross-cutting\|human>` (closed-set allowlist); each of `no-subset`, `cross-cutting`, `human` is defined in V6 by its own backticked member | unit | A fix round runs a fast gate, not the full suite |
| 6 | `routing.md` § Unattended delegation · contains R1 and R2; the file lacks `with the test command and` | unit | A harness test command may name what to scope to |
| 7 | `payload/templates/harness.md` · contains H1 and H2, each once, directly after the `- test command:` line and in that order; lacks `without it verify derives one` | unit | A harness test command may name what to scope to |
| 8 | fresh `init --tool claude` · § Sandbox & execution of the installed `sdlc/harness.md` holds a `- test command:`, a `- fast test command:` and a `- single test command:` line | e2e | A harness test command may name what to scope to |
| 9 | effective lines of `payload/templates/harness.md` (`countEffectiveLines`) ≤ `CAPS.harness` | unit | A harness test command may name what to scope to |
| 10 | `build.md` · contains B1 and B2, each once; lacks `the full test run belongs` | unit | A self-check and a red check run only their own tests |
| 11 | `contract.md` step 3 · contains C0, C1, C2, C3 once each, in that order; step 5 contains C5 once; lacks `Run the test command from` | unit | A self-check and a red check run only their own tests |
| 12 | `sdlc-builder.md` body · contains BA once (a parenthetical, so verbatim only); lacks `the full run belongs to verify` | unit | A self-check and a red check run only their own tests |
| 13 | `sdlc-contractor.md` body · contains CA and CB once each; lacks `Run the test command you are given:` | unit | A self-check and a red check run only their own tests |
| 14 | `init.md` step 3 · contains I1 once; lacks `fill tools, test command,` | unit | A harness test command may name what to scope to |

## Out of scope (explicitly untested + why)
- That an agent stops running the full suite during build and contract: not visible in the evaluator's input. `contract/evals.md` scores each verify round's note against its output and the diff; the rest stays doctrine.
- The final gate staying the full test command, and reuse from `scope=full`: unchanged text, already pinned by rows 7 and 10 of `tests/verify-gates.test.mjs`. Reuse is kept on purpose, see Assumptions in `change.md`.
- `journal.mjs` storing `reason=`: no code change; `note` keeps any `k=v` (`payload/hooks/journal.mjs:92-97`, read).
- Real runners (turbo, nx, vitest, jest): the seed names no tool, so there is no tool behavior to pin.
- A hook rejecting `scope=full` without a reason: not built, see Assumptions in `change.md`.
- Paraphrases of the old wording: the absent-literal checks catch only the literal. `verify.md`'s mutation rule covers the rest at verify.

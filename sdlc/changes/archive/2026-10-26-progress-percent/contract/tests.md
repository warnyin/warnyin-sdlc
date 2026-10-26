# Test contract — progress-percent
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

PROG = "Every progress update — a stage change, a wave started or finished, a task ticked — states the change's figure from `npx @warnyin/sdlc status`: `tasks <done>/<total> · <p>%`."
Tests go in `tests/progress-percent.test.mjs`; PROG is pinned with tests/rule-pins.mjs `assertSentence`.

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | `progressOf(text)`: new 10, contracted 25, verified 90, shipped 100 — each with tasks and with none; building swept over every total 1–12 and every done 0–total → `Math.round(25 + 50·done/total)` (spot: 1/4 → 38, 2/3 → 58, 1/8 → 31); building with no tasks → 25 | unit | Status gives each change one progress figure |
| 2 | Assumptions with `- [x] a`; `## Tasks` with `- [x] T1`, `- [X] T2`, `* [x] T3`, `  - [ ] sub`, a fenced `- [x] fake`; `## Tasks (fix 1)` with `- [ ] F1`; `## Notes` with `- [ ] later` and, under it, `### Tasks` with `- [x] h3` (a level-3 heading opens no section) · `{ done: 3, total: 5, percent: 55 }` | unit | Status gives each change one progress figure |
| 3 | row 2's text with CRLF line endings · same result | unit | Status gives each change one progress figure |
| 4 | a status outside the five (`bogus`), and a change.md with no frontmatter · `percent: null`, tasks still counted | unit | Status gives each change one progress figure |
| 5 | an init'd project with a standard change `building`, 2 of 4 ticked · `status` · its line is `half  [standard/building]  Title half · tasks 2/4 · 50%` | e2e | Status gives each change one progress figure |
| 6 | same · `status --json` · `progress: { done: 2, total: 4, percent: 50 }`, its first 8 keys are the existing ones (id, tier, status, title, blockedBy, spawnedFrom, parked, waitedOnBy) and `progress` is the 9th | e2e | Status gives each change one progress figure |
| 7 | a `new` change with no `## Tasks` · its status line ends `Title fresh · 10%`; JSON `progress: { done: 0, total: 0, percent: 10 }` | e2e | Status gives each change one progress figure |
| 8 | a change folder with no change.md, and one with status `bogus` · their status lines end at the title (no ` · `); JSON `progress.percent` is `null` | e2e | Status gives each change one progress figure |
| 9 | `payload/playbook/auto.md` contains PROG | unit | Every progress update states the figure |
| 10 | `payload/playbook/build.md` contains PROG | unit | Every progress update states the figure |
| 11 | `payload/playbook/next.md` contains PROG | unit | Every progress update states the figure |
| 12 | lib/progress.mjs · every static import, `import(` and `require(` names a `node:` module or a `./` sibling | unit | Status gives each change one progress figure |

## Out of scope (explicitly untested + why)
- Whether an agent actually states the figure — model behaviour; the contract pins what each reporting file tells it.
- auto.md's budget (CAPS.playbook.auto, 75) is enforced by the playbook-budgets test in the full suite; build.md and next.md have no line budget (lib/caps.mjs `playbook` keys: new, rulesCard, auto, autopilot).
- A mid-wave figure: waves are not in any file the CLI reads (change.md Assumptions).
- An unclosed fence hiding a later `## Tasks`: lib/fences.mjs's existing rule for every section reader, unchanged here.

# Test contract — deploy-runbook
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

"Deploy change" = a standard change folder with `lenses: [deploy@builtin]`, a valid Delta and,
from `contracted` on, a `contract/tests.md`. "Six sections" = `## Pre-checks`,
`## Config & Secrets`, `## Steps`, `## Migration order`, `## Verify`, `## Rollback`; a heading
counts when it is a level-2 heading outside ``` and ~~~ fences whose text, case-folded, is the
section name alone or followed by a space or `(` — `## Verification` does not count as Verify.

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | Given `lib/lenses.mjs` · when loaded · then `LENSES` sorted is `api, data, deploy, ux-ui`; a change recording `deploy@builtin` (status new) has no lens issue | unit | A deploy lens is chosen for changes that are hard to deploy |
| 2 | Given `payload/playbook/lenses.md` · when parsed · then `## Lens: deploy` has signals, ground, contributes, stages; its signals name migration, environment, and secret or flag; contributes names `runbook.md` and has a `contract —` bar, stages include `contract`; `CAPS.lensCatalog` is 70, quoted as `cap:70`, and the file is within it | unit | A deploy lens is chosen for changes that are hard to deploy |
| 3 | Given a deploy change with no `runbook.md` at each of `contracted`, `building`, `verified` · when `validate <id>` runs · then exit 1 and an error naming `runbook.md`; the same holds for `deploy@project:x` and `deploy@user:x` | int | A deploy change carries a runbook with fixed sections |
| 4 | Given a deploy change at status `new` with no `runbook.md` · when validated · then no runbook issue | unit | A deploy change carries a runbook with fixed sections |
| 5 | Given a contracted deploy change whose runbook has the six sections · when validated · then no runbook issue; for each section in turn, the same runbook without it gives an error naming that section | unit | A deploy change carries a runbook with fixed sections |
| 6 | Given a runbook whose `## Rollback` appears only inside a ``` fence, then only inside a ~~~ fence, then only as `### Rollback` · when validated · then each gives an error naming Rollback; `## Verification` in place of `## Verify` gives an error naming Verify | unit | A deploy change carries a runbook with fixed sections |
| 7 | Given headings `## pre-checks`, `## CONFIG & SECRETS`, `## Steps (dev → uat → prod)` and the other three · when validated · then no section error | unit | A deploy change carries a runbook with fixed sections |
| 8 | Given `CAPS.runbook` · then it is 60; a runbook of exactly 60 effective lines plus blank, comment and frontmatter lines has no cap error; one of 61 gives an error carrying `61` and `60` | unit | A deploy change carries a runbook with fixed sections |
| 9 | Given a contracted change with `lenses: [api@builtin]` and no `runbook.md`, one with no `lenses`, and an `api` change holding a runbook with only `## Steps` · when validated · then no runbook issue | unit | A deploy change carries a runbook with fixed sections |
| 10 | Given `payload/templates/runbook.md` · then it quotes `cap:N` with N = `CAPS.runbook` (also pinned in `caps-sync.test.mjs`), has all six sections, says secrets are named and never their values, names expand/contract and `IRREVERSIBLE`; a deploy change holding an unedited copy gets a placeholder error, and the copy with every `<…>` replaced has no runbook issue | unit | A deploy change carries a runbook with fixed sections |
| 11 | Given `init --tool claude` into a temp project · then `sdlc/.playbook/templates/runbook.md` exists | int | The runbook is written, reviewed and handed over by the stages |
| 12 | Given a verified deploy change with a valid runbook · when `archive <id>` runs · then exit 0 and the archived folder contains `runbook.md` | e2e | The runbook is written, reviewed and handed over by the stages |
| 13 | Given `payload/playbook/design.md` · then it names the `deploy` lens and says to write `runbook.md` from `templates/runbook.md` with secrets named, never valued | unit | The runbook is written, reviewed and handed over by the stages |
| 14 | Given `payload/playbook/review.md` and `payload/adapters/claude/agents/sdlc-ops.md` · then both name `runbook.md`; sdlc-ops checks every environment has steps, verify and rollback, and that no secret value appears | unit | The runbook is written, reviewed and handed over by the stages |
| 15 | Given `payload/playbook/ship.md` · then its digest step says to link `runbook.md` when the change has one | unit | The runbook is written, reviewed and handed over by the stages |
| 16 | Given `payload/playbook/new.md` · then it says a deploy signal without the `deploy` lens records one line in `## Assumptions` saying why | unit | The runbook is written, reviewed and handed over by the stages |
| 18 | Given `runbook.md` as a directory in a contracted deploy change · when `validateChange` runs · then it does not throw and returns an error naming `runbook.md` | unit | A deploy change carries a runbook with fixed sections |
| 19 | Given a verified deploy change with no `runbook.md` · when `archive <id>` runs · then exit non-zero, the change folder stays in place and no spec is written | e2e | A deploy change carries a runbook with fixed sections |
| 17 | Given the `sdlc-conventions` skill and `docs/design.md` · then the skill's lens list reads `<ux-ui|api|data|deploy>`, `runbook.md` in the layout and its cap 60; the ledger has a `runbook.md` row quoting 60 | unit | The runbook is written, reviewed and handed over by the stages |
| 20 | Given a deploy runbook with `<step>` on a Steps line · then an error names runbook.md and the placeholder; `<NAME>` only inside inline code, an HTML comment or a fence gives no placeholder error | unit | A deploy change carries a runbook with fixed sections |
| 21 | Given `runbook.md` as a symlink to a file outside the change holding the six sections · when validated · then an error says runbook.md must be a regular file (skip if links cannot be made) | unit | A deploy change carries a runbook with fixed sections |
| 22 | Given `lib/lenses.mjs` · then it exports `hasLens(lenses, name)` true for `deploy@user:x` in a list, false for a scalar or a missing list; `lib/validate.mjs` calls it | unit | A deploy change carries a runbook with fixed sections |

## Out of scope (explicitly untested + why)
- Whether the model chooses `deploy` on the right changes, or writes a useful runbook — judgment;
  the catalog text is pinned by row 2, quality is the ops reviewer's job.
- Detecting a secret value inside the runbook — no reliable pattern; doctrine only (Assumptions).
- A ```-opened fence closed by ~~~ (mixed fences): the fence helper is shared with grill.md; deferred (grill.md § Decisions).
- Runbook in an archived change is not re-validated: archive already ran `validate --strict`.

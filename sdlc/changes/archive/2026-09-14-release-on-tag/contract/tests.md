# Test contract — release-on-tag
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

A real publish needs GitHub and npm, so tests reach two things: the check script run
black-box (`GITHUB_REF_NAME` + npm version on stdin + a temp dir's `package.json` as cwd) and the workflow
files read as text. Workflow rows slice per job so a match in another job cannot satisfy them.

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | Given package.json version `0.10.0` · when release-check runs with tag `v0.10.0` and `11.5.1` on stdin · then exit 0 and stdout names `0.10.0` | int | A version tag publishes the tagged version |
| 2 | Given version `0.9.0` · when tag is `v0.10.0` · then exit ≠ 0 and stderr names both `0.10.0` and `0.9.0` | int | A release that does not check out publishes nothing |
| 3 | Given package.json version equal to the tag's digits · when tag is `v1.0.0-rc.1`, `vnext`, `0.9.0` (no v), `v0.9`, `V0.9.0`, `v0.9.0 `, `v0.9.0\n`, `v01.0.0` · then each exits ≠ 0 | int | A release that does not check out publishes nothing |
| 4 | Given any package.json · when `GITHUB_REF_NAME` is unset or empty · then exit ≠ 0 | int | A release that does not check out publishes nothing |
| 5 | Given version `1.2.3` · when tag is `v1.2.3$(touch pwned)` or `v1.2.3;touch pwned` · then exit ≠ 0 and no `pwned` file exists in the dir | int | A release that does not check out publishes nothing |
| 6 | Given a dir with no or unparsable package.json · when release-check runs · then exit ≠ 0 with a message, never a stack-only crash exit 0 | int | A release that does not check out publishes nothing |
| 7 | Given release.yml · when its `on:` is read · then the only trigger is `push` → `tags` with pattern `v[0-9]+.[0-9]+.[0-9]+`; no `branches`, `pull_request` or `workflow_dispatch` | unit | A version tag publishes the tagged version |
| 8 | Given ci.yml · when read · then it declares `workflow_call` and still triggers on push to `main` and `pull_request` (regression guard) | unit | A release that does not check out publishes nothing |
| 9 | Given release.yml · when jobs are read · then one job `uses: ./.github/workflows/ci.yml`, and the publish job `needs` that job | unit | A release that does not check out publishes nothing |
| 10 | Given the publish job · when read · then `npm --version \| node .github/scripts/release-check.mjs` comes before `npm publish --provenance --access public`; and neither release.yml nor ci.yml has `continue-on-error` or an `if:` using `always()`, `failure()` or `cancelled()` | unit | A release that does not check out publishes nothing |
| 11 | Given a matching tag · when stdin carries `11.5.0`, `10.9.9`, `garbage` or nothing · then exit ≠ 0 naming 11.5.1; `11.5.1`, `11.10.0`, `12.0.0` pass; and release.yml never runs `npm install -g`/`npm i -g` | int | Publishing holds no long-lived credential |
| 12 | Given release.yml and ci.yml · when read · then neither mentions `NPM_TOKEN`, `NODE_AUTH_TOKEN` or the word `secrets` (covers `secrets: inherit`) | unit | Publishing holds no long-lived credential |
| 13 | Given release.yml · when permissions are read · then workflow-level permissions are `contents: read` only, and `id-token: write` appears exactly once, inside the publish job | unit | Publishing holds no long-lived credential |
| 14 | Given release.yml · when every `run:` block is read · then none contains a `${{ github.` / `${{ inputs.` / `${{ env.` expression | unit | A release that does not check out publishes nothing |
| 15 | Given the publish job · when read · then `runs-on` is a GitHub-hosted `ubuntu-` label, not `self-hosted`, and its checkout sets `persist-credentials: false` | unit | Publishing holds no long-lived credential |
| 16 | Given `npm pack --dry-run --json` · when the file list is read · then no path starts with `.github/` | int | A version tag publishes the tagged version |
| 17 | Given README.md's release section · when read · then it names `release.yml`, trusted publisher, allowing `npm publish`, a `v*` tag ruleset, and `npm view` to confirm | unit | Publishing holds no long-lived credential |
| 18 | Given the publish job · when read · then checkout sets `fetch-depth: 0` and `git merge-base --is-ancestor "$GITHUB_SHA" origin/main` runs before `npm publish`; the check, ancestry and publish `run:` values are exactly those commands (no `\|\| true`) | unit | A release that does not check out publishes nothing |
| 19 | Given ci.yml · when read · then it has no `permissions:` granting more than `contents: read`, no job-level `if:`, and pack-verify's `node-version` equals the publish job's | unit | A release that does not check out publishes nothing |
| 20 | Given the publish job · when every `uses:` is read · then each is pinned to a 40-hex commit SHA | unit | Publishing holds no long-lived credential |

## Out of scope (explicitly untested + why)
- An actual publish, OIDC exchange and provenance attestation — need GitHub + npm; proven
  on the first tag push after the human registers the publisher (Task T5).
- YAML syntax/schema validity — no actionlint locally and no YAML parser allowed; GitHub
  rejects an invalid workflow on the first push, which publishes nothing.
- Re-publishing an existing version — npm refuses it itself; not our behavior.
- Who may push `v*` tags — a repository setting, documented (row 17); row 18 bounds it to main.
- Whether origin/main is fetched before the ancestry check runs — GitHub checkout behavior;
  a missing ref makes `git merge-base` exit non-zero, which fails closed.

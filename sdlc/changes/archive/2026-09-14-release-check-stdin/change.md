---
id: release-check-stdin
tier: vibe
status: shipped
---
# Change: release-check waits for piped npm version instead of reading an empty stdin
<!-- cap:40 · vibe tier = one file, no contract. Reversible, no behavior-contract change, ≤2 files. -->

## Why (≤3 lines)
The first tag release (v0.10.0, run 34864739246) failed closed: `fs.readFileSync(0)` returned
nothing while `npm --version` had not written yet, so the check saw npm `""`. Nothing was
published; the release-pipeline spec already requires this run to pass.

## Assumptions
- Vibe tier: a bug fix in `.github/scripts/release-check.mjs` + its test, no spec or credential
  change, reversible. Safe: the spec scenario "tag matches and checks pass" is unchanged.
- Re-releasing the same 0.10.0 is safe: npm never received it.

## Tasks
- [x] T1 Failing test: npm version arriving on a pipe after a delay passes the check
- [x] T2 Read stdin to EOF asynchronously; empty or TTY stdin still fails closed

## Receipt (filled at ship)
- files touched: `.github/scripts/release-check.mjs`, `tests/release-workflow.test.mjs` · test result: row 11b red (`npm ""`) then green; `npm test` 304/304; a real `sleep 0.5 | node` pipe passes · cost: shared session, not priced

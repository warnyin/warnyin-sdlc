---
id: windows-test-flakes
tier: vibe
status: shipped
---
# Change: Two test failures that only Windows sees

## Why (≤3 lines)
On Windows `npm test` is never green: the kimi rules-card test fails every run, and update-notice
rows 18/21 fail about 3 in 4. Both are test bugs, not product bugs. A red suite that is "always
red here" hides real regressions.

## Assumptions
- kimi: the installer normalizes EOL (`payloadText` → `normalizeEol`, `bin/cli.mjs:144-151`) while
  the test reads `rules-card.md` raw, which is CRLF on a Windows checkout (`file` says so). CI on
  Linux has LF and passes. Proven: the test fails every run here, on HEAD too.
- update-notice: the failure is `EPERM` from `fs.rmSync` in `makeTempProject`'s cleanup, while the
  detached `check-update.mjs` still holds the temp dir. Proven: the log of a failing full-file run
  shows it; rows 18/21 run alone pass 3/3. `project()` uses `makeTempProject` (verified
  `tests/update-notice.test.mjs:74`), so one retrying cleanup covers it.
- No behavior-contract change: only `tests/` files change, so no Delta and no contract (vibe).

## Tasks
- [x] T1 `tests/kimi-adapter.test.mjs`: compare the card after EOL normalization [P] [tier:cheap]
- [x] T2 `tests/helpers.mjs`: `rmSync` cleanup retries on EPERM/EBUSY (`maxRetries`, `retryDelay`) [P] [tier:cheap]

## Receipt (filled at ship)
- files touched: tests/kimi-adapter.test.mjs, tests/helpers.mjs · test result: npm test 593/0 on Windows; update-notice 5/5 runs · cost: see digest

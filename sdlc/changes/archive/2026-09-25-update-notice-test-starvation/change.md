---
id: update-notice-test-starvation
tier: vibe
status: shipped
spawned-from: [minimal-build]
---
# Change: update-notice tests stop starving their own registry stub
<!-- cap:40 · vibe tier = one file, no contract. Reversible, no behavior-contract change, ≤2 files. -->

## Why (≤3 lines)
`update-notice` rows 6/11 time out on Windows under full `npm test` (fails on clean HEAD too): the
registry stub lives in the test process, and concurrent tests' `spawnSync` init blocks its event
loop past the checker's 3 s fetch timeout, so `latest` is never cached.

## Assumptions
- Mechanism proven, not assumed: a scratch repro blocking the stub's loop 0 / 1.5 / 4 s after the
  hook → `latest` 0.10.0 / 0.10.0 / undefined (FETCH_TIMEOUT_MS = 3000, lib/update-notice.mjs:9).
- Class swept: `grep -lE 'createServer|\.listen\(' tests/*.mjs` → update-notice + security-regressions.
  security-regressions row 24 runs without file concurrency and waits only for the request to
  arrive, so nothing blocks its stub while it waits — not an instance.
- Test-only: no payload, lib or bin change, so no spec delta.

## Tasks
- [x] T1 `tests/update-notice.test.mjs`: every CLI run in the file goes through async `spawn`, so no
  test blocks the shared event loop the stub answers on; runs queued one at a time — all-parallel
  inits broke row 7's hook-vs-control timing (1477 vs 443 ms) in 2 of 5 full runs

## Receipt (filled at ship)
- files touched: tests/update-notice.test.mjs · test result: full `npm test` 4/4 green (624/624;
  before: 4/4 failed rows 6/11); file alone 9/10 — first run after the edit had 1 failure, output
  not kept, row unknown · cost: not journaled

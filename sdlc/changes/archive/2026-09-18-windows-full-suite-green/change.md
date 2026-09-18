---
id: windows-full-suite-green
tier: vibe
status: shipped
---
# Change: Stop `npm pack` failing on Windows; give the notice checker time to start
<!-- cap:40 · vibe tier = one file, no contract. Reversible, no behavior-contract change, ≤2 files. -->

## Why (≤3 lines)
On Windows `npm pack` could not be spawned (ENOENT), failing one row on every run; and the
update-notice tests gave a cold background checker 5 s. Both are fixed here. The rest of that
suite's Windows timing is split into its own deep change — this one does NOT make it green.

## Assumptions
- A 5 s positive wait was one cause of the update-notice flake, not the only one. Reproduced under
  load: widening it helped, but rows still fail because the checker's own 3 s fetch timeout gives
  up (as designed), a still-running child blocks cleanup (EPERM), and the hook's spawn exceeds the
  1 s latency bound. Those touch the hook or a product guarantee, so they are not this change's.
- Only `waitFor` — the positive waits — is widened; a broken checker still never writes, so it
  still fails. The hook-latency bound (`:108`) and the no-request windows are left as they were.
- `npm pack` runs as one fixed command string with `shell: true`, not an args array: Node 24
  raises DEP0190 for args-plus-shell. Every token is a literal, so no human text reaches a shell.
- This does not unblock `update-from-the-notice`'s held final gate (its T15); the deep change does.

## Tasks
- [x] T1 `tests/release-workflow.test.mjs:248` — spawn `npm pack --dry-run --json` as one string
  with `shell: true`, so Windows resolves `npm.cmd`
- [x] T2 `tests/update-notice.test.mjs:23` — raise `waitFor`'s default deadline so a cold node
  start under load still completes; leave every negative bound untouched
<!-- T1 fixes ENOENT for good. T2 helps but the suite stays red on Windows: 5 failures became 2-3. -->

## Receipt (filled at ship)
- files touched: `tests/release-workflow.test.mjs`, `tests/update-notice.test.mjs`
- test result: touched paths 44/44; full suite still red on Windows (2–3 update-notice rows), split out
- cost: not reliably known — the journal's figure double-counts cumulative session snapshots

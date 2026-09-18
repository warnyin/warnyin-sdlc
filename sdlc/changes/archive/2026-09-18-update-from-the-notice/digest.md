# Digest — update-from-the-notice (deep)
<!-- cap:15 -->

- **Shipped**: the update notice now opens a choice — apply now / see what changes / not now —
  via `sdlc/.playbook/update.md` and `/sdlc:update`; `changelog [--since]` (bounded, writes
  nothing); `update` reports written/kept/pruned and what it brought in; a self-update refusal.
  **Breaking**: `--force` now needs a TTY or `WARNYIN_SDLC_FORCE=1`.
- **Specs merged**: `update-notice` (1 MODIFIED, 2 ADDED; Purpose rewritten by hand at ship —
  `mergeDelta` never touches it), `cli-surface` (4 ADDED). No scenario dropped.
- **Verify**: fast gate 4 rounds (1 fail — no CHANGELOG entry; 3 pass), review 2 rounds
  (3 blockers → 0), all panel. **The full suite never ran before ship**: the final gate was
  skipped by the human, recorded `mode=solo` — the Windows suite is red for unrelated reasons.
  CI's Linux full suite gates the release instead. Deep-tier ship approved by the human.
- **Contract amended**: a stale pre-0.12.0 trajectory line and a false cost line; adversarial
  check reopened. **Cost unknown** — `lib/observe.mjs:64` double-counts session snapshots.
- **Learner, awaiting you**: add to `payload/playbook/contract.md` — check a rubric line copied
  from an archived change against current `build.md`/`verify.md` (evidence: verify round 4).

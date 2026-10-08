# Digest — fence-close-marker (standard, shipped 2026-10-08)
- Shipped: `linesOutsideFences` (lib/validate.mjs) follows CommonMark — a fence closes only on a bare line of its own character, at least as long as the opener. A ~~~ line quoted inside a ``` block no longer ends it, for grill.md and runbook.md alike.
- Spec merged: new `specs/fenced-code/spec.md` (1 requirement, 3 scenarios).
- Assumptions: an unclosed fence still runs to end of file (fails closed). Class sweep: the only code-fence reader in lib/bin/hooks/scripts is this helper.
- Verify: fast gate 1 round, full suite 651/651. The final gate reused that run (`reused=yes`) and was not repeated. Self-run (`mode=solo`). Review skipped: no signal.
- Spawned from deploy-runbook's deferred `deferred-mixed-fence` decision. Learner: no durable lesson. Freed / waiting: none.

# Digest — contractor-assertion-rules (2026-09-25, standard, attended; spawned from minimal-build)
- Shipped: `sdlc-contractor.md` now says: check each red test fails for its own row's reason (read the failure message); bound a text section by splitting lines to the next heading/step, never an end anchor (regex `$`) that ends at the first line in multiline mode; assert the row's literal tokens, order and polarity, not wide gap patterns. Applies the two learner proposals from minimal-build's digest, at the human's request.
- Spec merged: new capability `test-contract` — 2 ADDED requirements. No MODIFIED/REMOVED.
- Scope: `sdlc-contractor.md` only; `contract.md` step 3 (tools without subagents) unchanged, by the human's scope.
- Contract: 5 rows; tests written in-session, not by the contractor; rows 1–3 and 5 red for their own reason, row 4 a guard on existing rules. No adversarial panel ran — self-checked (solo).
- Verify: 1 round. Fast gate scoped (44/44). Final gate: full suite ran, run chosen by the human — 622/624; `update-notice` rows 6/11 timed out on the detached check, pre-existing on clean HEAD; the human accepted it as an env failure (escalation `final-gate-env-failures`, preauth=no). Self-produced (`mode=solo`): both verify notes.
- Learner: not run separately — this change is itself the learner's output from minimal-build.
- Follow-up: the `update-notice` timeout flake on Windows under full-suite load.
- Cost: not journaled. Freed/waiting changes: none.

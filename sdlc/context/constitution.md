# Constitution — @warnyin/sdlc
<!-- cap:30 · ALWAYS LOADED: every line here costs tokens in EVERY turn. Prove residency or move it to steering. -->

## Stack (facts only, max 3 lines)
- Node >= 20, ESM (.mjs), zero runtime dependencies — `node:*` modules only.
- Payload (playbook/templates/adapters/hooks) is English; parser keys are frozen English.

## Hard rules (SHALL / SHALL NOT only — no advice)
- The agent SHALL NOT edit `sdlc/specs/**` or `sdlc/changes/archive/**` outside `/sdlc:ship`.
- The agent SHALL record every assumption in the change's `## Assumptions` before acting on it,
  and SHALL prove by running it any assumption that removes work ("already covered",
  "unchanged", "harmless") — or record it `[UNVERIFIED]`.
- Every behavior change SHALL update BOTH the payload source and its tests in the same change.
- Caps SHALL change only in `lib/caps.mjs` + template comments together (caps-sync test).
- The agent SHALL NOT add npm dependencies.
- Human-written text SHALL NOT reach a shell as an argument — pass it on stdin, or
  author a constrained substitute (see `feedback-channel`).

## Workflow
- Changes flow: new → [design] → contract → build → verify (fast) → [review] → verify (final) → ship.
- Tier by stakes: vibe | standard | deep — triage table lives in `sdlc/harness.md`.

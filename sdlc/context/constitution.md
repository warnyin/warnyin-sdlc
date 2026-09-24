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
- The agent SHALL NOT report a defect class fixed, or a pattern unified, on the instances a
  report named — the class SHALL first be enumerated by a command over the whole tree, and that
  command and what it returned SHALL appear in what the human reads.
- A free-text value that decides whether an escalation or a human's refusal applies SHALL be read
  in canonical form (trimmed, case-folded) against a closed set; anything outside it SHALL fail closed.
- Every behavior change SHALL update BOTH the payload source and its tests in the same change.
- A Delta that states playbook or template prose SHALL name the file carrying it, and every file
  stating that rule SHALL have its own contract row.
- Caps SHALL change only in `lib/caps.mjs` + template comments together (caps-sync test).
- The agent SHALL NOT add npm dependencies.
- Human-written text SHALL NOT reach a shell as an argument — pass it on stdin, or
  author a constrained substitute (see `feedback-channel`).

## Workflow
- Changes flow: new → [design] → contract → build → verify (fast) → [review] → verify (final) → ship.
- Tier by stakes: vibe | standard | deep — triage table lives in `sdlc/harness.md`.

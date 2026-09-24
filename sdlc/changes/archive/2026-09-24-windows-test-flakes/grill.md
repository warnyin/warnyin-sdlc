# Grill — windows-test-flakes
<!-- cap:80 covers everything but § Decisions — that section is uncapped, one bullet per
     decision the agent took alone, so it can never deadlock against the mandate's cap ·
     written once by /sdlc:autopilot after the human confirms; the change's operating model. -->

## Delegation
- Delegated by: rujiroj.ta · 2026-09-24
- Covers: this run only — windows-test-flakes, resumed runs re-ask this section

## Priorities
1. requirement
2. quality/standards
3. time
4. cost

## Mandate
- May decide alone: clarification, verify-rounds-exceeded, review-blockers, ship-approval, final-gate, token-budget, cap-pin-exceeded, final-gate-env-failures, hardfloor-midrun
- Refused (stops the run): none

### Hard floors
- irreversible: approved

### Scope
- A1 kimi rules-card test normalizes EOL: `file payload/playbook/rules-card.md` → CRLF; `bin/cli.mjs:144-151` normalizes before install; fails every run on HEAD
- A2 temp cleanup retries: failing full-file run logs `EPERM ... Temp\wsdlc-vvo7Sb` on rmSync; rows 18/21 alone pass 3/3; HEAD fails 3/4
- B README "retune model routing" section for pre-0.21.0 installs: no command — follows the model-routing spec (nothing asks the human to add the table)
- C constitution rule (Delta naming playbook prose names its file) + harness rule (every contract row runs before the fast gate): learner proposals in `sdlc/changes/archive/2026-09-24-stage-model-routing/digest.md`
- D release 0.21.1: CHANGELOG, commit, push, tag `v0.21.1`, npm publish via CI only after CI passes

## Decisions

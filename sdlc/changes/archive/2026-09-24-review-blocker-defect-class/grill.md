# Grill — review-blocker-defect-class
<!-- cap:80 covers everything but § Decisions — that section is uncapped, one bullet per
     decision the agent took alone, so it can never deadlock against the mandate's cap ·
     written once by /sdlc:autopilot after the human confirms; the change's operating model. -->

## Delegation
- Delegated by: rujiroj.ta · 2026-09-24
- Covers: this run only — review-blocker-defect-class, resumed runs re-ask this section

## Priorities
1. requirement
2. quality/standards
3. time
4. cost

## Mandate
- May decide alone: clarification, review-blockers, final-gate, ship-approval, final-gate-env-failures, hardfloor-midrun
- Refused (stops the run): verify-rounds-exceeded, token-budget, cap-pin-exceeded

### Hard floors

### Scope
- reviewer format in four agents: `grep -rln "blocker|improvement|note" payload lib bin` → sdlc-{architect,ops,quality,security}.md only
- no class rule in payload today: `grep -rn -iE "class|enumerat|whole tree|same (root|class)"` over review/verify/build/principles + agents → only review.md:25 "Classify"
- the loop is real: journal grep over archive → autopilot 4→3→1→1→1→0, verify-fast-final-gates 4→1→1→1→0
- out of scope: review Run-when signals, the shared 3-round budget, prior rounds to the panel, blocker severity

## Decisions
- final-gate · options: run/skip · chose: run · priority: quality · reversible: yes · hard-floor: no · recover: re-run npm test

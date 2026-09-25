# Grill — minimal-build
<!-- cap:80 covers everything but § Decisions — that section is uncapped, one bullet per
     decision the agent took alone, so it can never deadlock against the mandate's cap ·
     written once by /sdlc:autopilot after the human confirms; the change's operating model. -->

## Delegation
- Delegated by: rujiroj.ta · 2026-09-25
- Covers: this run only — minimal-build, resumed runs re-ask this section

## Priorities
1. requirement
2. quality/standards
3. time
4. cost

## Mandate
- May decide alone: clarification, verify-rounds-exceeded, review-blockers, ship-approval, final-gate, token-budget, cap-pin-exceeded, final-gate-env-failures, hardfloor-midrun
- Refused (stops the run):

### Hard floors

### Scope
- ladder unread by builders: `grep -rln principles payload` → payload/playbook/README.md only; `grep -niE 'minimal|principle'` build.md + sdlc-builder.md → none
- quality review today: sdlc-quality.md:10-11 "flag dead code and untested branches" only
- evals template: contract-evals.md Quality line is `<change-specific bars>`, cap:40
- no spec covers it: `grep -rniE "minimal|stdlib|yagni|over-?build" sdlc/specs` → none
- no content test on principles.md: `grep -rn "principles.md|Minimalism" tests` → update.test.mjs ownership fixture only
- ladder single-sourced in principles.md; over-build findings always improvement; evals line covers changes review skips
- out of scope: rules-card.md, constitution, "one check" rule, debt markers, intensity levels, persona

## Decisions
- final-gate-env-failures · options: pass-with-record/stop · chose: pass-with-record · priority: quality · reversible: yes · hard-floor: no · recover: re-run npm test; update-notice rows 6/11 time out waiting on the detached check under full-suite load — alone 3/3 green, and clean HEAD worktree fails row 6 too (609/610), this change touches no lib/bin/hooks
- final-gate · options: run/skip · chose: run · priority: quality · reversible: yes · hard-floor: no · recover: re-run npm test

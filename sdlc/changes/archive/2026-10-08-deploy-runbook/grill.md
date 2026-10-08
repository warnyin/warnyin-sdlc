# Grill — deploy-runbook
<!-- cap:80 covers everything but § Decisions — that section is uncapped, one bullet per
     decision the agent took alone, so it can never deadlock against the mandate's cap ·
     written once by /sdlc:autopilot after the human confirms; the change's operating model. -->

## Delegation
- Delegated by: rujiroj.ta · 2026-10-08
- Covers: this run only — deploy-runbook, resumed runs re-ask this section

## Priorities
1. requirement
2. quality/standards
3. time
4. cost

## Mandate
- May decide alone: clarification, verify-rounds-exceeded, review-blockers, final-gate, ship-approval, token-budget, cap-pin-exceeded, final-gate-env-failures, hardfloor-midrun
- Refused (stops the run): none

### Hard floors
<!-- none foreseen up front; hardfloor-midrun is delegated -->

### Scope
- deploy lens + runbook artifact: `grep -rli runbook payload lib bin docs sdlc/specs` → no matches
- catalog cap must rise: `countEffectiveLines(lenses.md)` → 56 of 60
- git: commit on branch feat/deploy-lens-runbook, no push

## Decisions
- review-blockers · options: fix-and-continue/stop · chose: fix-and-continue (deploy lens gets contract bars + `contract` stage; also: placeholders rejected, symlink/non-file runbook refused, `hasLens` helper, checks gated on the lens, template per-env numbering + expand/contract + irreversible marks) · priority: quality · reversible: yes · hard-floor: no · recover: revert the R1 commit hunk
- deferred-mixed-fence · options: fix-shared-fence-helper/defer · chose: defer (helper is shared with grill.md validation; a mixed ```/~~~ fence is a pre-existing class, out of this change's scope) · priority: requirement · reversible: yes · hard-floor: no · recover: follow-up change on linesOutsideFences

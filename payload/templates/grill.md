# Grill — <change-id>
<!-- cap:80 covers everything but § Decisions — that section is uncapped, one bullet per
     decision the agent took alone, so it can never deadlock against the mandate's cap ·
     written once by /sdlc:autopilot after the human confirms; the change's operating model. -->

## Delegation
- Delegated by: <name> · <date>
- Covers: this run only — <change-id>, resumed runs re-ask this section

## Priorities
1. requirement
2. quality/standards
3. time
4. cost
<!-- confirmed order, or the human's stated override -->

## Mandate
<!-- one fixed token per auto.md escalation row, plus the mid-run hard-floor item — list each
     under exactly one of the two lines, comma-separated; journal the SAME token as `condition=`:
     clarification · verify-rounds-exceeded · review-blockers · ship-approval · final-gate ·
     token-budget · hardfloor-midrun — and the two auto cannot pre-approve: cap-pin-exceeded ·
     final-gate-env-failures. Refusing hardfloor-midrun refuses every hardfloor=yes decision.
     Coin a new token only for a condition nobody foresaw. -->
- May decide alone: <tokens, e.g. clarification, verify-rounds-exceeded, final-gate>
- Refused (stops the run): <tokens the human declined to delegate, e.g. hardfloor-midrun>

### Hard floors
<!-- allowlist: exactly `- <surface-token>: approved`, one per surface the human APPROVED up front
     (security, payments, data-loss, irreversible, or as harness.md defines). A decision on it journals
     `hardfloor=approved surface=<surface-token>`. A declined surface goes on the Refused line as a
     token — anything else here is a strict error, because only the Refused line is enforced. -->
- <surface-token>: approved

### Scope
- <item>: <evidence command that confirms it>

## Decisions
<!-- uncapped — outside the cap above. One bullet per decision, leading with the same kebab
     token journaled as `condition=` (validate matches them by that token):
     - <condition-token> · options: a/b · chose: x · priority: <p> · reversible: yes/no · hard-floor: yes/no · recover: <how> -->

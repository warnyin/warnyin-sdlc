# Test contract — new-md-budget-constant
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | Given `lib/caps.mjs` · then `CAPS.playbook` is frozen with keys new, rulesCard, auto, autopilot, all and `CAPS.commandStub` positive integers, and each of new.md, rules-card.md, auto.md, autopilot.md is within its value | unit | Payload line budgets have one source |
| 2 | Given every `tests/*.mjs` · when scanned for `lines <= <digits>`, `countEffectiveLines(…) <= <digits>`, `….filter(…).length <= <digits>`, `lines.length <= <digits>` or `const …Cap = <digits>` · then no match; a string's `.length` (character cap) is not a line budget | unit | Payload line budgets have one source |

## Out of scope (explicitly untested + why)
- Character caps on park reasons (change-parking ≤200/≤250) — output length, not a file budget.

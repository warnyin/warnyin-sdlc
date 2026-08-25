# Test contract — cost-cachewrite
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | Given a model priced with a cache-write rate · when a session that used cache-write tokens is costed · then the cost includes that class | unit | Every token class the parser counts can be priced |
| 2 | Given a model priced without a cache-write rate · when the same session is costed · then a cost is still returned and the cache-write class contributes nothing | unit | Every token class the parser counts can be priced |
| 3 | Given a session with no cache-write tokens · when it is costed · then the figure is unchanged from before this change — the existing 0.051 fixture still holds | int | Every token class the parser counts can be priced |
| 4 | Given the documented price contract in the module header · when read · then it lists cache-write alongside the other classes | unit | Every token class the parser counts can be priced |
| 5 | Given an unpriced model · when it is costed · then the result is still null — pricing one class must not make an unknown model look known | unit | Every token class the parser counts can be priced |

## Out of scope (explicitly untested + why)
- Backfilling costs already written to journals — the change is explicitly not retroactive.
- Whether 3.75 is the correct market rate for sonnet cache writes — that is a fact about a price list, not about this code; the code's job is to use whatever the table says.

# Test contract — scope-evidence
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

What a test can reach here is what `auto.md` REQUIRES, not what a run then does — the
confirmation is produced at runtime. Rows assert the doctrine carries each rule; the
rubric in `contract/evals.md` covers whether a run honours it.

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | Given auto.md · when the Confirm section is read · then it requires the command that established the scope AND that command's output, not the resulting list alone | unit | A confirmed scope carries the evidence that produced it |
| 2 | Given auto.md · when read · then evidence is required per scope item, so one approval cannot cover several separate derivations — and the requirement itself says so, not only the design note, since Design does not merge into the living spec | unit | A confirmed scope carries the evidence that produced it |
| 3 | Given auto.md · when read · then a scope resting on no command must be declared as such rather than presented as derived | unit | A confirmed scope carries the evidence that produced it |
| 4 | Given auto.md · when read · then a paraphrase of what a search found does not satisfy the evidence rule — the output itself is required | unit | A confirmed scope carries the evidence that produced it |
| 5 | Given auto.md · when read · then evidence searching a name the request did not name must be flagged on the item it produced | unit | Evidence that does not match the request is flagged |
| 6 | Given auto.md · when read · then narrowing the candidate set by an unrequested property (naming convention, folder pattern) must appear as its own refusable item | unit | Evidence that does not match the request is flagged |
| 7 | Given auto.md · when read · then an exclusion made on an empty search result must name the pattern searched | unit | An exclusion on an empty result names what was searched |
| 8 | Given auto.md · when read · then an empty result is described as a claim carrying evidence, never as an established absence | unit | An exclusion on an empty result names what was searched |
| 9 | Given auto.md · when the Confirm section is read · then the existing per-item refusability rule still stands alongside the new evidence rules — regression guard, green before implementation by design | unit | A confirmed scope carries the evidence that produced it |
| 10 | Given auto.md · when its effective line count is measured · then it is at most 75 — pinned just above today's 68 on purpose, so the next addition is a decision someone makes rather than drift nobody sees | unit | A confirmed scope carries the evidence that produced it |
| 11 | Given the shipped `unattended-run` spec · when read after this change merges · then the three new requirements are present and the four existing ones are untouched | unit | Evidence that does not match the request is flagged |

## Out of scope (explicitly untested + why)
- Whether a real run actually shows its evidence — that is model behaviour under a live pipeline; `contract/evals.md` scores it and the journal records what happened. Asserting it here would need an LLM in the test suite.
- The exact wording of the evidence block — the prior contract already ruled that asserting on prose freezes it; a frozen sentence is satisfiable by pasting it without deriving anything.
- Whether the evidence a run shows is TRUE — no test can distinguish a real command output from a fabricated one; that is what showing the command to a human is for.

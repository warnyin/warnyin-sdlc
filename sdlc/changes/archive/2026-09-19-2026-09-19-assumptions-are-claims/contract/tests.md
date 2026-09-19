# Test contract — assumptions-are-claims
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Doctrine rows assert on what the playbook text REQUIRES, never on a source file merely
containing a word. Install rows spawn the real CLI into `mkdtemp` and read what landed, so the
rule is proven to reach a project rather than only to exist in `payload/`.

| # | Given / When / Then | Kind | Maps to requirement |
|---|---|---|---|
| 1 | Given `payload/playbook/new.md` · when read · then step 5 requires an assumption that removes work to be run and proven, or marked unverified, and names the kind of claim it means (already covered / unchanged / harmless / pre-existing) | unit | What can be looked up is never assumed either |
| 2 | Given `payload/playbook/new.md` · when its effective lines are counted · then it is within the raised budget of 46, and both tests that pin it assert the same raised number | unit | What can be looked up is never assumed either |
| 3 | Given `payload/playbook/contract.md` · when read · then an out-of-scope line resting on how the code already behaves must cite the check that proved it or be marked unverified | unit | What can be looked up is never assumed either |
| 4 | Given `payload/playbook/review.md` · when read · then the panel is directed at unverified scope-narrowing claims first | unit | What can be looked up is never assumed either |
| 5 | Given `payload/playbook/rules-card.md` · when read · then it carries the verify-or-mark rule, and the card is still within its 40-line budget | unit | What can be looked up is never assumed either |
| 6 | Given the three change templates (`change-vibe.md`, `change-standard.md`, `change-deep.md`) · when read · then each one's Assumptions placeholder tells the author to verify a work-removing assumption or mark it unverified | unit | What can be looked up is never assumed either |
| 7 | Given a fresh `init --tool claude` · when the installed `sdlc/.playbook/new.md` and templates are read · then they carry the rule — it reaches a real project, not just `payload/` | int | What can be looked up is never assumed either |
| 8 | Given a fresh `init --tool cursor` (a tool with no hooks, whose only enforcement is the card) · when `.cursor/rules/sdlc.mdc` is read · then it carries the verify-or-mark rule | int | What can be looked up is never assumed either |

## Out of scope (explicitly untested + why)
- Whether an agent actually obeys the rule in a live session — judgement, not a deterministic
  assertion; `evals.md` scores it for this change's own trajectory instead.
- The wording of `[UNVERIFIED]` as a literal token — rows 1/3 pin the REQUIREMENT (verify or
  mark), not a spelling, so the doctrine can phrase the marker as it likes.
- Every other pinned playbook budget — only `new.md`'s moves here, and row 2 pins that both of
  its assertions move together. Checked, not assumed: `grep` shows exactly two tests assert it.

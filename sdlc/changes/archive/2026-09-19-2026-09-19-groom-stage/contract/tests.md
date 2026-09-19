# Test contract — groom-stage
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Doctrine rows assert what the playbook REQUIRES, never that a file contains a word. Windows are
kept tight: this repo has twice shipped a row that passed because a regex matched an unrelated
sentence far away.

| # | Given / When / Then | Kind | Maps to requirement |
|---|---|---|---|
| 1 | Given `payload/playbook/groom.md` · when read · then it requires the questions to be about the problem — what breaks today, what done looks like, what must not change, the cheapest acceptable outcome — and says the human's proposed solution is evidence of the problem, not the scope | unit | A change can be groomed before it is opened |
| 2 | Given it · when read · then it requires anything destined for the change's Assumptions to be run and proven first, pointing at the rule `new.md` already carries | unit | A change can be groomed before it is opened |
| 3 | Given it · when read · then it requires two or more shapes with the cheapest acceptable one first and marked recommended, and names "do not build it" as a legitimate outcome | unit | A change can be groomed before it is opened |
| 4 | Given it · when read · then it states that grooming writes no artifact of its own and that its result is what `/sdlc:new` opens with | unit | A change can be groomed before it is opened |
| 5 | Given it · when read · then it is optional — it says when to skip — and it hands off to `/sdlc:new` | unit | A change can be groomed before it is opened |
| 6 | Given the Claude stub for the stage · when read · then it names `sdlc/.playbook/groom.md`, carries a description, and is ≤15 non-blank lines like every other stub | unit | A change can be groomed before it is opened |
| 7 | Given a fresh `init --tool kimi` · when `.kimi-code/skills/` is read · then `sdlc-groom/SKILL.md` is there, rendered by the same path as every other stage — the 0.16.0 single-source design proving itself on the first stage added since | int | A change can be groomed before it is opened |
| 8 | Given a fresh `init --tool claude` · when the installed playbook and commands are read · then `sdlc/.playbook/groom.md` and the `/sdlc:groom` command both landed | int | A change can be groomed before it is opened |
| 9 | Given the playbook `README.md` and `next.md` · when read · then the stage table lists grooming, and `next` offers it when nothing is active | unit | A change can be groomed before it is opened |
| 10 | Given `payload/playbook/rules-card.md` and `payload/templates/constitution.md` · when their effective lines are counted · then neither grew — grooming precedes a change, so the always-loaded flow line is untouched | unit | A change can be groomed before it is opened |

## Out of scope (explicitly untested + why)
- Whether a groomed change actually turns out better than an ungroomed one — judgement over many
  changes, not a deterministic assertion. `/sdlc:observe`'s first-pass rate is where that would
  eventually show.
- The wording of individual questions — rows 1–3 pin the obligations, not a script, so the stage
  can phrase them for the situation.
- That `new.md` is unchanged. Checked, not assumed: this change adds a stage before it and edits
  no existing stage doctrine except `next.md`'s routing line.

# Test contract — anti-loop-rules
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Pinned as EXACT sentences (a `RULES` table in the test, compared after whitespace collapse, inside a non-empty anchor) — the rule this change adds. Sentences, verbatim:
- **A** (contractor + SKILL): `A row that pins a rule written in prose asserts it as one exact sentence, whitespace collapsed, inside a non-empty anchor, and pins known contradicting wording absent as literal text; it never uses a regex over the rule's meaning.`
- **B fragment** (review.md as it is today, plus the four reviewers): `a blocker is raised only for a previous blocker not closed, a defect the fix diff causes, or a security, data-loss or contract defect wherever it is; anything else is an improvement`
- **B agent** (each reviewer): `In a repeated panel, when you are briefed with the previous blockers and the fix diff, ` + B fragment + `.` — one line, wrapped only at spaces (never inside "data-loss").
- **C** (sdlc-security): `A repeated panel never narrows what you check: a vulnerability in any code is a blocker.`

Anchors: `sdlc-contractor.md` and the reviewer agent files — body after frontmatter; `contract-writing/SKILL.md` — its `## contract/tests.md` section.

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | Given `sdlc-contractor.md` body · then it contains rule A verbatim | unit | A prose rule is pinned as an exact sentence |
| 2 | Given `contract-writing/SKILL.md` § `contract/tests.md` · then it contains rule A verbatim | unit | A prose rule is pinned as an exact sentence |
| 3 | Given every `.md` under `payload/` · then rule A appears in exactly `sdlc-contractor.md` and `contract-writing/SKILL.md` (no drift, no third copy) | unit | A prose rule is pinned as an exact sentence |
| 4 | (scenario "a reviewer in a repeated panel finds an old non-security issue") Given `sdlc-architect.md` body · then it contains rule B agent verbatim | unit | Every reviewer applies the repeated-panel scope itself |
| 5 | (scenario "a reviewer in a repeated panel finds an old non-security issue"; with row 9, "a late-found vulnerability in untouched code") Given `sdlc-security.md` body · then it contains rule B agent verbatim | unit | Every reviewer applies the repeated-panel scope itself |
| 6 | (scenario "a reviewer in a repeated panel finds an old non-security issue") Given `sdlc-quality.md` body · then it contains rule B agent verbatim | unit | Every reviewer applies the repeated-panel scope itself |
| 7 | (scenario "a reviewer in a repeated panel finds an old non-security issue") Given `sdlc-ops.md` body · then it contains rule B agent verbatim | unit | Every reviewer applies the repeated-panel scope itself |
| 8 | Given every `.md` under `payload/` · then the B fragment appears in exactly `review.md`, `sdlc-architect.md`, `sdlc-security.md`, `sdlc-quality.md`, `sdlc-ops.md` (one wording, five files) | unit | Every reviewer applies the repeated-panel scope itself |
| 9 | (scenario "a late-found vulnerability in untouched code") Given `sdlc-security.md` body · then it contains rule C verbatim | unit | A repeated panel never narrows the security review |
| 10 | Given the payload · when `tests/contractor-assertion-rules.test.mjs`, `tests/review-blocker-class.test.mjs`, `tests/minimal-build.test.mjs`, `tests/payload.test.mjs`, `tests/playbook-budgets.test.mjs` and `tests/gate-moving-target.test.mjs` run unchanged · then they pass (the return-format lines, class/sweep/hits text and the existing "literal tokens, order and polarity" rule are intact) | int | (guard — no existing doctrine regresses) |

## Out of scope (explicitly untested + why)
- No other payload file tells how to pin or assert prose: Grep `literal tokens|wide gap patterns|assert the row|polarity` over `payload/` over `payload/` hits only `sdlc-contractor.md`; Grep `a defect the fix diff causes` over `payload/` hits only `review.md` today — row 3 and row 8 make both counts permanent.
- Whether a live contractor or reviewer obeys — judgment; the contract pins the doctrine text. That covers the contractor scenario ("a touched line below the bar fails the round") and a reviewer actually reporting an old issue as an improvement.
- "contract defect" and "fix diff" are defined once, in verify.md; a reviewer reading only its agent file does not see them, and a repeated panel's fix-diff baseline (since the previous review note) is unstated — both open in the gate-moving-target digest, not fixed here.
- A sentence that contradicts rule A, B or C added beside it, and text appended after it (substring match) — the known limit of exact-sentence pins; the gate-moving-target digest records it.
- The learner proposals (verify.md mutant rule, review.md skipped-review rule), evaluator bundle, rubric fixed across rounds — groomed out in change.md.

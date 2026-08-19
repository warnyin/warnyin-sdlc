# Design record — why each artifact exists (the anti-garbage ledger)

Every mandatory artifact must justify its token residency. This ledger is the
contract; if an artifact loses its reason, delete it.

| Artifact | Cap | Exists because | Restates nothing because |
|---|---|---|---|
| `context/constitution.md` | 30 | Day-1: static context is expensive → dense, high-signal payload only | stack facts ≤3 lines; scoped knowledge lives in steering |
| `context/steering/*.md` | 40 ea, always-budget 60 | Kiro inclusion modes = the static/dynamic boundary made literal | loaded by glob pointer/manual/agent only |
| `harness.md` | 60 | Day-1: "Requirements = configure the harness"; routing is the cost lever | registry + tables; enforcement is hooks, doctrine is playbook |
| `changes/<id>/change.md` | 40/100/150 by tier | the unit of work; collapses proposal+design+tasks into ONE file (kills multi-file residency) | Delta sections ARE the spec change, merged mechanically at ship |
| `contract/tests.md` | 60 | Day-1: tests before code = deterministic half of the contract | plan table, not prose; scenarios stay in the Delta |
| `contract/evals.md` | 40 | Day-1: evals verify trajectory/quality (the non-deterministic half) | rubric only; scored by a cheap agent |
| `specs/<cap>/spec.md` | soft 150 | living truth for regeneration + maintenance (converge) | behavior only; no narrative, no design |
| `journal.ndjson` | — | Day-1: observe the harness (cost, drift, audit) | machine-only; never loaded into context |
| `archive digest.md` | 15 | the async human touchpoint of exception-only HITL | summarizes; links, doesn't copy |

## Key decisions

- **OpenSpec-style install** (user decision): one npm CLI, no Claude plugin/marketplace in
  v1. Hooks are merged into project `.claude/settings.json`, marked by the
  `sdlc/.hooks/` path so update/prune never touch user hooks.
- **AI-driven, exception-only HITL** (user decision): approval gates were replaced by
  adversarial agent checks + validator + autonomy policy. Humans: init approval,
  policy-listed escalations, async digests.
- **Fixed always-budget (60 lines)** makes "learning = distilling" structural: the
  learner can only add an always rule by displacing one.
- **Parser keys are frozen English** (`ADDED/MODIFIED/REMOVED`, `WHEN/THEN`, statuses,
  frontmatter) so validators/merge/hooks stay language-independent; prose could be
  localized later without touching code.
- **Hooks are the ceiling, the validator is the floor**: non-Claude tools get the same
  rules as prose (rules-card embedded in their config) + `npx @warnyin/sdlc validate`.
- **All-or-nothing archive**: every delta merge is computed before anything is written;
  a missing MODIFIED/REMOVED key aborts the whole ship.
- **caps.mjs is canonical**: templates quote caps in comments; `caps-sync.test.mjs`
  fails the build on drift.

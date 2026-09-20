---
id: <kebab-id>
tier: standard
status: new
---
# Change: <title>
<!-- cap:100 · standard tier. Delta sections ARE the spec change — merged mechanically at ship, never re-narrated. -->

<!-- optional frontmatter: blocked-by: [id] (this change waits on it) · spawned-from: [id] · parked: "reason" (written only by `journal.mjs park`, never by hand) -->

## Why (≤5 lines)
<problem + outcome. No solutioning.>

## Assumptions
- <assumption made instead of asking, with the reason it is safe — delete section if none>
<!-- one that removes work ("already covered", "unchanged", "harmless") is a claim about the code: run it and prove it, or mark it [UNVERIFIED] -->
<!-- unresolved ambiguity the agent cannot assume → [NEEDS CLARIFICATION: question] inline where it bites -->

## Delta: <capability>

### ADDED Requirement: <name>
The system SHALL <behavior>.

#### Scenario: <name>
- WHEN <condition>
- THEN <observable outcome>

## Tasks
<!-- [P] = parallelizable wave · [tier:cheap|balanced|deepest] per the routing table in harness.md -->
- [ ] T1 <task> [P] [tier:balanced]
- [ ] T2 <task> [tier:cheap]

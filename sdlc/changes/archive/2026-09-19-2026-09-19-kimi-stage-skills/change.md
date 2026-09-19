---
id: 2026-09-19-kimi-stage-skills
tier: deep
status: shipped
---
# Change: Kimi Code gets a skill per stage, rendered from the Claude stubs
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
A Kimi user has to type "read sdlc/.playbook/new.md and do it" for every stage, while Claude Code
users type `/sdlc:new`. Kimi has the equivalent — a skill at `.kimi-code/skills/<name>/SKILL.md`
invoked as `/skill:<name> <args>` — and the stub it needs is the Claude stub with one frontmatter
key changed. 0.14.0 skipped this for a reason that was wrong: skills were swept up in "Kimi's
hook payload is unverified", when a skill is plain markdown that needs no payload knowledge.

## Assumptions
- Verified, not assumed (re-fetched from Kimi's skills doc this session): project skills live at
  `.kimi-code/skills/`, directory form is `<name>/SKILL.md`, `name` and `description` are
  required, `$ARGUMENTS` expands in the body, and `disableModelInvocation` blocks automatic
  firing. Invocation is `/skill:<name> <args>`.
- Verified by running `isPrunablePath('.kimi-code/skills/sdlc-new/SKILL.md')` → **false** today.
  So prune scope must be extended in this change; leaving it is the exact orphan bug shipped and
  fixed earlier this week. Not deferred, not assumed harmless.
- Verified by reading all 15 stubs: every one carries exactly one `description:` and names a
  playbook file that exists. So rendering from them is safe for the whole set, not just a sample.
- Kimi subagents (`.kimi-code/agents/`) stay out of scope, and the reason is specific this time:
  their dispatch semantics are unverified against a live session. That is true of agents and was
  never true of skills.

## Delta: tool-adapters

### ADDED Requirement: Kimi Code carries one skill per stage, rendered from a single source
The system SHALL install, for a project that selects Kimi Code, one skill per stage the Claude
adapter exposes, at `.kimi-code/skills/sdlc-<stage>/SKILL.md`, invocable as `/skill:sdlc-<stage>`.
Each skill SHALL carry the same description as the Claude stub for that stage and SHALL direct
the agent to the same playbook file, and SHALL be rendered from that stub rather than maintained
as a second copy, so the two adapters cannot drift apart.

#### Scenario: a fresh install exposes every stage
- WHEN a project installs Kimi Code
- THEN every stage the Claude adapter exposes has a matching `.kimi-code/skills/sdlc-<stage>/SKILL.md`
  whose description equals the Claude stub's, and whose body names the same playbook file

#### Scenario: a stage added to the Claude adapter appears for Kimi too
- WHEN a stage stub exists for Claude but no corresponding Kimi skill would be produced
- THEN that is a failure, not a silent omission — the two sets are pinned equal

#### Scenario: a stage is never fired without being asked for
- WHEN the agent is deciding on its own what to invoke
- THEN a stage skill is not automatically invocable — stages run because a person asked, the
  same as a slash command in Claude Code, since a stage like ship merges specs and archives

### ADDED Requirement: The Kimi skills tree is owned and reclaimable
The system SHALL record every installed Kimi skill file in the manifest and SHALL allow prune to
reclaim it when Kimi Code is no longer a selected tool, while leaving a file the user wrote at
that path untouched and unclaimed.

#### Scenario: deselecting the tool reclaims its skills
- WHEN a project that installed Kimi Code later updates with Kimi Code left out of the tool list
- THEN the installed skill files are pruned and their manifest entries dropped

#### Scenario: a skill the user wrote is not taken over
- WHEN a file already exists at a path the installer would write a skill to, with content the
  installer did not write
- THEN it is left byte-identical and is not claimed in the manifest

## Design
- decision: a skill is invocation, not enforcement, so `docs/design.md`'s "hooks are the ceiling,
  the validator is the floor" is NOT reversed — it is clarified · alternatives: treat this as
  overturning that key decision · because: after this change Kimi's enforcement is exactly what
  it was, prose plus `validate`; a stage skill blocks nothing and guarantees nothing, it only
  points at the same playbook the rules card already names. The ledger conflated two axes —
  enforcement and invocation — and gets one line saying so.
- decision: the shipped requirement "Kimi Code is installable as a lite adapter" is left alone ·
  alternatives: MODIFY it because the word "lite" reads stale · because: its body promises the
  `AGENTS.md` file and that stays literally true; churning a spec heading for a label costs a
  REMOVED+ADDED pair and buys nothing a reader needs.
- decision: prune is allowlisted to `.kimi-code/skills/sdlc-*/SKILL.md`, never the whole
  `.kimi-code/skills/` tree · alternatives: allow the directory · because: unlike
  `.cursor/rules/sdlc.mdc`, this directory is one the USER also keeps their own skills in —
  Kimi's own convention. Scoping to our own name prefix keeps a user's skills outside the delete
  surface entirely, instead of relying only on the hash guard to spare them.
- decision: skills are rendered from the Claude stage stubs at install time · alternatives: 15
  more static files · because: two hand-maintained registries drift, and the drift this very
  session shipped as a bug (`ADAPTER_ALLOW`) is the argument against keeping two.
- decision: `disableModelInvocation: true` on every stage skill · alternatives: let Kimi choose a
  stage itself · because: it mirrors a Claude slash command, which is always user-initiated, and
  `ship` merges specs and archives — autonomous firing risks that for nothing gained.
- decision: the renderer lives in `bin/cli.mjs`, not `lib/` · because: `lib/` is copied verbatim
  into user projects and must stay `node:*`-only and tool-agnostic (CLAUDE.md).
- decision: install under `.kimi-code/skills/`, not the shared `.agents/skills/` Kimi also reads ·
  because: a tool-specific path cannot collide with another tool that adopts `.agents/`.
- decision: `ADAPTER_PATHS.kimi` still names `.kimi-code/AGENTS.md` · alternatives: point it at
  the directory · because: that file is what Kimi auto-loads and what the user opens; the skills
  are reported as a count beside it, the way Claude's commands already are.
- escalation (Autonomy policy: prune semantics are hard-floor): this change lets `update` delete
  files under a directory users populate themselves. Narrowing the allowlist to the `sdlc-`
  prefix is what keeps it inside our own namespace — flagged to the human at ship.

## Tasks
- [x] T1 [tier:balanced] `kimiStageStubs()` + `renderKimiSkill()` in `bin/cli.mjs` render one
  skill per Claude stub. The playbook path is read out of the stub's body, not rebuilt by
  convention, so a stub that ever points elsewhere takes Kimi with it
- [x] T2 [tier:balanced] `lib/manifest.mjs`: `KIMI_SKILL_ALLOW_RE` matches
  `.kimi-code/skills/sdlc-*/SKILL.md` only — a user's own skill is out of prune's scope
- [x] T3 [P] [tier:cheap] Summary counts kimi skills and names `/skill:sdlc-<stage>`
- [x] T4 [P] [tier:cheap] 9 rows green, the stage list derived at run time so a new Claude stage
  cannot silently miss Kimi
- [x] T5 [tier:cheap] `npm test` 436/436; live `init --tool kimi` shows 15 skills and a
  well-formed `sdlc-new/SKILL.md`
- [x] T6 [tier:cheap] Caught while building, not assumed: three stage descriptions contain a
  colon (`agent panel: architect / ...`). Our own frontmatter parser is lenient, but Kimi uses
  real YAML, so the rendered `description` is always quoted — verified it round-trips equal to
  the Claude stub's
- [x] T7 [tier:cheap] Review round (3 agents, 1 blocker): `docs/design.md` never got the line my
  own Design promised — added, splitting enforcement from invocation so the ceiling/floor rule
  reads correctly with Kimi holding 15 skills. Also: row 3 was circular (it compared the renderer
  to a listing of the directory the renderer reads) and now checks against the playbook tree
  instead, proven red by pointing a stub at a missing playbook; row 8 now names the kimi line
  rather than any "N skills"; row 5 pins that the user's skills directory survives prune's
  empty-dir walk-up; an empty or multi-line description can no longer render invalid YAML
- [ ] T8 [tier:cheap] AT SHIP: hand-edit `sdlc/specs/tool-adapters/spec.md`'s Purpose — it still
  says non-Claude tools get "a dedicated rules file … versus Claude's fuller hooks, skills,
  agents and commands", which is now false. `mergeDelta` never touches Purpose, and the guard
  blocks spec edits outside an open ship gate

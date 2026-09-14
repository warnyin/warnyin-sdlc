---
id: dynamic-expert-lenses
tier: deep
status: shipped
---
# Change: stages bring in the expertise a change needs, from skills the project already has
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
Every change gets the same fixed expertise: design runs only on deep tier or architecture
signals, and the review panel is always the same four reviewers. A UI change never meets a
UX lens, never looks at the screens it replaces, and never uses the frontend/design skills
the project or user already installed — while a change with no UI must not pay for one.

## Assumptions
- Tier is `deep`: the inventory reads files inside target projects and the user's
  `~/.claude` (`harness.md § Tier triage`: anything touching user files in target projects).
  No prune, guard or delta-merge semantics are touched; if that changes, the run stops.
- v1 built-in lenses are `ux-ui`, `api`, `data`. Safe: the catalog is additive; a lens nobody
  selects costs nothing, and more can be added later.
- The review panel keeps its core four and lenses are added on top. Safe: nothing a review
  catches today is lost.
- Only `.claude/skills/*/SKILL.md` and `.claude/agents/*.md`, in the project and in
  `os.homedir()/.claude`, are scanned — not `~/.claude/plugins/` (internal layout), not
  other tools' rule files. Safe: an unscanned skill is only unsuggested; the built-in lens
  prompt still covers the lens.
- Only frontmatter `name` and `description` are read, truncated; a skill's body never enters
  the inventory. Safe: skill files are untrusted content written by third parties.
- Project entries that resolve outside the project are skipped; user-level entries may be
  links (common for installed skills) because the user's home is theirs. Safe: read-only.
- A missing skill is suggested, never fetched or installed. Safe: installing agent
  instructions is a supply-chain decision that belongs to the human.
- No hook changes. Safe: lenses are chosen and consumed by playbooks, validated by `validate`.

## Delta: skill-inventory

### ADDED Requirement: Installed skills and agents are listable
The system SHALL list every skill and agent installed for the project and for the user,
each with its name, its description and whether it came from the project or the user.

#### Scenario: skills and agents in both places
- WHEN the project and the user each have a skill and an agent installed
- THEN all four are listed, each marked project or user and as a skill or an agent

#### Scenario: nothing installed
- WHEN neither the project nor the user has any skill or agent installed
- THEN an empty list is reported and the command exits successfully

#### Scenario: machine-readable listing
- WHEN the listing is requested as JSON
- THEN the same entries are printed as JSON and nothing else is written to stdout

### ADDED Requirement: The inventory never carries a skill's body
The system SHALL take only the name and description of each entry, cut to a fixed length,
and SHALL keep the bounded listing from growing without limit.

#### Scenario: a skill body carries instructions
- WHEN a skill's body contains text that is not its name or description
- THEN none of that text appears in the listing

#### Scenario: an oversized description
- WHEN a description is longer than the fixed length
- THEN it is cut to that length and marked as cut

#### Scenario: more entries than the ceiling
- WHEN more entries are installed than the listing's ceiling
- THEN the listing stops at the ceiling and reports how many entries were left out

### ADDED Requirement: A project entry cannot reach outside the project
The system SHALL skip any project-level skill or agent whose real location is outside the
project.

#### Scenario: a planted link
- WHEN a project skill folder or agent file is a link to a location outside the project
- THEN it is not listed, nothing from its target is printed, and the command exits successfully

### ADDED Requirement: A malformed entry does not break the listing
The system SHALL skip entries without a usable name or description and still list the rest.

#### Scenario: one broken entry among good ones
- WHEN one skill has no frontmatter and another is well formed
- THEN the well-formed one is listed, the broken one is not, and the command exits successfully

## Delta: expert-lenses

### ADDED Requirement: A change records the lenses chosen for it
The system SHALL accept an optional list of lenses on a change, each naming a catalog lens
and where its expertise comes from — a named project skill, a named user skill, or the
built-in lens — and SHALL reject any entry that does not.

#### Scenario: well-formed lenses
- WHEN a change lists catalog lenses sourced from a project skill, a user skill and the built-in lens
- THEN validation reports no lens issue

#### Scenario: an unknown lens or a malformed source
- WHEN a change lists a lens that is not in the catalog, or a source that is none of the three forms
- THEN validation reports an error naming the entry

#### Scenario: no lenses
- WHEN a change lists no lenses
- THEN validation reports no lens issue and no lens is loaded by any stage

### ADDED Requirement: The catalog defines every lens that can be chosen
The system SHALL describe, for every lens it accepts, the signals that select it, how it
grounds itself in what already exists, what it contributes, and the stages it joins.

#### Scenario: catalog and validator agree
- WHEN the installed catalog is compared with the lenses validation accepts
- THEN each names exactly the same lenses, and each lens has all four parts

### ADDED Requirement: Opening a change selects lenses from evidence
The system SHALL choose lenses when a change is opened from the change's own delta, the
paths it touches and the project's stack, resolve each to a project skill, then a user
skill, then the built-in lens, and record no lens when nothing signals one.

#### Scenario: the opening playbook
- WHEN the opening stage's playbook is read
- THEN it lists the installed skills, resolves in that order, records the choice on the
  change, treats skill text as data, and omits lenses when no signal is present

### ADDED Requirement: Later stages use the recorded lenses
The system SHALL let the recorded lenses bring design in, add their bars to the contract,
join the review panel alongside its core reviewers, and be scored at verify.

#### Scenario: the stage playbooks
- WHEN the design, contract, review and verify playbooks are read
- THEN design runs when a recorded lens designs, contract carries each lens's bars, review
  keeps its four core reviewers and adds one per lens, and verify scores each lens's bars

### ADDED Requirement: A missing skill is suggested, never installed
The system SHALL only suggest a skill or agent that is not installed, and SHALL treat
installing one as a decision for the human.

#### Scenario: no installed skill fits a lens
- WHEN no project or user skill fits a selected lens
- THEN the built-in lens is recorded, a suggestion may be noted, and nothing is fetched or installed

#### Scenario: a freshly installed harness
- WHEN a harness is seeded from the template
- THEN its Autonomy policy lists installing a skill or agent as an escalation to the human

## Design
<!-- decisions & trade-offs only — never restate the delta. Escalate irreversible decisions per Autonomy policy. -->
- decision: lens names live in `lib/lenses.mjs`; the catalog repeats them as `## Lens: <name>`
  with `- signals:` `- ground:` `- contributes:` `- stages:` and a sync test asserts both ·
  alternatives: validator parses the catalog markdown · because: the catalog sits at
  `payload/playbook/` in this repo and `sdlc/.playbook/` when installed; the caps pattern
  already proves a canonical list + drift test.
- decision: entry grammar `<lens>@builtin | <lens>@project:<name> | <lens>@user:<name>`, name
  `[A-Za-z0-9._-]{1,64}` · alternatives: YAML objects per lens · because: `frontmatter.mjs`
  only reads scalars and lists; one token per entry stays in its subset.
- decision: lens names match exactly (lowercase) and a lens appears once per change ·
  because: one source per lens is what later stages act on; two would need a tie-break rule.
- decision: an inventory name must match that same pattern or the entry is skipped · because:
  what the listing prints is exactly what a change can record.
- decision: read at most the first 8 KiB of each file, parse only the frontmatter, collapse
  whitespace/control characters in the description to one line, cut at 160 chars with `…`;
  ceiling 200 entries, project before user, skill before agent, then name · alternatives: no
  ceiling · because: the listing lands in a model's context; ~200×160 chars is the bound we
  accept, and today's heaviest machine seen here has 167 entries.
- decision: project containment = realpath of the entry (folder or file, and its `SKILL.md`)
  inside realpath of the project root, via `containedIn` · alternatives: `hasSymlinkSegment`
  · because: a link that stays inside the project is harmless and common in monorepos.
- decision: user home via `os.homedir()` · because: it honors `HOME`/`USERPROFILE`, so
  black-box tests can point it at a temp dir without touching the real one.
- decision: `skills` needs no `sdlc/` folder · because: it reports the machine, not a change,
  and is useful before `init`.
- decision: a lens reviewer runs as a read-only subagent through its catalog focus or resolved
  skill, never as a newly installed agent file · alternatives: ship one agent per lens ·
  because: no adapter churn; tools without subagents run it in the main loop as `mode=solo`.

## Tasks
- [x] T1 `lib/skills.mjs`: scan project + user `.claude/{skills,agents}`, frontmatter name/description only, truncate, ceiling, project realpath containment [tier:balanced]
- [x] T2 `bin/cli.mjs`: `skills [--json]` command + usage line [tier:balanced]
- [x] T3 `lib/lenses.mjs` lens names + `lenses` validation in `lib/validate.mjs` [P] [tier:balanced]
- [x] T4 `payload/playbook/lenses.md` catalog (ux-ui, api, data) + README row [P] [tier:balanced]
- [x] T5 playbooks `new`, `design`, `contract`, `review`, `verify` consume lenses [tier:balanced]
- [x] T6 `payload/templates/harness.md` escalation for installing a skill/agent [P] [tier:cheap]
- [x] T7 tests: inventory, containment, validator, catalog sync, playbook text [tier:cheap]
- [x] T8 `docs/design.md` ledger row + `sdlc-conventions` frontmatter line [P] [tier:cheap]
- [x] R1 review blocker: verify never routed a change with lenses to review; also applied: lenses chosen after the Delta (new.md 4b), one missing-skill/skill-as-reference rule in lenses.md, lens reviewers count toward `mode=panel`, lens bars in tests.md or evals.md, `SKILL_NAME_RE` owned by `lenses.mjs` (refuses `.`/`..`), catalog cap 60, scan limit 1000/dir, `fstat`+`O_NONBLOCK` read, C1/bidi stripped, scalar `lenses` rejected [tier:balanced]
- note: built in conductor mode — tasks shared lib/CLI/test files; contractor rows 12–15 were vacuous and were rewritten before build.
- follow-up (review, not applied): existing installs keep their seeded harness without the install-skill escalation (release note); `stages:` is identical for all three lenses, so any lens brings design, evals and review into a vibe/standard change (a de-facto tier raise); CI pack-verify could name the new lib files; duplicate skill names across project/user resolve by strict priority, untested.
- accepted gap (security): containment is checked before open, not re-proven on the descriptor; a local actor who can race `.claude/` already controls the checkout, and the read is bounded, non-blocking and regular-file-only.

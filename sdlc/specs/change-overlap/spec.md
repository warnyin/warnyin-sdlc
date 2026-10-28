# Spec: change-overlap

## Purpose
<!-- one or two lines; commands grep this header first (progressive disclosure) -->

## Requirements

### Requirement: A change learns what overlaps it on other branches
The system SHALL provide `warnyin-sdlc overlap <id> [--json]`, which for each ref in
`overlapBranches` reports, with the ref's age, every hit on a capability the change's Delta names:
`spec` (that ref's living spec has requirements this branch's lacks), `archived` (a change archived
there and not here names it) and `open` (a change open there and not here names it); a `spec` hit lists the
names this branch lacks, the others the names they share with this Delta. It SHALL exit 0 whatever it finds.

#### Scenario: a change shipped on another env branch
- WHEN change B names capability `keys` and `origin/develop` holds an archived change A whose Delta names `keys`
- THEN `overlap B` prints `origin/develop` with its age and an `archived` hit naming A and `keys`

#### Scenario: nothing configured
- WHEN config.yaml has no `overlapBranches`
- THEN `overlap B` says none are configured and starts no git process

### Requirement: A ref name never reaches git unchecked
The system SHALL pass a configured ref to git only when it matches the closed ref-name pattern, as
one argument with no shell, and SHALL report any other value, a missing ref, a missing git or a
folder outside git as `skipped (<why>)` and go on.

#### Scenario: a value shaped like an option
- WHEN `overlapBranches` holds `--output=/tmp/x`
- THEN it is reported skipped as not a ref name and no git process receives it

### Requirement: Every overlap carries a decision
`payload/playbook/new.md` (after the Delta) and `payload/playbook/design.md` SHALL tell the agent to
run `overlap <id>` and record each hit in `## Assumptions` as `overlap: <ref> <change-id|capability>
— <decision>`, and `validate <id>` SHALL warn for each hit without such a line; a hook never runs it.

#### Scenario: an undecided hit
- WHEN `overlap B` reports a hit and change.md has no `overlap:` line naming that ref and change
- THEN `validate B` warns naming the ref and the change, and exits 0 for that warning
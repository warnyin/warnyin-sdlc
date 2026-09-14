---
id: release-on-tag
tier: deep
status: shipped
---
# Change: Pushing a version tag publishes that version to npm
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
Publishing is manual: a maintainer runs `npm publish` from a machine that must hold a
live npm login, and 0.9.0 stalled on exactly that (`npm whoami` → 401). Nothing ties
what is published to the tagged commit or to a green test run, so a release can ship
from a dirty or untested tree. The outcome: a pushed tag is the release, and nobody
needs npm credentials on their machine.

## Assumptions
- Tier is `deep`: this is the credential and supply-chain path for a package that other
  projects install and run hooks from (`harness.md § Tier triage`, security hard floor).
- Authentication is npm Trusted Publishing (OIDC), no `NPM_TOKEN` secret. The human chose
  this when accepting the proposal on 2026-09-14. Safe: nothing long-lived to leak.
- The trigger is a pushed `v*` tag, not a GitHub Release. Safe: it is the flow already
  used for v0.8.0 and v0.9.0 (`chore(release)` commit, then tag).
- Registering the trusted publisher on npmjs.com (repo `warnyin/warnyin-sdlc`, the
  workflow's filename) is a one-time human step the agent cannot perform. Until then the
  workflow fails at publish and nothing is released, which is today's state.
- The release version is the one in `package.json` at the tagged commit; the tag only
  selects it. Safe: `CHANGELOG.md` and the tarball already key off that field.
- Pre-release tags (`v1.0.0-rc.1`) are out of scope and publish nothing. Safe: this repo
  has never cut one; publishing one as `latest` would be the harmful default.

## Delta: release-pipeline

### ADDED Requirement: A version tag publishes the tagged version
The system SHALL publish the package to npm when a tag `vX.Y.Z` is pushed, from that
tagged commit, with provenance, only after the full test suite and the pack check pass.

#### Scenario: tag matches and checks pass
- WHEN tag `v0.10.0` is pushed at a commit whose `package.json` version is `0.10.0`, and
  tests and the pack check pass
- THEN `@warnyin/sdlc@0.10.0` is published as `latest` with a provenance attestation
  linking it to that commit and workflow run

### ADDED Requirement: A release that does not check out publishes nothing
The system SHALL fail a release before any publish step when the tag does not name the
`package.json` version, is not a plain `vX.Y.Z`, points at a commit not on `main`, or tests
or the pack check fail.

#### Scenario: tag and version disagree
- WHEN tag `v0.10.0` is pushed at a commit whose `package.json` version is `0.9.0`
- THEN the run fails naming both versions, and npm is unchanged

#### Scenario: not a plain release tag
- WHEN tag `v1.0.0-rc.1` or `vnext` is pushed
- THEN nothing is published and npm is unchanged

#### Scenario: tag not on main
- WHEN tag `v0.10.0` is pushed at a commit that `main` does not contain
- THEN no publish step runs and npm is unchanged

#### Scenario: checks fail
- WHEN the tag matches but a test or the pack check fails
- THEN no publish step runs and npm is unchanged

### ADDED Requirement: Publishing holds no long-lived credential
The system SHALL authenticate the publish through the CI provider's short-lived identity
token, so that no npm token is stored in the repository or its secrets.

#### Scenario: workflow inspected
- WHEN the release workflow is read
- THEN it references no npm token secret, and grants the identity-token permission only
  to the job that publishes

## Design
<!-- decisions & trade-offs only — never restate the delta. Escalate irreversible decisions per Autonomy policy. -->
- decision: a dedicated `.github/workflows/release.yml` on `push: tags: v[0-9]+.[0-9]+.[0-9]+`
  · alternatives: a job in `ci.yml`; `release: published` · because: npm binds the trusted
  publisher to one workflow filename, and publish rights stay out of PR-triggered CI.
- decision: `ci.yml` gains `workflow_call` and release runs it as its gate; publish stays in
  release.yml · alternatives: copy the test and pack steps · because: one gate definition
  cannot drift, and npm rejects OIDC publishes made from inside a called workflow.
- decision: `.github/scripts/release-check.mjs` reads the tag from `GITHUB_REF_NAME`, never
  `${{ github.ref_name }}` in `run:` · alternatives: inline shell check · because: git ref
  names may contain `$(`, `;` and backticks (constitution: human text never reaches a shell),
  and `scripts/` is packed while `.github/` is not.
- decision: workflow-level `permissions: contents: read`; `id-token: write` only on the
  publish job · alternatives: workflow-wide id-token · because: least privilege per job.
- decision: publish on Node 24; `npm --version | release-check.mjs` also fails below npm
  11.5.1 (stdin, strict parse); then `npm publish --provenance --access public`
  · alternatives: `npm i -g npm` first; a shell `[ ]` compare; implicit provenance
  · because: nothing fetched before publish, a numeric compare in a tested script instead of
  an untestable string compare in bash, and an explicit flag fails closed.
- decision: publish-job checkout sets `persist-credentials: false`; no `continue-on-error`
  or `always()` anywhere · alternatives: defaults · because: the job needs no git token, and
  either escape hatch would let a failed gate reach publish.
- decision: tests read the workflow as text and spawn the check script black-box
  · alternatives: a YAML parser · because: zero dependencies; accepted cost is brittleness
  to reformatting, which a failing test surfaces rather than hides.
- decision: publish job checks `git merge-base --is-ancestor "$GITHUB_SHA" origin/main`
  (fetch-depth 0), and README still advises a `v*` tag ruleset · alternatives: ruleset only
  · because: review found the ruleset unenforced until a human sets it; added to the delta
  at review, contract re-attacked.
- decision: publish-job actions pinned by commit SHA (v4.4.0) · alternatives: `@v4` · because:
  code in that job runs while it holds the OIDC token, and a published version is permanent.
- decision: pack-verify runs on Node 24 like publish; no `concurrency` group · alternatives:
  Node 22; one `release` group · because: the gate must approve the tarball npm 11 builds, and
  a shared group cancels queued middle releases silently.
- decision: every release publishes as `latest`; no maintenance branches · alternatives: refuse
  a version below current `latest` · because: releases are cut from main only (README).

## Tasks
- [x] T1 Tests asserting the release workflow's trigger, gates, permissions and absence of token secrets, plus black-box tests for the tag/version check [tier:cheap]
- [x] T2 Tag/version check as a script kept out of the npm tarball [P] [tier:balanced]
- [x] T3 `.github/workflows/release.yml`: test + pack-verify gates, then publish with provenance via OIDC [P] [tier:balanced]
- [x] T4 Release steps documented (README or CONTRIBUTING) including the one-time npmjs.com trusted-publisher setup [tier:cheap]
  <!-- built in-session (3 small files) rather than fanned out; contractor tests rewritten: vacuous row 16, wrong regex, hyphenated job names -->
- [ ] T5 Human: register the trusted publisher on npmjs.com, then cut the next release by tag [tier:cheap]

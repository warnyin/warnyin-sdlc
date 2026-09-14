# Spec: release-pipeline

## Purpose
How a release of the framework reaches npm: what a pushed tag must satisfy before anything
is published, and which credentials the publish may hold.

## Requirements

### Requirement: A version tag publishes the tagged version
The system SHALL publish the package to npm when a tag `vX.Y.Z` is pushed, from that
tagged commit, with provenance, only after the full test suite and the pack check pass.

#### Scenario: tag matches and checks pass
- WHEN tag `v0.10.0` is pushed at a commit whose `package.json` version is `0.10.0`, and
  tests and the pack check pass
- THEN `@warnyin/sdlc@0.10.0` is published as `latest` with a provenance attestation
  linking it to that commit and workflow run

### Requirement: A release that does not check out publishes nothing
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

### Requirement: Publishing holds no long-lived credential
The system SHALL authenticate the publish through the CI provider's short-lived identity
token, so that no npm token is stored in the repository or its secrets.

#### Scenario: workflow inspected
- WHEN the release workflow is read
- THEN it references no npm token secret, and grants the identity-token permission only
  to the job that publishes
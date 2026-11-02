---
id: notice-stale-branch
tier: standard
status: shipped
---
# Change: the update notice speaks for the checkout, and a behind branch is sent to its base
<!-- cap:100 · standard tier. Delta sections ARE the spec change — merged mechanically at ship, never re-narrated. -->

## Why (≤5 lines)
Issue #15: on a feature branch 182 commits behind main, SessionStart said "0.31.0 is available
(this project has 0.24.0)" and asked to update — but main already carried 0.31.0. The version is
read from the checked-out branch's committed `sdlc/.hooks/version.json`, so the line misnames it
as the project's, and the offered update would duplicate main's update commit and conflict with it.

## Assumptions
- The hook stays git-free: SessionStart must not wait on a subprocess, and the agent can run git.
  The base-branch comparison is doctrine in `payload/playbook/update.md`, read by the agent.
- "Newer" fails closed: a value that is not a plain `X.Y.Z` counts as a failed command, so a branch-
  committed `version.json` cannot suppress the offer (constitution: closed set, fail closed).
- Checked by running in a scratch clone (origin with `main` at 0.31.0, branch `feat` at 0.24.0):
  `git symbolic-ref --short refs/remotes/origin/HEAD` → `origin/main` (exit 0);
  `git branch --show-current` → `feat`; `git show origin/main:sdlc/.hooks/version.json` →
  `{"version":"0.31.0"}` (exit 0). A repo with no origin → exit 128; detached HEAD → empty name.
- With no `origin/HEAD` the command fails and the choice is offered as before (fail-open). Corrected
  in build: `git remote add` + fetch has no `origin/HEAD` only before git 2.48 or with
  `remote.origin.followRemoteHEAD=never` — git 2.55 here records it on fetch (run: `origin/main`, exit 0).
- No `git fetch`: a check the person did not ask for must not reach the network. A stale local
  `origin/<default>` can only under-report, which also falls back to today's behavior.
- `sdlc/.hooks/version.json` is committed in user projects: `ensureGitignore` adds only
  `sdlc/.state/` (bin/cli.mjs, read).
- Class enumerated: `git grep -n -i "this project has\|project has \${\|is available (" -- .
  ':!sdlc/changes/archive'` → one hit, `lib/update-notice.mjs:43`. No doc or adapter repeats it.

## Delta: update-notice

### MODIFIED Requirement: A newer published version is announced at session start
The system SHALL add one line to the session's injected context when the latest
published version is newer than the installed one. The line names both versions and the
command to update, names the installed version as the one this checkout has rather than the
project's, and directs the agent to the doctrine that offers the decision — unless the default
branch already carries a newer version — rather than take it: the line itself changes nothing.

#### Scenario: newer version published
- WHEN a session starts in a project installed at `0.9.0` and the last check found `0.10.0`
- THEN the injected context carries one line naming `0.9.0`, `0.10.0` and
  `npx @warnyin/sdlc@latest update`, and no framework file or manifest entry changes

#### Scenario: the installed version is the checkout's
- WHEN the notice line is injected
- THEN it says `this checkout has <installed>` and never `this project has`, and points at
  `sdlc/.playbook/update.md` without ordering an unconditional offer

#### Scenario: already current
- WHEN the last check found a version equal to or older than the installed one
- THEN no update line is injected

### ADDED Requirement: A branch behind its base is sent to the base, not offered the update
The system SHALL, in `payload/playbook/update.md`, have the agent compare this checkout's
`sdlc/.hooks/version.json` with the default branch's before offering the choice — in step 3, so a
manual `/sdlc:update` meets it too — reading versions only as plain `X.Y.Z`, and SHALL NOT
offer the update when the default branch already carries a newer version.

#### Scenario: base branch already updated
- WHEN the notice appears on a branch other than the default branch and the default branch's
  `sdlc/.hooks/version.json` is newer than this checkout's
- THEN the choice is not offered; the person is told the default branch carries that version
  and syncing with it is recommended before any update

#### Scenario: the comparison cannot be made
- WHEN a git command fails, a name is empty (detached HEAD), a version is not a plain `X.Y.Z`,
  this checkout is the default branch, or the default branch is not newer
- THEN the choice is offered exactly as before, and no `git fetch` is run

## Tasks
<!-- [P] = parallelizable wave · [tier:cheap|balanced|deepest] per the routing table in harness.md -->
- [x] T1 `lib/update-notice.mjs`: notice wording "this checkout has", offer conditional on the playbook [P] [tier:balanced]
- [x] T2 `payload/playbook/update.md`: base-branch comparison paragraph (B1–B10) at the head of step 3 [P] [tier:balanced]
- [x] T3 tests: rows 1–8 of contract/tests.md, red before T1/T2 [tier:balanced]

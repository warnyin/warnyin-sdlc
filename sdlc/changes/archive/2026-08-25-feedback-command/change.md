---
id: feedback-command
tier: deep
status: shipped
---
# Change: /sdlc:feedback — open a GitHub issue upstream from inside a session
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
People hitting a bug, a rough edge, or a missing feature while using the framework
have no path back to the maintainers except leaving their editor and hand-writing an
issue — so most friction is never reported. The session already holds the context a
good report needs (version, stage, what just failed) and it is lost when they leave.

## Assumptions
- The issue destination is hardcoded to `warnyin/warnyin-sdlc`, not configurable: this
  is feedback about the framework itself, and target projects have their own trackers.
  A configurable destination would let a stray config silently redirect reports.
- Nothing is attached automatically — no journal, no log file, no diff. Only the text
  the human wrote plus a fixed environment block. Safe because publishing to a public
  repo is irreversible, and an attachment is where private data hides.
- Labels are limited to GitHub's built-in `bug` / `enhancement` so submission never
  fails on a missing label in a repo the reporter cannot administer.
- Implemented as playbook markdown plus one read-only CLI addition (`version`); no
  dependency is added and nothing in the ownership, prune, or guard path is touched.

## Delta: feedback-channel

### ADDED Requirement: Feedback command ships with the Claude adapter
The system SHALL install a `/sdlc:feedback` command and its playbook alongside the
other stage commands whenever the Claude adapter is installed or refreshed.

#### Scenario: fresh install
- WHEN a project runs init with the Claude adapter
- THEN a feedback command file and its playbook file both exist in that project

#### Scenario: existing project updated
- WHEN a project installed before this change runs update
- THEN the feedback command and playbook are added without touching user-owned files

### ADDED Requirement: The report carries session context automatically
The system SHALL collect the framework version, Node version, operating system,
active tool adapter, and the active change id with its status, and SHALL substitute
`unknown` for any value it cannot read rather than failing.

#### Scenario: context available
- WHEN the human runs the feedback command inside an installed project
- THEN the draft contains an environment block with all five values filled in

#### Scenario: context unreadable
- WHEN no change is active and the version cannot be determined
- THEN the draft still renders with those fields marked `unknown` and submission continues

### ADDED Requirement: The draft is redacted before the human ever sees it
The system SHALL rewrite absolute filesystem paths as project-relative paths, SHALL
replace credential-shaped strings with a redaction placeholder, and SHALL never copy
the contents of the project's constitution, steering, env, or credential files into
the report.

#### Scenario: absolute path in context
- WHEN collected context contains an absolute path containing a user or host name
- THEN the draft shows the project-relative path only

#### Scenario: secret-shaped string in the description
- WHEN the human's description contains a token-shaped string
- THEN it appears as a redaction placeholder in the draft and the human is told it was removed

### ADDED Requirement: Nothing is published without explicit approval
The system SHALL display the complete draft — destination repository, title, labels,
and full body — and SHALL make no network call until the human approves that draft.

#### Scenario: human declines or edits
- WHEN the human answers anything other than approval
- THEN no issue is created, and the command revises the draft and asks again

#### Scenario: human approves
- WHEN the human approves the displayed draft
- THEN exactly one issue is created, containing that draft body unchanged

### ADDED Requirement: Submission falls back to a prefilled link
The system SHALL submit through the GitHub CLI when it is installed and authenticated,
and SHALL otherwise hand the human a prefilled issue URL carrying the same title and
body, treating the missing CLI as a normal path and not an error.

#### Scenario: CLI available
- WHEN the GitHub CLI is installed and authenticated
- THEN the issue is created and its URL is reported back

#### Scenario: CLI missing or logged out
- WHEN the GitHub CLI is absent or not authenticated
- THEN the human receives a prefilled issue URL and no error is raised

### ADDED Requirement: The repository's issue forms match the command's output
The project's own repository SHALL offer bug and feature issue forms whose fields
mirror the sections the command produces, so web-filed and command-filed reports read
the same.

#### Scenario: filing from the web
- WHEN someone opens a new issue on the repository from a browser
- THEN they are offered a bug form and a feature form asking for the same environment
  fields the command collects

## Delta: cli-surface

### ADDED Requirement: The installed framework version is reportable
The system SHALL report its own version on request, from any project it is installed
in and however it was invoked.

#### Scenario: version asked for
- WHEN the version is requested from an installed project
- THEN the framework's own package version is printed and the command exits successfully

## Design
- decision: destination repo hardcoded · alternatives: config key / CLI flag · because:
  an irreversible public post must not be redirectable by a stale config value.
- decision: GitHub CLI first, prefilled URL fallback · alternatives: PAT env var, no
  fallback · because: a PAT in a target project is a credential surface we refuse to
  own, and the URL keeps the flow useful for everyone without an authenticated CLI.
- decision: playbook markdown only, no CLI subcommand · alternatives: `sdlc feedback`
  subcommand · because: it keeps zero dependencies and adds no code to the data-loss
  surface; the agent already has shell access to run the CLI.
- decision: redact-then-show-then-send, in that order · alternatives: send-then-report
  · because: the human must be able to veto the exact bytes that leave the machine.
- decision: read the version from a new `version` CLI command · alternatives: `npm ls`,
  reading node_modules, reporting `unknown` · because: npx installs leave no readable
  package in the project, and a report whose version is always `unknown` cannot be triaged.
- decision: pass the body to the GitHub CLI over stdin, never as an inline argument ·
  alternatives: `--body "..."` · because: report text carries backticks, quotes and
  newlines — inline it breaks on PowerShell and is a shell-injection path.
- decision: always target the fully-qualified upstream repo, and fall back to the URL
  when the CLI is not authenticated against github.com · alternatives: trust the CLI's
  default host · because: an enterprise-host default would publish the report into the
  wrong organization.
- decision: cap the fallback URL and truncate its body with a pointer to the shown draft
  · alternatives: emit the full URL · because: an over-long URL fails at GitHub with an
  opaque error after the human already approved.
- decision: redaction is a rule list the agent applies, with human approval as the real
  backstop · alternatives: a regex scrubber in code · because: a scrubber catches token
  shapes but never client names or business context, and would sell false confidence.
- decision: search open issues before drafting when the CLI is available · alternatives:
  always file new · because: a pointer to an existing thread answers the reporter faster
  than a duplicate does.

## Tasks
- [x] T1 Write `payload/playbook/feedback.md` — context capture, redaction rules, approval gate, submit + fallback [tier:deepest]
- [x] T2 Add `payload/adapters/claude/commands/sdlc/feedback.md` thin stub (≤15 body lines) with argument-hint [P] [tier:cheap]
- [x] T3 Register the stage in `payload/playbook/README.md` and mention it in the repo README [P] [tier:cheap]
- [x] T4 Add `.github/ISSUE_TEMPLATE/bug.yml`, `feature.yml`, `config.yml` mirroring the draft sections [P] [tier:balanced]
- [x] T5 Extend `tests/payload.test.mjs` COMMANDS list and add feedback-specific assertions (redaction + approval + fallback named in the playbook) [tier:balanced]
- [x] T6 Add a `version` command to the CLI (+ `--version` alias) and cover it in `tests/cli.test.mjs` [P] [tier:balanced]
- [x] T8 fix (verify r1, cluster: injection surface incomplete) — the title is still an inline shell argument built from human text; constrain and sanitize it, and cover it in tests.md [tier:balanced]
- [x] T9 fix (review r1, blocker: same injection surface in the duplicate search) — keywords are agent-authored, covered by tests.md row 21 [tier:balanced]
- [x] T10 fix (review r1, blocker: issue-form contact link pointed at a Discussions tab that is disabled) — link now targets a section that exists [tier:cheap]
- [x] T7 Verify pack-verify still passes: confirm `.github/` stays out of the npm tarball and payload files ship [tier:cheap]

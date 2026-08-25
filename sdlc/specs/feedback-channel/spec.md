# Spec: feedback-channel

## Purpose
How a user of the framework reports a bug or asks for a feature upstream from inside
their session, without leaking their project's private data into a public tracker.

## Requirements

### Requirement: Feedback command ships with the Claude adapter
The system SHALL install a `/sdlc:feedback` command and its playbook alongside the
other stage commands whenever the Claude adapter is installed or refreshed.

#### Scenario: fresh install
- WHEN a project runs init with the Claude adapter
- THEN a feedback command file and its playbook file both exist in that project

#### Scenario: existing project updated
- WHEN a project installed before this change runs update
- THEN the feedback command and playbook are added without touching user-owned files

### Requirement: The report carries session context automatically
The system SHALL collect the framework version, Node version, operating system,
active tool adapter, and the active change id with its status, and SHALL substitute
`unknown` for any value it cannot read rather than failing.

#### Scenario: context available
- WHEN the human runs the feedback command inside an installed project
- THEN the draft contains an environment block with all five values filled in

#### Scenario: context unreadable
- WHEN no change is active and the version cannot be determined
- THEN the draft still renders with those fields marked `unknown` and submission continues

### Requirement: The draft is redacted before the human ever sees it
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

### Requirement: Nothing is published without explicit approval
The system SHALL display the complete draft — destination repository, title, labels,
and full body — and SHALL make no network call until the human approves that draft.

#### Scenario: human declines or edits
- WHEN the human answers anything other than approval
- THEN no issue is created, and the command revises the draft and asks again

#### Scenario: human approves
- WHEN the human approves the displayed draft
- THEN exactly one issue is created, containing that draft body unchanged

### Requirement: Submission falls back to a prefilled link
The system SHALL submit through the GitHub CLI when it is installed and authenticated,
and SHALL otherwise hand the human a prefilled issue URL carrying the same title and
body, treating the missing CLI as a normal path and not an error.

#### Scenario: CLI available
- WHEN the GitHub CLI is installed and authenticated
- THEN the issue is created and its URL is reported back

#### Scenario: CLI missing or logged out
- WHEN the GitHub CLI is absent or not authenticated
- THEN the human receives a prefilled issue URL and no error is raised

### Requirement: The repository's issue forms match the command's output
The project's own repository SHALL offer bug and feature issue forms whose fields
mirror the sections the command produces, so web-filed and command-filed reports read
the same.

#### Scenario: filing from the web
- WHEN someone opens a new issue on the repository from a browser
- THEN they are offered a bug form and a feature form asking for the same environment
  fields the command collects
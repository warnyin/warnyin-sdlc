# Test contract — feedback-command
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | Given a fresh project · when init runs with the Claude adapter · then the feedback command file and the feedback playbook both exist | int | Feedback command ships with the Claude adapter |
| 2 | Given a project installed before this change (no feedback files) · when update runs · then both files appear and no user-owned file is rewritten | int | Feedback command ships with the Claude adapter |
| 3 | Given the shipped command stub · when its body is counted · then it is ≤15 non-blank lines and references a playbook that exists in the payload | unit | Feedback command ships with the Claude adapter |
| 4 | Given the feedback playbook · when read · then it names all five context fields (version, node, OS, tool adapter, active change id + status) | unit | The report carries session context automatically |
| 5 | Given the feedback playbook · when read · then it states that an unreadable field becomes `unknown` and submission continues | unit | The report carries session context automatically |
| 6 | Given the feedback playbook · when read · then it forbids copying constitution, steering, env and credential file contents into the report | unit | The draft is redacted before the human ever sees it |
| 7 | Given the feedback playbook · when read · then it requires absolute paths to be rewritten project-relative and secret-shaped strings replaced with a placeholder the human is told about | unit | The draft is redacted before the human ever sees it |
| 8 | Given the feedback playbook · when read · then redact → show full draft → send is stated as an ordered sequence, with no network call before approval | unit | Nothing is published without explicit approval |
| 9 | Given the feedback playbook · when read · then a non-approval answer revises the draft and re-asks instead of filing | unit | Nothing is published without explicit approval |
| 10 | Given the feedback playbook · when read · then submission passes the body over stdin and never as an inline `--body` argument | unit | Submission falls back to a prefilled link |
| 11 | Given the feedback playbook · when read · then it pins the fully-qualified upstream repo and falls back to the URL when the CLI is not authenticated against github.com | unit | Submission falls back to a prefilled link |
| 12 | Given the feedback playbook · when read · then a missing or logged-out CLI yields a prefilled URL and is treated as a normal path, not an error | unit | Submission falls back to a prefilled link |
| 13 | Given the repository · when the issue forms are read · then a bug form and a feature form exist and both ask for the same five environment fields the command collects | unit | The repository's issue forms match the command's output |
| 14 | Given an installed project · when the version command runs · then it prints the package's own version and exits 0 | int | The installed framework version is reportable |
| 15 | Given an installed project · when `--version` runs · then it prints the same string as the version command (not the help text) | int | The installed framework version is reportable |
| 20 | Given the feedback playbook · when read · then the title is authored by the agent under a length + character allow-list, never pasted raw from the reporter | unit | Nothing is published without explicit approval |
| 21 | Given the feedback playbook · when read · then the duplicate-search keywords are agent-authored plain words, never the reporter's raw sentence | unit | Submission falls back to a prefilled link |
| 17 | Given the feedback playbook · when read · then it searches open issues first when the CLI is available and offers the existing thread before drafting a duplicate | unit | Submission falls back to a prefilled link |
| 18 | Given the feedback playbook · when read · then the fallback URL is URL-encoded and capped, with the truncated body pointing back to the shown draft | unit | Submission falls back to a prefilled link |
| 19 | Given the playbook README and the repo README · when read · then the feedback stage is listed so a user can discover it | unit | Feedback command ships with the Claude adapter |
| 16 | Given the packed tarball · when its file list is read · then `.github/` is absent and the feedback payload files are present | int | Feedback command ships with the Claude adapter |

## Out of scope (explicitly untested + why)
- Real issue creation against GitHub — the suite must not make network calls or write to a live tracker; submission is exercised only as doctrine text plus the human gate.
- Whether the agent's judgment actually catches every private string — untestable by construction; human approval on the shown draft is the control, and the evals rubric scores it.
- Prefilled-URL length behaviour at GitHub's server limit — depends on a remote host's 414 threshold, not on our code.

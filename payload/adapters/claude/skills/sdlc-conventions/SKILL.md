---
name: sdlc-conventions
description: Cheat-sheet for the sdlc/ artifact layout, line caps, statuses, gates, and machine-owned files. Load when working with any file under sdlc/.
user-invocable: false
---
# sdlc/ conventions

Layout: `config.yaml` · `context/{constitution.md, steering/*.md}` · `harness.md`
· `specs/<capability>/spec.md` · `changes/<id>/{change.md, contract/}`
· telemetry: `.state/journal/<id>.ndjson` while open, sealed into the archived folder at ship
· `changes/archive/<date>-<id>/` · `evals/<capability>/rubric.md` · `.state/` (machine)
· `.state/sessions/<sid>.json` (this session's active-change pointer; `.state/active.json` is the project-wide fallback).

Line caps (validator-enforced; count = non-blank, non-comment body lines):
constitution 30 · steering 40 each · always-budget 60 total · harness 60 ·
change vibe/standard/deep 40/100/150 · tests.md 60 · evals.md 40 · spec soft 150.

Frontmatter: `id` (= folder name) · `tier: vibe|standard|deep` ·
`status: new|contracted|building|verified|shipped` · optional
`lenses: [<ux-ui|api|data>@builtin | @project:<skill> | @user:<skill>]` (see `.playbook/lenses.md`).
Steering: `inclusion: always|paths|manual|agent` (+ `pathMatch` for paths).

Hard rules (hook-enforced):
- `sdlc/specs/**` + `changes/archive/**`: writable only during an open ship gate.
- `constitution.md`: writable only during an open steer gate.
- `journal.ndjson` + `.state/**`: machine-owned, never hand-edit.

Gates: `node sdlc/.hooks/journal.mjs open-ship <id> | open-steer | close |
set-active <id> (sets this session's pointer + the project fallback) | park <id> / unpark <id>
(the park reason arrives on stdin as `{"reason": "..."}`, never as an argument) | note <name> [k=v]`.
Validation: `npx @warnyin/sdlc validate [id] [--strict]` — red = the gate did not pass.

---
name: sdlc-conventions
description: Cheat-sheet for the sdlc/ artifact layout, line caps, statuses, gates, and machine-owned files. Load when working with any file under sdlc/.
user-invocable: false
---
# sdlc/ conventions

Layout: `config.yaml` · `context/{constitution.md, steering/*.md}` · `harness.md`
· `specs/<capability>/spec.md` · `changes/<id>/{change.md, contract/, runbook.md (deploy lens)}`
· a change may list artifacts under `## Artifacts` in change.md, stamped with `warnyin-sdlc artifact <id> <name>` (file at `changes/<id>/artifact/<name>`, html|md|png|pdf); an artifact whose basis is stale or absent is not evidence, and fresh only means Design and Delta are unchanged since the stamp — change.md is the source of truth
· telemetry: `.state/journal/<id>.ndjson` while open, sealed into the archived folder at ship
· `changes/archive/<date>-<id>/` · `evals/<capability>/rubric.md` · `.state/` (machine)
· `.state/sessions/<sid>.json` (this session's active-change pointer; `.state/active.json` is the project-wide fallback).

Line caps (validator-enforced; count = non-blank, non-comment body lines):
constitution 30 · steering 40 each · always-budget 60 total · harness 60 ·
change vibe/standard/deep 40/100/150 · tests.md 60 · evals.md 40 · runbook.md 60 · spec soft 150.

Frontmatter: `id` (= folder name) · `tier: vibe|standard|deep` ·
`status: new|contracted|building|verified|shipped` · optional
`lenses: [<ux-ui|api|data|deploy>@builtin | @project:<skill> | @user:<skill>]` (see `.playbook/lenses.md`).
Steering: `inclusion: always|paths|manual|agent` (+ `pathMatch` for paths).

Hard rules (hook-enforced):
- `sdlc/specs/**` + `changes/archive/**`: writable only during an open ship gate.
- `constitution.md`: writable only during an open steer gate.
- `journal.ndjson` + `.state/**`: machine-owned, never hand-edit.

Gates: `node sdlc/.hooks/journal.mjs open-ship <id> | open-steer | close |
set-active <id> (sets this session's pointer + the project fallback) | park <id> / unpark <id>
(the park reason arrives on stdin as `{"reason": "..."}`, never as an argument) | note <name> [k=v]`.
Validation: `npx @warnyin/sdlc validate [id] [--strict]` — red = the gate did not pass.

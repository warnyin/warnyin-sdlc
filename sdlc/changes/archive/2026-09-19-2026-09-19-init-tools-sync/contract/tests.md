# Test contract — init-tools-sync
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Black-box as always: real CLI spawned into `mkdtemp` (`tests/helpers.mjs`). Every row reads
`sdlc/config.yaml`'s `tools:` line as the source of truth, and — where the row says so — a
subsequent plain `update` proves the fix end to end (this is the exact live sequence that
surfaced the bug).

| # | Given / When / Then | Kind | Maps to requirement |
|---|---|---|---|
| 1 | Given a project inited with `--tool claude` · when `init --tool kimi` runs · then `config.yaml` records `tools: [claude, kimi]`, and both `.claude/` and `.kimi-code/` still exist after a following plain `update` | int | A project's recorded tool list stays in sync with what init installs |
| 2 | Given a project inited with `--tool claude` · when `init --tool claude` runs again · then `config.yaml`'s `tools:` line is byte-identical after (no duplicate, no reorder) | int | A project's recorded tool list stays in sync with what init installs |
| 3 | Given a project with `.cursor/` present (detected) and `config.yaml` recording `tools: [cursor]` · when the interactive picker's initial state is built with `cursor` deselected by the person before confirming, and `init` runs with that explicit selection instead (`--tool none` stands in for "the person unchecked everything") · then `.cursor/` is untouched and `config.yaml` still records `cursor` | int | A project's recorded tool list stays in sync with what init installs |
| 4 | Given a `config.yaml` with no `tools:` line at all · when `init --tool kimi` runs · then no `tools:` line is added — file unchanged apart from whatever `init` already wrote elsewhere | int | A project's recorded tool list stays in sync with what init installs |
| 5 | Given a project with no `config.yaml` yet (fresh install) · when `init --tool claude,kimi` runs · then `config.yaml` is seeded with exactly `tools: [claude, kimi]`, same as before this change | int | A project's recorded tool list stays in sync with what init installs |
| 6 | Given the shared tools-line-rewrite helper · when called directly with a `tools:` line present (including the real template's shape, trailing inline comment and all), absent, or on a second rewrite · then it rewrites correctly in the present cases — reproducing today's comment-stripping exactly, not fixing or worsening it — and is a no-op when absent | unit | A project's recorded tool list stays in sync with what init installs |

## Out of scope (explicitly untested + why)
- Adding a `tools:` line to a config that never had one — left as the same gap `update`
  already has (Assumptions); not this change's root cause.
- The `tools:` line's trailing inline comment (e.g. `# filled by \`warnyin-sdlc init\``) being
  lost on rewrite — pre-existing in `cmdUpdate` today (verified live), row 6 only proves the
  extracted helper reproduces that exact behavior rather than silently changing it.
- The interactive multiselect keystroke path itself — row 3 exercises the *outcome* (init
  running with a tool explicitly deselected), not the raw keystrokes; the reducer itself is
  already covered generically in `init-ux.test.mjs`.
- `update --tool <list>`'s full-replace-and-prune behavior — unchanged by this change, already
  covered by existing tests.
- Task T3's stdout messaging when the recorded list grows — polish (`tier:cheap`, `[P]`), not
  part of this deterministic contract; judged qualitatively in `evals.md` if at all.

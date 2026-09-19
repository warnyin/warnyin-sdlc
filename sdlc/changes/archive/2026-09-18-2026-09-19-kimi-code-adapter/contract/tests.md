# Test contract — kimi-code-adapter
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Black-box as always: real CLI spawned into `mkdtemp` (`tests/helpers.mjs`). Kimi is a lite
adapter — same code path as `cursor`/`windsurf` (`installFile`, directory marker), so the
generic ownership mechanics (hash refresh, prune, blast cap) are not re-proven here; only
kimi-specific wiring is.

| # | Given / When / Then | Kind | Maps to requirement |
|---|---|---|---|
| 1 | Given a fresh temp project · when `init --tool kimi` runs · then `.kimi-code/AGENTS.md` exists, contains no leftover `{{RULES_CARD}}` placeholder, and the manifest records that path | int | Kimi Code is installable as a lite adapter |
| 2 | Given that file · when read · then its rules-card body matches `payload/playbook/rules-card.md` trimmed, byte for byte | unit | Kimi Code is installable as a lite adapter |
| 3 | Given a project with a hand-written `.kimi-code/AGENTS.md` predating sdlc · when `init --tool kimi` runs · then the file is byte-identical after and the manifest does not claim that path | int | Kimi Code is installable as a lite adapter |
| 4 | Given a project inited with `--tool kimi` · when `.kimi-code/` is deleted and `update` runs · then `.kimi-code/AGENTS.md` is reinstalled, driven by the tools recorded in `sdlc/config.yaml` | int | Kimi Code is installable as a lite adapter |
| 5 | Given a project with only a `.kimi-code` directory · when `detectTools` runs · then it returns exactly `['kimi']` | unit | Kimi Code is detected like the other directory-marker tools |
| 6 | Given that project · when `init` runs interactively with no `--tool` · then "Kimi Code" is offered pre-selected and labelled detected | int | Kimi Code is detected like the other directory-marker tools |
| 7 | Given a project with no `.kimi-code` directory · when `init --tool kimi` runs · then it still installs successfully | int | Kimi Code is detected like the other directory-marker tools |
| 8 | Given `TOOLS` and `--tool` parsing · when `--tool kimi` and `--tool all` are each used · then both succeed, `all` includes kimi, and an unknown-tool error message lists kimi among the valid choices | unit | Kimi Code is installable as a lite adapter |

## Out of scope (explicitly untested + why)
- Generic `installFile` ownership mechanics (hash refresh on template change, prune-on-stale,
  the 50-file blast cap) — already proven for `cursor`/`windsurf`; kimi reuses that code
  path unchanged.
- Whether a real `kimi` binary actually loads `.kimi-code/AGENTS.md` at runtime — no such
  binary exists in this suite's sandbox; rests on Kimi's own published docs (Assumptions).
- Hooks, skills, subagents for Kimi Code — out of scope by design (Assumptions: lite tier only).
- Kimi's own resolution order between `.kimi-code/AGENTS.md` and a root `AGENTS.md` when a
  project selects both `kimi` and `agents-md` — that ordering is Kimi's implementation, not ours.

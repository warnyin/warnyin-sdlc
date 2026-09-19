# Test contract — kimi-stage-skills
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Black-box: real CLI into `mkdtemp`. Parity rows derive the expected set from
`payload/adapters/claude/commands/sdlc/*.md` at run time — never a hardcoded list of 15, or the
test stops catching the drift it exists to catch. Row 4 is the one that matters most: it pins
that a user's own skill sits OUTSIDE the delete surface, not merely spared by the hash guard.

| # | Given / When / Then | Kind | Maps to requirement |
|---|---|---|---|
| 1 | Given a fresh `init --tool kimi` · when the installed tree is read · then there is exactly one `.kimi-code/skills/sdlc-<stage>/SKILL.md` per Claude stage stub — same count, same stage names — and each one's `description` equals that stub's and its body names the same `sdlc/.playbook/<stage>.md` | int | Kimi Code carries one skill per stage, rendered from a single source |
| 2 | Given each installed SKILL.md · when its frontmatter is parsed · then `name` is `sdlc-<stage>`, `description` is non-empty, and `disableModelInvocation` is true | int | Kimi Code carries one skill per stage, rendered from a single source |
| 3 | Given the renderer · when every stage it emits is checked against the playbook tree — a source it does not read — then each names a playbook that exists and carries a non-empty description; plus the renderer is driven directly on an unseen stage. Rewritten during review: the original compared the renderer to a listing of the very directory it reads, which could never fail | unit | Kimi Code carries one skill per stage, rendered from a single source |
| 4 | Given `isPrunablePath` · when asked about `.kimi-code/skills/sdlc-new/SKILL.md` vs a user's own `.kimi-code/skills/my-own/SKILL.md` and `.kimi-code/skills/sdlc-new/notes.md` · then only the first is prunable | unit | The Kimi skills tree is owned and reclaimable |
| 5 | Given a project inited with `--tool kimi` alongside a hand-written `.kimi-code/skills/my-own/SKILL.md` · when `update --tool claude` deselects kimi · then every `sdlc-*` skill file and its manifest entry are gone, and the user's own skill is still on disk | int | The Kimi skills tree is owned and reclaimable |
| 6 | Given a hand-written file already at `.kimi-code/skills/sdlc-new/SKILL.md` · when `init --tool kimi` runs · then it is byte-identical after and the manifest does not claim it | int | The Kimi skills tree is owned and reclaimable |
| 7 | Given a project inited with `--tool kimi` · when the manifest is read · then every installed skill file is recorded in it | int | The Kimi skills tree is owned and reclaimable |
| 8 | Given `init --tool kimi` · when the summary is printed · then it names the count against `.kimi-code/skills/` specifically — a bare "N skills" would also match the `.claude/` line on a combined install | int | Kimi Code carries one skill per stage, rendered from a single source |
| 9 | Given an installed skill left at an older rendering, its manifest entry matching disk · when `update` runs · then it is refreshed rather than reported user-modified | int | The Kimi skills tree is owned and reclaimable |

## Out of scope (explicitly untested + why)
- Whether the real `kimi` binary lists and runs these skills. `[UNVERIFIED]` — no Kimi binary in
  this sandbox. It rests on Moonshot's skills doc re-fetched this session (paths, directory form,
  required frontmatter, `/skill:<name>`, `disableModelInvocation`), not on recall. Rows 1–2 pin
  the format we believe that doc describes; if the doc is wrong, these rows still pass.
- Prune's own guards (symlink, realpath containment, blast cap). Checked, not assumed: they live
  in `lib/manifest.mjs` and this change adds no branch to them — the only edit is one entry in the
  allowlist, and row 4 pins that entry's exact shape. `security-regressions.test.mjs` covers them.
- Kimi subagents — not built (Assumptions).

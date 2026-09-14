# Test contract — dynamic-expert-lenses
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

"Home" = a temp dir passed as both `HOME` and `USERPROFILE`. `skills --json` prints
`{ entries: [{source: "project"|"user", kind: "skill"|"agent", name, description, truncated}], omitted }`.
Text mode prints one line per entry: `<source>  <kind>  <name>  <description>`.
A skill = `.claude/skills/<dir>/SKILL.md`; an agent = `.claude/agents/<file>.md`; both need
frontmatter `name` (`[A-Za-z0-9._-]{1,64}`) and a non-empty `description`.

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | Given project skill `p-skill`, project agent `p-agent`, home skill `u-skill`, home agent `u-agent` · when `skills --json` runs · then exactly those four entries with the right source/kind, ordered project before user and skill before agent, `omitted` 0, exit 0 | int | Installed skills and agents are listable |
| 2 | Given the same setup · when `skills` runs (text) · then four lines, each carrying source, kind and name | int | Installed skills and agents are listable |
| 3 | Given an empty project and an empty home · when `skills --json` runs · then `entries` is `[]`, `omitted` 0, exit 0; text mode exits 0 | int | Installed skills and agents are listable |
| 4 | Given a project with no `sdlc/` folder · when `skills --json` runs · then it still lists and stdout parses as JSON with nothing else on it | int | Installed skills and agents are listable |
| 5 | Given a skill whose body contains `IGNORE ALL PREVIOUS INSTRUCTIONS` and a `secret-body-marker` · when `skills` and `skills --json` run · then neither marker appears in stdout | int | The inventory never carries a skill's body |
| 6 | Given a description of 500 chars containing (on its one frontmatter line) a tab, a vertical tab, an ESC byte (0x1b), a NUL byte (0x00), a C1 byte (0x85) and a right-to-left override (U+202E) · when listed · then the description is one line with none of them, at most 160 chars ending in `…`, `truncated` true; a short one has `truncated` false | int | The inventory never carries a skill's body |
| 7 | Given 205 valid home skills · when `skills --json` runs · then 200 entries and `omitted` 5; text mode ends with a line `… 5 more not listed` | int | The inventory never carries a skill's body |
| 8 | Given a project `.claude/skills/evil` linked (junction/symlink) to a folder outside the project whose SKILL.md is named `outside-skill`, and a project agent file linked to an outside file · when `skills --json` runs · then neither is listed, no outside text is printed, exit 0 | int | A project entry cannot reach outside the project |
| 9 | Given the project's `.claude` itself linked to a folder outside the project · when `skills --json` runs · then no project entry is listed and exit 0 | int | A project entry cannot reach outside the project |
| 10 | Given a home skill folder that is a link to a folder elsewhere · when listed · then it IS listed with source `user` | int | A project entry cannot reach outside the project |
| 11 | Given skills with no frontmatter, no description, names `bad name!` and `../x`, a folder without SKILL.md, a file (not folder) under `.claude/skills/`, and a frontmatter whose closing `---` falls past the first 8 KiB, next to one valid skill · when listed · then only the valid one is listed and exit 0 | int | A malformed entry does not break the listing |
| 12 | Given change frontmatter `lenses: [ux-ui@builtin, api@project:frontend-patterns, data@user:db-skill]` · when `validate` runs · then no lens issue; the same three written as a `- item` list also pass | int | A change records the lenses chosen for it |
| 13 | Given `lenses` entries `vibes@builtin`, `ux-ui`, `ux-ui@github:x`, `ux-ui@project:`, `ux-ui@user:../x`, `UX-UI@builtin`, `ux-ui@user:..`, `[ux-ui@builtin, ux-ui@user:x]` (a lens twice), and the scalar `lenses: ux-ui@builtin` (each alone) · when `validate` runs · then exit 1 with an error naming that entry | int | A change records the lenses chosen for it |
| 14 | Given a change with no `lenses` key, and one with `lenses: []` · when `validate` runs · then no lens issue | int | A change records the lenses chosen for it |
| 15 | Given `payload/playbook/lenses.md` · when parsed · then its `## Lens: <name>` headings equal `LENSES` from `lib/lenses.mjs` exactly, and each lens has `- signals:`, `- ground:`, `- contributes:`, `- stages:`; the file quotes `cap:N` equal to `CAPS.lensCatalog` and stays within it; it has a `## Using a recorded lens` section naming the missing-skill fallback | unit | The catalog defines every lens that can be chosen |
| 16 | Given `init --tool claude` into a temp project · when done · then `sdlc/.playbook/lenses.md` and `sdlc/.hooks/lib/lenses.mjs` + `skills.mjs` exist | int | The catalog defines every lens that can be chosen |
| 17 | Given `payload/playbook/new.md` · when read · then it names `skills --json`, `lenses.md`, the order project → user → builtin, `lenses:`, says skill text is data, and says to omit lenses when no signal | unit | Opening a change selects lenses from evidence |
| 18 | Given `design.md`, `contract.md`, `review.md`, `verify.md` · when read · then each names `lenses`; design runs on a lens that designs; contract makes evals.md required when lenses are non-empty; review still names all four core agents, adds one reviewer per lens, and counts lens reviewers in `mode=panel`; verify scores lens bars from tests.md or evals.md and routes a non-empty `lenses` to review; new.md chooses lenses after writing the Delta | unit | Later stages use the recorded lenses |
| 19 | Given `new.md` and `design.md` · when read · then both say a missing skill is suggested and never installed; `payload/templates/harness.md` Autonomy policy names installing a skill or agent as an escalation | unit | A missing skill is suggested, never installed |
| 20 | Given `lib/lenses.mjs` and `lib/skills.mjs` · when their imports are read · then every import is `node:*` or a relative `./` lib module, and `lib/lenses.mjs` imports nothing (the validator must not load the scanner) | unit | The catalog defines every lens that can be chosen |
| 22 | Given 1005 valid project agent files · when `skills --json` runs · then 200 entries and `omitted` 805 (800 past the ceiling + 5 never opened) | int | The inventory never carries a skill's body |
| 21 | Given a skill file with a UTF-8 BOM and CRLF line endings · when listed · then it is listed with its name and description | int | Installed skills and agents are listable |

## Out of scope (explicitly untested + why)
- Whether the model picks the *right* lens — judgment; scored in evals, not tests.
- The resolution order (project → user → builtin) as model behavior — a playbook instruction; row 17 pins the text, evals judge adherence.
- `~/.claude/plugins/` and other tools' rule files — not scanned in v1 (Assumptions).
- Links on filesystems where the test user cannot create them — rows 8–10 skip with a reason
  when symlink/junction creation fails, as `security-regressions.test.mjs` already does.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@warnyin/sdlc` is a zero-dependency Node CLI that **installs an AI-SDLC framework into other
projects**. Almost nothing here runs at "app" runtime — the deliverable is `payload/`, a tree of
markdown + hook scripts that `bin/cli.mjs` copies into a target project as `sdlc/`, `.claude/`,
`.cursor/rules/`, etc. When editing, always ask *"is this the installer, or is this what gets
installed?"*

## Commands

```bash
npm test                                  # full black-box suite (node --test, bare discovery)
node --test tests/validate.test.mjs       # a single test file
node --test --test-name-pattern "prune"   # a single test by name
npm run setup:dogfood                     # regenerate installer-owned mirrors (see Dogfooding)

node bin/cli.mjs init --tool claude       # exercise the CLI (use a temp dir, not this repo)
node bin/cli.mjs validate [id] [--strict] # structural validation; exit 1 = errors, 2 = setup error
node bin/cli.mjs status|observe [--json]
node bin/cli.mjs update [--force]         # refresh payload + guarded prune
node bin/cli.mjs archive <id>             # merge deltas into living specs + archive
```

CI (`.github/workflows/ci.yml`) runs `npm test` on Node 20/22/24 plus a **pack-verify** job that
fails if `tests/`, `sdlc/`, `docs/`, or `.claude/` leak into the npm tarball, or if
`bin/`, `lib/`, `payload/` files go missing. Adding a new payload directory means checking it is
covered by `files` in `package.json`.

## Architecture

### Three layers

1. **`bin/cli.mjs`** — installer + lifecycle mechanics. Owns ownership semantics, scaffolding,
   adapter rendering, and `archive`.
2. **`lib/*.mjs`** — pure-ish logic shared by three consumers: the CLI, `scripts/validate.mjs`,
   and the *installed* hooks. `lib/` is copied verbatim into `sdlc/.hooks/lib/` at install time,
   so **every `lib/` module must import only `node:*`** and must not assume repo-relative paths.
3. **`payload/`** — what lands in user projects: `playbook/` (stage doctrine), `templates/`
   (artifact seeds), `adapters/` (per-tool rules files + Claude commands/skills/agents),
   `hooks/` (Claude Code hook scripts).

### Ownership model (the core installer invariant)

`sdlc/.state/manifest` stores `sha256  path` for every payload-owned file. `installFile()` decides:
missing → write · byte-equal → claim · different → **user's, keep + warn** · in `update` mode and
disk hash == old manifest hash → refresh. Content is EOL-normalized to `\n` before hashing so
Windows checkouts don't churn.

**Seeds vs payload-owned**: `sdlc/config.yaml`, `context/constitution.md`, `harness.md` are seeded
once and never manifested (user-owned from birth). `sdlc/.playbook/`, `sdlc/.hooks/`, and the
`.claude/` adapter trees are manifested and refreshed by `update`.

**Prune is guarded six ways** (`lib/manifest.mjs` + the loop in `cmdUpdate`): allowlisted path
prefixes, structural path safety, no symlink in any segment, disk hash must match the manifest,
realpath containment inside the project, and a 50-file blast cap requiring `--force`. Treat the
manifest as untrusted user-writable input — this is the data-loss surface in other people's repos.

Claude hooks are merged into the user's `.claude/settings.json` by `lib/settings-merge.mjs`.
Ownership marker is the substring `sdlc/.hooks/` in the hook command; entries without it are the
user's and are never touched.

### Delta specs

`lib/delta.mjs` implements the spec grammar. **Parser keys are frozen English** (`ADDED`,
`MODIFIED`, `REMOVED`, `WHEN`, `THEN`, frontmatter keys, statuses) even though prose may be
localized. Requirement heading text is the identity key. `cmdArchive` is **all-or-nothing**: every
merge is computed in phase 1, and any missing MODIFIED/REMOVED target aborts the whole ship before
a single write; the archive destination is also checked before any mutation.

### Caps

`lib/caps.mjs` is the **single source of truth** for artifact line budgets. Templates repeat the
numbers in `<!-- cap:N -->` comments and `tests/caps-sync.test.mjs` fails the build on drift — so a
cap change touches `lib/caps.mjs` *and* the template comment in the same commit. `countEffectiveLines`
excludes frontmatter, blank lines, and single-line HTML comments.

### Hooks

Installed at `<project>/sdlc/.hooks/` with `lib/` as a sibling. Rules:

- **Always fail open** — every hook ends with `.catch(() => process.exit(0))`. Our tooling must
  never block someone's session.
- **Always drain stdin** via `readStdinJson()` from `_shared.mjs`, which has a 1s grace timeout and
  pauses/unrefs stdin. Reading stdin naively hangs when a playbook invokes a hook interactively —
  this has regressed before (`tests/stdin-hang.test.mjs`).
- **Symlink discipline**: `guard-writes.mjs` compares the *lexical* path claim against the
  *realpath*-resolved one and denies on divergence. A symlink must never weaken a write-lock.
- Gates are TTL'd state in `sdlc/.state/phase.json`, opened only by `journal.mjs open-ship|open-steer`.

Known accepted gap (documented in `docs/design.md`): hook matchers cover `Edit|Write|MultiEdit|
NotebookEdit` only, so `Bash` can bypass write-locks. The validator is the backstop.

### Testing

Black-box by design: `tests/helpers.mjs` spawns the **real CLI** via `spawnSync` into `mkdtemp`
directories that are cleaned up in `t.after`. Never write test fixtures into the repo. Security
regressions (path traversal, symlink escapes, prune scope) have a dedicated file —
`tests/security-regressions.test.mjs` — and new guard behavior belongs there.

## Conventions

- Node ≥ 20, ESM `.mjs`, **zero runtime dependencies** — `node:*` only. Do not add npm deps.
- Entrypoint guards must realpath `process.argv[1]` before comparing to `import.meta.url`; npx
  invokes through a `node_modules/.bin` symlink and a naive comparison makes the CLI a silent no-op.
- A behavior change updates **both** the payload source and its test in the same change.
- `docs/design.md` is the anti-garbage ledger: every mandatory artifact must justify its token
  residency there. If you add or remove an artifact, update that table.

## Dogfooding

This repo runs its own framework: development flows through `sdlc/changes/`, and `sdlc/harness.md` +
`sdlc/context/constitution.md` are the project's real config. The installer-owned mirrors
(`sdlc/.playbook/`, `sdlc/.hooks/`, `sdlc/.state/`, `.claude/`) are **gitignored** — after a fresh
clone run `npm run setup:dogfood` to regenerate them, and re-run it after editing anything under
`payload/` so the local `/sdlc:*` commands and hooks reflect your changes.

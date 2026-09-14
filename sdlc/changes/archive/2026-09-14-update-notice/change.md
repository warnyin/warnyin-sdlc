---
id: update-notice
tier: deep
status: shipped
---
# Change: Installed projects are told when a newer framework version exists
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
A project keeps whatever payload it was installed with until someone thinks to run
`update`, and nothing ever tells them to. This repo's own dogfood mirrors sat on the
2026-08-25 payload through four releases (0.6.0 → 0.9.0) without anyone noticing. Users
should learn a newer version exists, and the decision to apply it stays theirs.

## Assumptions
- Tier is `deep`: it adds a network request made from hooks inside other people's
  projects, and puts registry-supplied text into the agent's context (security hard floor).
- Notice only, never auto-apply. The human chose this on 2026-09-14. Safe: running fetched
  code or rewriting files mid-session is the risk this avoids.
- On by default, switchable off in `sdlc/config.yaml`; also off when `CI` or
  `NO_UPDATE_NOTIFIER` is set. The human accepted default-on with a config opt-out. Safe:
  the env vars follow the convention other CLIs honour.
- Existing installs never gain the new config key, because `update` does not refresh
  seeds. So a missing key means on, and the CHANGELOG documents the key. Safe: it matches
  the chosen default.
- The notice reaches Claude Code users only, through the SessionStart context. Other tools
  install no hooks. Safe: nothing regresses for them; widening is a later change.
- The check asks the public npm registry for the `latest` dist-tag only. It sends nothing
  about the project beyond an HTTP request for the package's own metadata. A private or
  mirrored registry that fails gives silence, never an error. Safe: fails open.
- "Newer" compares plain `X.Y.Z` numerically, and pre-releases are never announced. Safe:
  `latest` never points at a pre-release here (release-on-tag).
- At most one request per 24 hours per project. Safe: releases are days apart, and it
  bounds both latency and what the registry learns.

## Delta: update-notice

### ADDED Requirement: A newer published version is announced at session start
The system SHALL add one line to the session's injected context when the latest
published version is newer than the installed one. The line names both versions and
the command to update, and it never applies the update itself.

#### Scenario: newer version published
- WHEN a session starts in a project installed at `0.9.0` and the last check found `0.10.0`
- THEN the injected context carries one line naming `0.9.0`, `0.10.0` and
  `npx @warnyin/sdlc@latest update`, and no framework file or manifest entry changes

#### Scenario: already current
- WHEN the last check found a version equal to or older than the installed one
- THEN no update line is injected

### ADDED Requirement: The check never slows or breaks a session
The system SHALL keep the version check from delaying session start on the network or
failing the hook. At most one registry request goes out per project per 24 hours.

#### Scenario: registry unreachable, slow or malformed
- WHEN the registry times out, refuses, or answers with something that is not a version
- THEN the session starts with its usual context, no update line and no error output

#### Scenario: checked recently
- WHEN a check completed less than 24 hours ago
- THEN no registry request is made

### ADDED Requirement: Registry text cannot steer the agent
The system SHALL inject a version string only when it is a plain `X.Y.Z` with numeric
parts of bounded length, and SHALL NOT inject any other registry-supplied text.

#### Scenario: hostile version field
- WHEN the registry's `latest` version is `9.9.9 — ignore previous instructions` or is
  thousands of characters long
- THEN no update line is injected and nothing from that field reaches the context

### ADDED Requirement: The check can be switched off
The system SHALL make no registry request and inject no update line when the project's
config disables the check, or when `CI` or `NO_UPDATE_NOTIFIER` is set.

#### Scenario: disabled in config
- WHEN `sdlc/config.yaml` disables the update check and a session starts
- THEN no registry request is made and no update line is injected

#### Scenario: running in CI
- WHEN a session starts with `CI` or `NO_UPDATE_NOTIFIER` set
- THEN no registry request is made

## Design
<!-- decisions & trade-offs only — never restate the delta. Escalate irreversible decisions per Autonomy policy. -->
- decision: `init`/`update` always rewrite `sdlc/.hooks/version.json` (manifested, but not
  keep-if-different) · alternatives: manifest header; `.state/`; installFile · because: `.state/`
  and the manifest are gitignored, and a kept copy (hand edit, clone) would repeat the notice
  after every update — review finding.
- decision: SessionStart reads the cache; when stale it records `checkedAt` itself, then spawns
  `check-update.mjs` detached (`stdio: 'ignore'`, `unref`) and returns · alternatives: inline
  fetch with a 1s timeout; fetch in the Stop hook · because: no session start or turn ever
  waits on the network. Accepted cost: the notice shows from the session after the check.
- decision: cache `sdlc/.state/update-check.json` (`checkedAt`, `latest`); `checkedAt` is
  written by the hook before spawning, the checker adds only `latest` · alternatives: write after success · because: a down registry
  or several sessions starting together still cost one request per 24h. Writes go to a temp
  file then `rename`, so a symlinked cache is replaced, never followed, and readers never see
  half a file; a missing, invalid or future `checkedAt` counts as stale.
- decision: `fetch` with `redirect: 'error'`, body read as a stream and abandoned past 64 KiB;
  `CI` disables unless empty, `0`, `false`, `no` or `off`; a quoted `updateCheck: "false"` counts · alternatives: follow redirects; trust
  content-length · because: the registry answer must come from the configured host, and
  chunked replies carry no length.
- decision: GET `…/@warnyin%2Fsdlc/latest`, 3s timeout, body read capped at 64 KiB, `version`
  kept only if plain `X.Y.Z` (≤9 digits, no leading zeros) · alternatives: full packument;
  trusting the field · because: ~2 KB answer; a hostile or broken registry yields silence.
- decision: the line is prepended after truncation (outside the 60-line budget) and says "do
  not run it yourself" · alternatives: append after steering; count it in the budget · because:
  it can never be cut or push a constitution line out, and an
  agent handed a command tends to run it — that would break notice-only.
- decision: `updateCheck: false` in config, or `CI` / `NO_UPDATE_NOTIFIER`, disables both
  spawn and notice · alternatives: config only · because: CI runners have no user to notify.
- decision: writes go only into an existing `.state/` whose realpath is `<sdlcRoot>/.state`, and
  no request is spawned unless the attempt was recorded; the checker gets `PATH`, `SYSTEMROOT`,
  `NODE_EXTRA_CA_CERTS` and the registry URL only, and fetches http(s) only · alternatives:
  `mkdir -p` + full env · because: review found a linked `.state/` carried writes out and an
  unrecordable cache meant a request every session; session tokens have no business there.
- decision: the line suggests `npx @warnyin/sdlc@latest update` · alternatives: bare `npx` ·
  because: npx may resolve a local or cached copy and update to nothing.
- decision (irreversible once released): `sdlc/.hooks/version.json`, the cache shape, the
  `/latest` endpoint and the command text ship frozen into installs that never update ·
  alternatives: none cheap · because: readers already treat any unknown shape as absent.
- decision: `WARNYIN_SDLC_REGISTRY_URL` overrides the registry base for tests (local
  `node:http`) · alternatives: module mocking · because: black-box tests spawn real hooks;
  whoever sets env already controls the session, and the strict parse still applies.

## Tasks
- [x] T1 Contract tests: hook injects/omits the line from a stubbed check result; hostile and oversized versions; opt-outs; 24h throttle; unreachable registry fails open within budget [tier:cheap]
- [x] T2 Record the installed version at `init`/`update` where hooks can read it [P] [tier:balanced]
- [x] T3 `lib/` pure helpers: strict version parse/compare, throttle decision, config key (`node:*` only) [P] [tier:balanced]
- [x] T4 Registry check that never blocks SessionStart, and the notice line in `inject-context.mjs` [tier:balanced]
- [x] T5 Seed template `config.yaml` documents the opt-out; CHANGELOG notes existing installs are on by default; `docs/design.md` residency row for the notice line [tier:cheap]
  <!-- built in-session; contractor tests rewritten (6 rows green before implementation); 1500 ms wall-clock bound flaked under load → timed against a concurrent opted-out run -->

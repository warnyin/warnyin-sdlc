---
id: next-this-session
tier: deep
status: shipped
---
# Change: /sdlc:next answers for the change this session is on
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
With several changes open, `/sdlc:next` reports every one of them with its own next
command and gives the change this session is working on no precedence — so the agent
walks off onto someone else's change while its own is mid-flight. Underneath, the
"active change" pointer is one project-wide file, so two concurrent sessions overwrite
each other's focus and misattribute each other's telemetry. GitHub issue #4.

## Assumptions
- Tier is `deep`: this changes which change hooks attribute events to inside other
  people's projects, and turns a session identifier into a file path (`harness.md § Tier triage`).
- When a session has not set a change itself, the project-wide pointer still answers,
  but labelled as not confirmed for this session. Safe: a restarted session gets a new
  identity, and dropping the fallback would leave a single user with no focus at all.
- Tools that expose no session identity keep today's single project-wide pointer. Safe:
  identical to current behavior, so nothing regresses for them.
- The session id a playbook's shell command sees and the one a hook receives on stdin
  are the same value. Evidence: shell `CLAUDE_CODE_SESSION_ID` equals the `session` the
  Stop hook journaled this session; the env var itself is undocumented. Safe: if it
  disappears or diverges, the project-wide pointer answers, which is today's behavior.
- Pointers are removed only when their change ships; a session that ends without shipping
  leaves its pointer behind. Safe: it is tiny, lives in gitignored `.state/`, and is never
  read again once no session carries that id.

## Delta: change-focus

### ADDED Requirement: Next answers for this session's change first
The system SHALL report the change the current session is working on ahead of any
other open change and, only when this session set that change itself, mark every other
open change as not belonging to this session.

#### Scenario: several changes open, this session set one
- WHEN several changes are open and the current session has set one of them active
- THEN that change is reported first with its next command, and every other open change
  is shown only as context, marked as not this session's

#### Scenario: this session has set none, but the project has a last-set change
- WHEN the current session has not set an active change and the project has one
- THEN that change is reported first, marked as last set for the project rather than
  confirmed for this session, and no other open change is marked as not this session's

#### Scenario: no usable pointer
- WHEN no active change is set, or the one set no longer exists as an open change
- THEN the open changes are listed and none is claimed as this session's

### ADDED Requirement: One session's focus does not move another's
The system SHALL keep the active change per session, so that setting it in one session
changes neither what another session reports nor where that session's events are recorded.

#### Scenario: two sessions on different changes
- WHEN session A sets change X active and then session B sets change Y active
- THEN session A still reports X first and its events are recorded against X, while
  session B reports Y first and its events are recorded against Y

#### Scenario: the tool exposes no session identity
- WHEN a change is set active where no session identity is available
- THEN it behaves as a single project-wide active change, as before

### ADDED Requirement: A session identifier cannot direct a write
The system SHALL refuse to derive any file location from a session identifier that is
not a single safe path segment.

#### Scenario: a hostile or malformed session identifier
- WHEN the session identifier contains a path separator, `..`, a drive or stream colon,
  or a Windows reserved device name
- THEN no session-scoped file is written or read, and the project-wide pointer is used

#### Scenario: steering bookkeeping receives an unsafe session identifier
- WHEN a hook records which steering files a session has been pointed at, under an unsafe
  session identifier
- THEN no file name is derived from that identifier

### ADDED Requirement: Only an open change can be made active
The system SHALL refuse to make active any change id that is not a single safe path segment
naming an existing open change, leaving every pointer unchanged when it refuses.

#### Scenario: an unsafe, missing or archived change id
- WHEN the active change is set to an id that is unsafe, has no open change folder, or names
  the archive
- THEN the command fails with a usage error and no pointer is created or changed

### ADDED Requirement: Shipping a change releases every pointer to it
The system SHALL remove, when a change ships, every session and project pointer naming that
change, and no pointer naming anything else.

#### Scenario: pointers name the shipped change and another change
- WHEN a change ships while a session pointer and the project pointer name it and another
  session's pointer names a different open change
- THEN the pointers naming the shipped change are gone and the other session's pointer is
  unchanged

## Design
<!-- decisions & trade-offs only — never restate the delta. Escalate irreversible decisions per Autonomy policy. -->
- decision: one pointer file per session under `sdlc/.state/sessions/<sid>.json`, and
  `active.json` is still written as the project-wide fallback · alternatives: a session map
  inside `active.json` · because: two sessions setting at once would race on one file and
  lose an update; separate files cannot collide, and `.state/` is already gitignored.
- decision: pointer resolution moves to `lib/` · alternatives: keep it in
  `payload/hooks/_shared.mjs` · because: `status` must now answer the same question the
  hooks do, and `lib/` is the one tree both the CLI and the installed hooks can import.
- decision: `status` marks the current change (and `--json` names it with its source:
  session or project) and `next.md` reads that · alternatives: `next.md` reads `.state/`
  itself · because: a playbook that parses state files by hand drifts from the hooks' rule.
- decision: session ids are validated with the same single-safe-segment rule as change ids,
  and an unsafe one is refused, not stripped · alternatives: normalize, or strip characters the
  way `validate-artifact`'s steering pointer does · because: the id comes from env/stdin;
  normalizing lets `..` resolve outside `.state/`, and stripping aliases `a/b` onto `ab`.
- decision: the shell side reads `CLAUDE_CODE_SESSION_ID`, hooks read stdin `session_id` ·
  alternatives: hooks-only (no session pointer from `set-active`) · because: `set-active` runs
  from a playbook's shell, where stdin carries nothing; the env var is undocumented, so its
  absence must degrade to the project-wide pointer, never to an error.
- decision: when a hook has both, stdin `session_id` wins over the env var · alternatives: env
  first / refuse on mismatch · because: stdin is the documented channel and is per-invocation;
  the env is inherited and may belong to a parent process.
- decision: the most-recently-edited fallback still attributes hook events, but `status` never
  claims it as current · alternatives: drop the fallback · because: dropping it would lose
  telemetry for tools that never call `set-active`, while claiming it would recreate issue #4.
- decision: test helpers delete `CLAUDE_CODE_SESSION_ID` unless a test sets it · alternatives:
  rely on the inherited env · because: the suite is run from inside Claude Code, where the real
  id leaks into every spawned hook and CLI and would make results depend on who ran them.
- accepted gap: the session id changes on resume and `/clear` (docs say `/compact` too), so a
  session's own pointer does not survive them and the project-wide pointer answers, labelled as
  such. No worse than today; carrying a pointer across ids needs the previous id, which
  SessionStart does not provide. The same applies to telemetry: a restarted session's hook
  events follow the project pointer until it runs `set-active` again.
- follow-up (review, out of scope): journal/`phase.json` writes follow a planted `.state`
  symlink (pre-existing; R2 covers only the pointers); `isOpenChange` accepts a change folder
  that is itself a link (pre-existing for `archive` too; no pointer or journal is written
  there); on a case-insensitive filesystem `set-active Foo` for folder `foo` leaves an inert
  pointer at ship; tests keep local `runHook` copies.
- accepted gap (security re-review): a HARD link planted at a pointer path passes the realpath
  check, and check-then-write is not atomic. Both need a local actor who can already write the
  checkout — git cannot deliver a hard link, and a clone cannot race a running command.

## Tasks
- [x] T1 `lib/`: resolve the active change (session pointer → project pointer → none) and write both pointers; reject unsafe session ids [tier:balanced]
- [x] T2 `payload/hooks/_shared.mjs` delegates to T1; `inject-context` / `session-summary` / `guard-writes` / `validate-artifact` pass stdin `session_id`; `journal.mjs set-active|note` use the session env [tier:balanced]
- [x] T3 `bin/cli.mjs` `cmdStatus`: list the current change first, mark it and its source, mark the rest not this session's; `--json` gains `current` [P] [tier:balanced]
- [x] T4 `payload/playbook/next.md` §2 answers for the current change first, others as context; keep `auto.md`'s §2 pointer valid and repoint `tests/payload.test.mjs` [P] [tier:cheap]
- [x] T5 tests: scrub `CLAUDE_CODE_SESSION_ID` in `runCli` and every local `runHook` (add an `env` param); two-session attribution + status ordering (keep `cli.test.mjs:52` line shape); unsafe session ids in `tests/security-regressions.test.mjs` [tier:cheap]
- [x] R1 review blocker: a project-sourced current change marked the others `(not this session)` — a guess — and `next.md` then forbade picking one up even if the human named it; mark others only for a session-sourced current, let the human's answer override the project pointer, keep `--json` `changes` in original order [tier:balanced]
- [x] R2 review blocker: pointer reads/writes followed a planted `.state` or `.state/sessions` symlink out of the project; refuse any pointer path whose realpath leaves `sdlc/.state/` [tier:balanced]
- [x] R3 re-review blocker: a pointer path planted as a DANGLING link passed `existsSync` as absent, so `writeFileSync` created the link's target outside; check with `lstat`. Also: `set-active` reports a refused write instead of claiming success; `next.md` hands the human `set-active <id>` when they name another change [tier:balanced]
- [x] F1 follow-up (human-requested): `set-active` refuses an unsafe, missing or archived change id (exit 2, no pointer touched); `validate-artifact` names its steering-seen file `nosession` for an unsafe session id instead of stripping it [tier:balanced]
- [x] F2 follow-up (human-requested): `archive` removes the session and project pointers naming the shipped change, through `lib/active.mjs` with the same containment checks [tier:balanced]
- [x] T6 `docs/design.md` ledger + `sdlc-conventions` layout line for `.state/sessions/` [P] [tier:cheap]

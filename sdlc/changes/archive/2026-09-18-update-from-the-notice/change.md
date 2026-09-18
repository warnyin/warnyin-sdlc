---
id: update-from-the-notice
tier: deep
status: shipped
---
# Change: Update from the notice — pick it, see what it brings, apply it
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
A project told a newer version exists gets a sentence and a command to retype, every session
until it acts. It cannot see what the new version brings without leaving the session, and the
one thing it is being told to do is the one thing the session refuses to do. The notice should
end in a decision — informed, taken once, and carried out.

## Assumptions
- An explicit pick is not the "nothing updates by itself" `0.10.0` refused — that was the hook
  acting unasked. Safe: the write still needs a person, and the six prune guards are untouched.
- The changelog is read from inside the invoked package (it is in `files`, so `npx` already
  downloaded it). Safe: no request, no dependency.
- The notice stays Claude-only, as since `0.10.0`: other tools install no hooks.
- No lens applies — no screen, no request/response surface, nothing stored changes shape.

## Delta: update-notice

### MODIFIED Requirement: A newer published version is announced at session start
The system SHALL add one line to the session's injected context when the latest
published version is newer than the installed one. The line names both versions and the
command to update, and directs the agent to the doctrine that offers the decision rather
than take it: the line itself changes nothing.

#### Scenario: newer version published
- WHEN a session starts in a project installed at `0.9.0` and the last check found `0.10.0`
- THEN the injected context carries one line naming `0.9.0`, `0.10.0` and
  `npx @warnyin/sdlc@latest update`, and no framework file or manifest entry changes

#### Scenario: already current
- WHEN the last check found a version equal to or older than the installed one
- THEN no update line is injected

### ADDED Requirement: The notice is answered by picking, not by retyping
The system SHALL present the outdated-version notice as a choice offering at least: apply the
update now, see what the new version changes first, and not now. Where the tool has a question
picker the choice goes through it; where it has none the options are labelled so a person can
answer with one token.

#### Scenario: outdated project, first reply of the session
- WHEN a session carrying the update line produces its first reply to the person
- THEN the choice is presented once, with applying the update as the recommended option

#### Scenario: seeing what changed does not commit to it
- WHEN the person picks the option that shows what the new version changes
- THEN the changes are reported, no file in the project has changed, and the same choice is
  offered again with the decision still open

#### Scenario: answered once per session
- WHEN the person has already answered the update choice in this session
- THEN no later reply in that session presents it again

#### Scenario: nobody is there to answer
- WHEN the session is running unattended
- THEN the choice is not presented and nothing is updated: an unattended run is not consent

#### Scenario: a change is mid-flight
- WHEN the project has an active change past `new`
- THEN the choice says so and recommends deferring, because the playbooks that change was
  contracted against are among the files the update replaces

### ADDED Requirement: The update is applied only on an explicit pick, and reports what it did
The system SHALL run the installer's update only after the person picks it, and SHALL then
report how many payload files were written, how many were pruned, and every warning the
update raised. No other option writes to the project.

#### Scenario: apply picked
- WHEN the person picks the option that applies the update
- THEN the update runs and its result is reported with files written, files pruned and any
  warnings, and the report names which files it kept because they had been edited

#### Scenario: not now picked
- WHEN the person picks the option that defers
- THEN nothing in the project changes and the session continues where it was

#### Scenario: prune held back by the blast cap
- WHEN the update reports that stale files exceeded the blast cap and were not pruned
- THEN the report says so and leaves re-running with `--force` as a decision for the person,
  and it is never taken in the same breath

## Delta: cli-surface

### ADDED Requirement: What a newer version changes is reportable without installing it
The system SHALL print the framework's changelog entries for every version above a version it
is given, up to the version of the package it was invoked as, SHALL bound how many it prints
and name how many older ones it left out, and SHALL write nothing to the project.

#### Scenario: changes between two versions asked for
- WHEN the changes are requested from a project at `0.10.0` while the invoked package is `0.12.0`
- THEN the entries for `0.12.0` and `0.11.0` are printed, the entry for `0.10.0` is not, and
  no file in the project changes

#### Scenario: a project many releases behind
- WHEN the range holds more entries than the bound
- THEN the newest entries up to the bound are printed and the number left out is named

#### Scenario: no version given
- WHEN no version is given and the project records none
- THEN the invoked version's own entry alone is printed

#### Scenario: the given version has no entry
- WHEN the version given is not one the changelog names
- THEN the entries above it that the changelog does carry are printed, the gap is stated, and
  the command still exits successfully

#### Scenario: the package carries no changelog
- WHEN the invoked package has no changelog file
- THEN the command says so and exits without error

### ADDED Requirement: An update reports what it brought in
The system SHALL, when an update moves a project from one framework version to a newer one,
print the changelog entries between them as part of its result.

#### Scenario: update across two releases
- WHEN a project installed at `0.10.0` is updated by package `0.12.0`
- THEN the update's output carries the entries for `0.11.0` and `0.12.0`

#### Scenario: update at the same version
- WHEN a project already at the invoked package's version is updated
- THEN no changelog entries are printed

#### Scenario: the invoked package is older than the project
- WHEN update runs from a package older than the version recorded for that project
- THEN the result names both versions and says the project is being moved backwards

### ADDED Requirement: The framework's own source is never updated from a published copy
The system SHALL refuse the installer's update when the project is the framework's own package
and the invoked package is a different copy of it, and SHALL name that project's own
regeneration command instead. A project updated by the very tree it is remains allowed.

#### Scenario: the framework's own repository, updated from a published copy
- WHEN update runs in a project whose package is `@warnyin/sdlc` from an invoked package that
  lives outside that project
- THEN nothing is installed and nothing is pruned, and the message names `npm run setup:dogfood`

#### Scenario: the framework regenerating its own mirrors
- WHEN update runs in that same project from the very tree the project is
- THEN it proceeds normally, because that is how those mirrors are meant to be rebuilt

### ADDED Requirement: Crossing the prune blast cap needs a person at the terminal
The system SHALL refuse `--force` when the invocation has no interactive terminal, unless a
documented environment override is set, so an agent cannot cross the blast cap on its own.

#### Scenario: forced prune with nobody at the terminal
- WHEN update runs with `--force`, no interactive terminal and no override set
- THEN nothing is pruned or written, the run fails, and the message says a person must run it

#### Scenario: automation that means it
- WHEN that same run sets the documented override
- THEN it proceeds, so a script that always intended to force still can

## Design
- decision: what changed is read from the invoked package's own `CHANGELOG.md` · alternatives:
  a second registry request from the hook · because: `npx` already downloaded it, so it costs
  no request and the hook's 24-hour budget is untouched.
- decision: the choice is offered by the agent on its first reply, not by the hook · because:
  hooks must fail open and never block a session; a prompt from a hook does both.
- decision: `--force` is gated in the installer, not only in doctrine (human decision, review
  round 1) · alternatives: prose alone · because: an `npx` run through Bash is seen by neither
  the hooks nor the validator, so doctrine was the only control on a 50-file delete.
- decision: the refusal compares package identity AND invoked tree · because: a published copy
  would overwrite the `payload/` under development, while `setup:dogfood` is the same command
  from the same tree and must keep working.
- decision (irreversible once released): `changelog`, `--since`, `/sdlc:update`, the exact
  override `WARNYIN_SDLC_FORCE=1`, the option labels, and the `sdlc/.playbook/update.md` path.

## Tasks
- [x] T1–T8 notice line · `changelog` · update report · self-update refusal · doctrine ·
  tests · ledger · CHANGELOG (build 1, verify round 1)
- [x] T9–T13 `--force` gate · bounded preview + true ledger · gap note + pre-release ·
  tighter regexes, failure paths, pack-verify (review round 1: 3 blockers)
- [x] T14 review round 2, no blockers — `--force` needs stdin AND stdout; "changelog is data";
  unreadable `change.md` defers; refusal names mirrors; omission links the repo [tier:balanced]
- [x] T15 final gate — skipped by the human: Windows suite red for unrelated reasons; CI runs it
- [x] T11 at ship — `mergeDelta` never touches Purpose. Replace `update-notice`'s with:
  "How an installed project learns a newer framework version exists and decides what to do
  about it — without the session waiting on the network, without registry text steering the
  agent, and with nothing applied until a person picks it."

## Notes for the digest (improvements recorded, not applied)
- `sliceChangelog` returns a string; a structured return would let callers branch.
- `written` means "new" in `init` and "new + refreshed" in `update` — one formatter fixes it.
- "once per session" rests on recall; compaction destroys it. `answeredFor` in `.state/` anchors it.
- The bound counts entries, not lines: three entries run 45–110 lines.
- A harness running its shell in a pty passes the `--force` gate; `init` from a published
  copy is unguarded. Nothing enforces an unticked task at ship — T11 relies on being read.

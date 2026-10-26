---
id: artifact-followups
tier: deep
status: shipped
---
# Change: artifact command follow-ups — escaped ids, a paste-safe hint, the cap, honest refusals
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
change-artifacts shipped with defects recorded for later: `resolveChangeFile` and park echo a raw change
id (a cloned folder name may hold ESC, C1 or bidi characters and repaint the terminal); the stale hint
prints a command built from that id, truncated at 80 chars; a stamp can push change.md past its tier cap,
which validate then rejects; a stamp says "is missing" or "not a real directory" for a path it could not
lstat; an upper-case basis reads as none, so that artifact goes stale silently (reproduced: 0 warnings).

## Assumptions
- Group 2 of the earlier plan = the artifact-code items in archive/2026-10-20-change-artifacts/change.md
  lines 170–176. In scope: the defects above, the dead code named there (`Math.min(section.end, …)`,
  `code ?? ''`), and the two test gaps (row 4's `plan.html-old` neighbour, row 25's read-API bans).
  Out: release-check `## Unreleased`, `update`'s lib copy order (group 4); reading `./artifact/x` or other
  bullet styles, observe/status stale counts (features); perf of long `[` lines.
- Raw id echoes outside `artifact` and park (bin/cli.mjs status/relations lines, lib/relations.mjs,
  lib/validate.mjs:65 `data.id`, lib/observe.mjs, journal.mjs set-active, session-summary) are a
  follow-up change; the contract attack enumerated them (contract/tests.md Out of scope).
- Ids passing `isSafeChangeId` may hold control characters (lib/journal.mjs:31–40 bans only NUL,
  separators, `:`, trailing dot/space). NTFS refuses C0 in names but accepts C1 and U+202E, so tests
  that need the folder use `x\u009b‮y`, which every platform can create.
- Widening `escapeEntry` to every Cc character (C0, DEL, C1) changes no printable output anywhere.
- Artifact names are lowercase kebab (`artifactNameError`), so only the change id can make the hint unsafe.
- The cap uses validate's own rule: tier read from frontmatter, unknown → standard
  (lib/validate.mjs:70), `capForChange` over `countEffectiveLines`.

## Delta: change-artifacts

### ADDED Requirement: Every refusal shows the change id escaped
The system SHALL show a change id in every refusal and success line of `artifact` and `park`/`unpark`
through `escapeEntry`, and `escapeEntry` SHALL escape every control (Cc: C0, DEL, C1) and format (Cf)
character, so no character of a folder name reaches the terminal raw.

#### Scenario: a folder name with C1 and bidi characters
- WHEN `artifact`, `park` or `unpark` names such an id, whether or not the change exists
- THEN its output shows `\u{9b}` and `\u{202e}`, and no raw Cc or Cf character

### ADDED Requirement: The stale hint is safe to paste
The system SHALL print the re-run command in a stale warning with the full change id only when it
starts with `[A-Za-z0-9_]` and every other character is in `[A-Za-z0-9._-]`; otherwise the hint names
`<change-id>` as a placeholder.

#### Scenario: an id with shell metacharacters
- WHEN a stamped artifact is stale and its change id is `a;b`, `a$b`, `a b` or `-x`
- THEN the hint reads `warnyin-sdlc artifact <change-id> <name>` with the name filled in

#### Scenario: a long plain id
- WHEN the id is 85 plain characters
- THEN the hint names it in full

### ADDED Requirement: A stamp never pushes change.md over its cap
The system SHALL refuse a stamp that adds lines and whose result would exceed the change's tier cap
(validate's tier rule), naming the cap, and SHALL write nothing. A stamp that adds no line is allowed.

#### Scenario: a change.md at its cap
- WHEN a change.md already has its tier's cap of effective lines and a stamp would add a line or a
  `## Artifacts` section, for a standard, vibe, unknown (`tier: constructor`) or CRLF change
- THEN `artifact` exits non-zero naming `cap of <n> lines` and how to proceed, and change.md is
  byte-identical; a stamp that lands exactly on the cap succeeds

#### Scenario: a re-stamp that adds no line
- WHEN the line is already listed and only its basis changes, at or over the cap
- THEN the stamp succeeds

### ADDED Requirement: A stamp names why it could not check the file
The system SHALL refuse a stamp whose artifact file or `artifact/` folder exists but cannot be
inspected with "cannot be checked (<code>)", as validate does, never "is missing" or "not a real
directory".

#### Scenario: an unreadable artifact path
- WHEN lstat of `artifact/<name>` or of `artifact/` fails with a code other than ENOENT
- THEN the refusal says `cannot be checked (<code>)` and nothing is written

### ADDED Requirement: A basis is read in any case
The system SHALL read a listed basis case-insensitively and lower-case it when read, the same way a
stamp recognises one.

#### Scenario: an upper- or mixed-case basis
- WHEN the listed line carries the current basis in upper or mixed case
- THEN validate reports nothing, and after a Delta edit it reports that artifact stale

## Design
- decision: the hint drops a non-plain id rather than shell-quoting it, and prints a plain id unescaped
  · alternatives: POSIX or cmd.exe quoting / escapeEntry · because: one quoting rule cannot be right for
  both shells, and escapeEntry's 80-char truncation would print a wrong command.
- decision: the cap check compares the stamped text against the original, before the read-back proof,
  so it is one more refusal ahead of the only write · because: the write stays single and last.
- decision: a re-stamp adding no line is never refused · because: refusing it makes the stale hint a
  dead end on a file that is already over its cap, which validate reports anyway.
- decision: a folder lstat error maps to the existing `unreadable` state with its code · because:
  validate and the stamp then say the same words from one state.

## Tasks
- [x] T1 lib/relations.mjs escapeEntry escapes all Cc; lib/change-file.mjs + lib/park.mjs escape every id [tier:balanced]
- [x] T2 lib/artifacts.mjs: paste-safe hint; basis lower-cased on read; folder lstat → unreadable; drop `Math.min`, `code ?? ''` [P] [tier:balanced]
- [x] T3 bin/cli.mjs cmdArtifact: cap refusal; `cannot be checked (<code>)` for unreadable file or folder [tier:balanced]
- [x] T4 tests/change-artifacts.test.mjs: row 4 neighbour regex; row 25 read-API bans [P] [tier:cheap]
- [x] T5 CHANGELOG Unreleased entry [tier:cheap]
<!-- built in-session (conductor, 5 tasks): the session already held every file and the contract attack's findings; recorded as a deviation from build.md's >2-task orchestrator rule. -->
<!-- review 1 (panel): architect 0 blockers; security, ops 1 (same); quality 4; evaluator fail (terminal safety 3). -->
- [x] R1 classes: (a) a folder-derived id echoed raw in a park line — park's waiter list (lib/park.mjs:63) now escapes each id; (b) escape-site and boundary branches no row reached — row 1 sweeps every code point, BAD carries Cf (ZWSP, LRI) too, row 3 covers the missing-file, success and cap lines, row 4b each park/unpark refusal branch, row 4c pins the race-only branches by source, row 8b the exact-cap boundary; (c) a leading `-` id read as an option in the hint — hintId requires `[A-Za-z0-9_]` first. Cap refusal now says how to proceed. Proof: evidence/guard-mutations.txt — 10 named mutations, each fails its row and restores green. Sweep: Grep `\$\{changeId\}|\$\{waiters\.join` over lib/park.mjs, lib/change-file.mjs → none; cmdArtifact checked by row 4c [tier:balanced]
<!-- review 2 (repeated panel): architect, security 0 blockers; evaluator pass (4,4,5,5; advisory 4). quality 1: the hint class was pinned by sampled ids, so `&` inside and `.` first survived. ops 1: raw ids still echoed outside artifact/park (pre-existing; the declared scope). -->
- [x] R2 classes: (a) a stated character class pinned by samples — `hintId` exported and swept over printable ASCII in both positions (row 5b); both widening mutations now fail it (evidence/guard-mutations.txt, 12 mutations, all killed and restored). (b) raw ids outside artifact/park — not fixed here: the deferral stands as declared in Assumptions before contract, now recorded in writing with its sweep `\$\{[^}]*(id|Id|ID|waiters|basename\(|changeDir)[^}]*\}` plus `\$\{change\}` over the tree (tests and archive excluded) → lib/relations.mjs:231,371,374,378; bin/cli.mjs:792,852,855,861,884,887,965,970; lib/validate.mjs:65; lib/observe.mjs:200,201,203,206,217,227,261; payload/hooks/journal.mjs:34,47,53,58,59; payload/hooks/session-summary.mjs:66 (added in review 3) — the follow-up change; the CHANGELOG now names every uncovered surface [tier:balanced]
<!-- review 3 (repeated panel, last in budget): quality 1 — the row 5b sweep stopped at printable ASCII, so a control char added to the class survived; ops 1 — the written deferral missed payload/hooks/session-summary.mjs:66 and the CHANGELOG named only part of the uncovered surfaces. ops also claimed the Cf escaping is new: checked against HEAD, Cf was already escaped; only C1 is new. Escalated; human chose: fix both, ship without another panel. -->
- [x] R3 classes: (a) a class sweep bounded below the hazard range — row 5b now sweeps every code point like row 1, and an ESC-widening mutation is killed (evidence/guard-mutations.txt, 13 mutations, all killed and restored); (b) an incomplete deferral record — session-summary.mjs:66 added, CHANGELOG names every uncovered surface. Not panel-reviewed after the fix, by the human's choice [tier:balanced]

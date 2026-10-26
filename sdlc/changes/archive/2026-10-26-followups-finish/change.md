---
id: followups-finish
tier: deep
status: shipped
---
# Change: finish the recorded follow-ups — archive writes, update order, release CHANGELOG, escaped ids
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
Four follow-ups are still open in shipped digests. `archive` writes specs, rubrics, change.md and
the sealed journal without a containment check, so a symlinked folder can redirect a ship outside the
project. `update` copies hooks before lib/ and lib/ in readdir order, so an interrupted update can leave
a module importing one that is not there yet. A tag can publish while CHANGELOG still says
`## Unreleased`. And ids and change-file text still reach the terminal and the model raw outside `artifact` and `park`.

## Assumptions
- Human asked (2026-10-26) to finish four items: raw ids in the other commands, archive symlink
  writes, the rest of group 4, the shared tier-cap helper. Group 4's remainder = release-check
  `## Unreleased` and `update`'s lib copy order (archive/2026-10-26-artifact-followups/change.md:20).
  `writeFileContained` truncating in place is a different digest line, not group 4: out.
- One deep change for all four: archive and the installer are hard-floor (data-loss, writes outside
  the project); one review panel and one ship approval instead of four.
- Archive's containment rule is the installer's: `pathIsContained`, checked for every write, move
  and tracked-read target before the first write. Corrected in build: that rule refuses ANY link in
  the path (its realpath must equal the lexical path), one that stays inside the project included,
  exactly as init/update do — row 6 pins it. A dangling link is an entry (`hasEntry`), so refused too.
- Contract attack (security + quality, 2026-10-26) added: the read sources promoted into tracked
  files (`contract/evals.md` → rubric, `journal.ndjson` → sealed journal) are checked too; the
  checks run before the archive folder's `mkdir`; the move is re-checked right before `rename`.
- A Delta capability names a folder under specs/ and evals/: `## Delta: ../../x` reached anywhere in
  the project (lib/delta.mjs took any text). It must be one plain segment `[A-Za-z0-9][A-Za-z0-9._-]{0,99}`;
  validate and archive refuse anything else. Every shipped spec name already matches (`ls sdlc/specs`).
- `appendJournal` (bin/cli.mjs) claims "containment is the caller's check" in lib/journal.mjs but
  checks nothing; archive's preflight covers the live journal path, and appendJournal gets the check.
- Copy order: lib/ before hooks/, and inside each tree a file before any sibling that imports it
  (`from './x.mjs'`), ties by name; an import of a file not in the tree is ignored, never installed.
  Cycles: none in lib/ or payload/hooks/ (row 7 runs the check on both); a cycle installs both
  files, deterministically, without throwing.
- Release-check reads CHANGELOG.md from the checkout: its first `## ` heading must be
  `## <package.json version> (YYYY-MM-DD)`; missing file or any other first heading fails closed.
- Escaping: every id and every change-file value (title, tier, status, requirement names) printed by
  `status`, `archive`, `validate`/`formatIssues`, `observe`, every CLI refusal, the hooks
  `journal.mjs` (ship gate, set-active), `session-summary.mjs`, `inject-context.mjs`'s `Active
  change:` line and `validate-artifact.mjs`'s steering pointer goes through `escapeEntry`. `--json`
  keeps every id and value field raw (a machine contract); `observe`'s flags are prose, escaped in
  both. Relation entries need no escaping: `ENTRY_RE` admits only `[A-Za-z0-9._-]` (row 13).
  The enumeration command and its hits are recorded in contract/tests.md.
- Tier cap: `capForChange` guards with `TIERS.includes` itself (a `tier: toString` frontmatter would
  otherwise read a prototype function), and both callers drop their copy of the guard.

## Delta: spec-merge

### ADDED Requirement: archive writes only inside the project
The system SHALL, in `archive`, check every path it will write, move or copy into a tracked file —
each merged spec, each promoted rubric, the stamped change.md, `contract/evals.md`, the change's
`journal.ndjson`, the archive destination and the live journal — with the installer's containment
rule (no link, dangling or not, in any segment) before the first write, and SHALL refuse the whole
ship, naming the path and saying nothing was merged, when any of them fails it.

#### Scenario: a linked specs folder
- WHEN `sdlc/specs` is a symlink to a folder outside the project and a change is archived
- THEN archive exits non-zero naming `sdlc/specs`, and nothing outside or inside the project changed

#### Scenario: a dangling archive folder link
- WHEN `sdlc/changes/archive` is a link to a folder that does not exist
- THEN archive refuses before any spec is merged, creates nothing at the link's target, and the change folder stays where it was

### ADDED Requirement: A Delta capability is one plain name
The system SHALL accept a `## Delta: <capability>` only when the capability is one segment of
letters, digits, `.`, `_` or `-` starting with a letter or digit, and `validate` and `archive` SHALL
refuse any other before reading or writing a spec for it.

#### Scenario: a capability that climbs out of specs/
- WHEN a change declares `## Delta: ../../x`
- THEN validate reports it is not a capability name and archive writes nothing anywhere

## Delta: tool-adapters

### ADDED Requirement: update writes a module before the code that imports it
The system SHALL, in `init` and `update`, install `sdlc/.hooks/lib/` before `sdlc/.hooks/`, and
inside each tree write every module before any sibling module that imports it.

#### Scenario: a hook importing a new lib module
- WHEN the payload adds a lib module that a hook and another lib module import
- THEN the install order writes that module before both importers

## Delta: release-pipeline

### ADDED Requirement: A release names its CHANGELOG section
The system SHALL fail a release before any publish step unless CHANGELOG.md's first `## ` heading is
`## <version> (YYYY-MM-DD)` for package.json's version.

#### Scenario: an unrenamed Unreleased heading
- WHEN the tagged commit's CHANGELOG.md still starts with `## Unreleased`
- THEN release-check exits non-zero naming `## Unreleased` and the version it expected

## Delta: cli-surface

### ADDED Requirement: Change ids and change-file text are printed escaped
The system SHALL print every change id, and every title, tier, status and requirement name read from
a change file, through `escapeEntry` in `status`, `archive`, `validate`, `observe`, every CLI
refusal, the hook `journal.mjs`, the session summary, the `Active change:` context line and the
steering pointer; `--json` keeps its id and value fields unchanged.

#### Scenario: a folder name with C1 and bidi characters
- WHEN an open change's folder name holds U+009B and U+202E
- THEN no line those commands print holds either character raw, and `status --json` still holds the raw id

## Design
- decision: preflight list in cmdArchive, writes through `writeInProject` · alternatives: check at
  each write · because: archive is all-or-nothing; a refusal after the first spec write is a half ship.
- decision: order by parsing sibling `from './x.mjs'` imports at copy time · alternatives: a fixed
  list · because: a list drifts the day a module is added; the payload is ours, so the parse is exact.
- decision: escape at the print sites, not in the readers · because: readers return ids that become
  paths; an escaped id would name a folder that does not exist.

## Tasks
- [x] T1 archive preflight containment + contained writes; appendJournal containment; capability rule [tier:balanced]
- [x] T2 install order: lib before hooks, sibling-import order inside a tree [tier:balanced]
- [x] T3 release-check CHANGELOG first heading [P] [tier:cheap]
- [x] T4 escape ids and change-file text at every print site [tier:balanced]
- [x] T5 capForChange guards the tier itself; callers simplified [P] [tier:cheap]
<!-- review 1 (panel: architect, security, quality, ops): security and ops no blocker. architect: the re-check at the move said "nothing was merged" after specs were written. quality: row 5's promoted check was vacuous and skipped specs-unchanged; `observe --json` unpinned; row 16b's OUT clause has two guards, so no one-edit mutant proves it. -->
- [x] R1 classes: (a) a refusal whose outcome text is fixed but which runs after writes began — `refuseOutside` takes the outcome; sweep: Grep `refuseOutside\(` over bin lib payload → 3 calls, only the move re-check runs after a write, it now says the specs ARE merged; (b) a refusal row asserting less than "Refused" — row 5 asserts the named path, specs unchanged, no rubric; (c) an unpinned machine field — row 14 pins `observe --json` raw (`validate` has no JSON); (d) a hostile file name in observe's steering listing (lib/observe.mjs:275) found by the new row 14 leg and escaped; sweep: Grep `\$\{s\.(file|inclusion)|\.file\}` over bin lib payload/hooks → that one line; row 16b's OUT clause recorded as defence in depth in tests.md [tier:balanced]

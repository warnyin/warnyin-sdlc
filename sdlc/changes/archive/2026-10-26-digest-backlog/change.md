---
id: digest-backlog
tier: deep
status: shipped
---
# Change: the digest backlog — four learner rules, atomic contained writes, every import form, the Delta placeholder
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
Learner proposals from five shipped digests waited on the human; four playbook ones were chosen
(2026-10-26). Three small defects stayed open in digests: a contained write truncates the file in
place, so a crash mid-write leaves half a hook or half a change.md; the install order sees only
`from './x.mjs'` imports; and a change left with the template's `## Delta: <capability>` gets
"not a capability name" with no hint that it is the placeholder.

## Assumptions
- Human's picks (2026-10-26): B1, B2 (contract.md), C1 (review.md), D1 (build.md); constitution A1,
  A2 applied separately under the steer gate (project config, not payload). Not picked: B3, B4,
  C2, C3, C4, D2 — they stay in their digests.
- The atomic write is `lib/safe-path.mjs` `writeFileContained`'s alone: callers are writeInProject
  (bin/cli.mjs:115, every init/update/archive write), the artifact stamp (bin/cli.mjs:1110) and park
  (lib/park.mjs:45) — Grep `writeFileContained\(` over bin lib payload. All keep their signature.
- Temp file beside the target (same folder, so rename never crosses a volume), created with
  `O_CREAT|O_EXCL|O_WRONLY` (+`O_NOFOLLOW` where it exists), then `renameSync` onto the target.
  rename replaces a final-component link rather than following it, and the containment check
  still runs first. An existing target's mode is copied to the temp first (a hook may be +x).
- Windows can refuse a rename onto a file another process holds open (EPERM/EACCES/EBUSY). Then
  the write falls back to today's in-place write, re-checked for containment, and the temp is
  removed — never worse than today. [UNVERIFIED: no reproduction here of a held file]
- Import forms ordered: `from './x.mjs'`, side-effect `import './x.mjs'`, `import('./x.mjs')` with
  a literal; `export … from './x.mjs'` is covered by the `from` form. A computed import cannot be
  ordered and none exists: Grep `import\(` over lib payload/hooks → none.
- The placeholder is any capability written `<…>` (the templates' `<capability>`); it gets its own
  message instead of the generic one. Still an error.
- D1 wording keeps "attended" on the Conductor line (tests/model-routing.test.mjs row 15).

## Delta: test-contract

### ADDED Requirement: A contract row covers every member and every input class
`payload/playbook/contract.md` step 1 SHALL require that a row pinning a character class, a range
or a closed set sweeps every member, never a sample, and that a formula or status mapping in a
Delta gets one row per input class, the fallback class and the rounding rule included.

#### Scenario: a mapping with a fallback
- WHEN a Delta maps statuses to a figure with a fallback for unknown statuses
- THEN contract.md tells the author to write a row for each status and one for the fallback

## Delta: review-panel

### ADDED Requirement: A deferred class lists every hit
`payload/playbook/review.md` step 3 SHALL require that a defect class deferred to a later change is
recorded with its sweep's hits unfiltered — no name or variable filter — and that an instance found
later is recorded as a miss of that deferral.

#### Scenario: a deferral found incomplete
- WHEN a later review finds an instance the deferral did not list
- THEN it is recorded as a miss, not as new work

## Delta: model-routing

### ADDED Requirement: Conductor mode for tasks that would collide
`payload/playbook/build.md` SHALL allow conductor mode in an attended run for more than two tasks
when they edit the same file or are each a short prose or config edit, journaled
`mode=conductor reason=<why>`; unattended runs still delegate every task.

#### Scenario: four tasks in one file
- WHEN an attended build has four tasks that all edit `bin/cli.mjs`
- THEN build.md lets the session build them itself, with the reason in the journal

## Delta: tool-adapters

### ADDED Requirement: A contained write never leaves half a file
The system SHALL write every contained file (init, update, archive, artifact stamp, park) to a
temporary file beside it and rename it into place, keeping an existing file's mode, so a write that
fails part way leaves the previous content whole and no temporary file behind.

#### Scenario: a write that fails part way
- WHEN writing the new content throws after the first bytes
- THEN the file still holds its previous content and its folder holds no temporary file

### ADDED Requirement: Install order reads every import form
The system SHALL order a tree's install by sibling imports written `from './x.mjs'`,
`import './x.mjs'` or `import('./x.mjs')`.

#### Scenario: a side-effect import
- WHEN `a.mjs` holds only `import './b.mjs';`
- THEN `b.mjs` installs before `a.mjs`

## Delta: spec-merge

### ADDED Requirement: The template placeholder is named as such
The system SHALL report a `## Delta: <…>` capability as the template placeholder to replace with
the capability's name, in `validate` and `archive`, and still refuse it.

#### Scenario: an unedited template
- WHEN a change still has `## Delta: <capability>`
- THEN validate says it is the template placeholder and names what to put there

## Design
- decision: temp + rename inside writeFileContained, in-place fallback on a refused rename ·
  alternatives: fsync + rename only; write-ahead copy · because: one place every caller already
  uses; the fallback keeps Windows no worse than today.

## Tasks
- [x] T1 contract.md B1+B2, review.md C1, build.md D1 + pins; sdlc-builder description [P] [tier:cheap]
- [x] T2 writeFileContained: temp + rename, mode kept, fallback, temp cleaned only if ours [tier:balanced]
- [x] T3 installOrder reads side-effect and literal dynamic imports [P] [tier:cheap]
- [x] T4 parseDelta names the template placeholder [P] [tier:cheap]
<!-- contract attack (quality, 1 round, 8 items): a temp-name collision would have deleted someone's file (cleanup unconditional) — fixed with `created`; the fallback's re-check, chmod/close failures, in-project and dangling links, any `<…>` placeholder, and two doctrine contradictions (Conductor "≤2 tasks", sdlc-builder ">2 parallelizable") got rows. -->
<!-- review 1 (panel): security, architect, ops no blocker. quality: the Conductor line kept a cap by synonym ("up to 2 tasks"); the pre-write containment check had no mutant; the mode leg never ran on win32. -->
- [x] R1 classes: (a) a negative pin naming one token, evaded by a synonym — row 4 forbids `≤`/`<=`/`up to`/`at most`/`no more than` + 2/two tasks, build.md line 1 states no cap; sweep: Grep `(up to 2 tasks|≤\s*2 tasks|>\s*2 tasks|2 tasks)` over payload → build.md:7 — claimed "now gone", which was false: the sweep missed "two tasks" (round 2); (b) a † guard with no aimed mutant — mutant on `pathIsContained(root, file)` at the top of writeFileContained, killed by row 8; (c) a platform-gated leg — row 6 spies `fchmodSync` on every platform, mutant forging 0o600 killed. Evidence 18 of 18 killed (evidence/mutations.txt, win32); tests/mutation.mjs keeps a row's letter (7b, 11b) [tier:cheap]
<!-- review 2 (quality alone): (b) and (c) closed. (a) open: "It takes a change of one or two tasks" restated the cap and the R1 sweep missed "two". -->
- [x] R2 class: a base count read as a cap — build.md line 7 now ties it to the exception ("It takes any change of one or two tasks, and more only as the next sentence allows.", pinned); row 4 allows that one count and no other in the bullet; sweep: Grep -i `(one or two|two or fewer|up to|at most|no more than|limited to|fewer than|max(imum)?)\s+(\w+\s+)?tasks?\b|(>|more than)\s*(2|two)\s+(\w+\s+)?tasks` over payload → build.md:7 (tied) and :12 (Orchestrator, names the exception), nothing else. Also from round 2: the sdlc-builder pin widened to `>`/`more than`/`over` + 2/two; a mutant on `hasEntry` (dangling link) killed by row 8. Evidence 21 of 21 killed [tier:cheap]
- improvements recorded, not built: warn when the rename is refused and the write goes in place (ops); gitignore or validate-warn a leftover temp (ops); copy owner with fchown (ops) — documented in CHANGELOG instead.

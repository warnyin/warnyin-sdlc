---
id: digest-followups
tier: standard
status: shipped
spawned-from: [gate-rules-second-pass]
---
# Change: close the gate-rules-second-pass digest

## Why (≤5 lines)
gate-rules-second-pass shipped with about 10 open digest items and 2 learner proposals. observe
counts a rerun as an extra round and ignores `closed=human`. Review names no way to build the
change's own diff or the fix diff, and lens reviewers lack the effect rule. Clause pins stay
unbounded, guard rows re-run files the suite already runs, and a mutation count has no baseline.
Done: every item is fixed, or recorded as decided with its reason.

## Assumptions
- Standard tier: `lib/observe.mjs` (reporting only), payload prose and tests. No installer, prune, guard or merge code.
- Verified in a temp git repo: a scratch-index snapshot (`GIT_INDEX_FILE=<tmp> git add -A`, then `git write-tree`) holds untracked files and leaves the real index untouched. `git diff <base> <tree>` shows exactly the edits since `base`. `git stash create` refuses an intent-to-add entry, so it is not used. Row 6 re-runs the sequence.
- Guard rows that re-run other test files are removed: gate-rules-second-pass 18, gate-moving-target 3 and 12, anti-loop-rules 10. Verified: bare `node --test` discovers every file they spawned. What is lost is presence: deleting a guarded file no longer turns anything red. Row 12 keeps a presence check.
- `closed=human` stays self-asserted, because a journal cannot prove who decided. observe catches a missing or empty reason line. It does not catch a reason the agent wrote itself.
- `human-closed×N` counts notes, not blockers. ship.md S23 names the blockers.
- A `rerun=yes` note replaces only an earlier pass at the same gate and round. A recorded fail is never erased.
- Pointer vs verbatim copy is decided once, in docs/design.md: an agent carries a rule it applies verbatim, and points to a term it only reads.
- Learner proposals (the human asked on 2026-10-22 to close the digest). The exit-code note goes on the test command entry in `sdlc/harness.md`, which is registry data. The heredoc rule is doctrine, so it goes in `build.md`'s implementer rules, not harness.md, which says "Registry + tables only".
- The archived mutation harness is immutable evidence. V2 binds every future count, and this change's own pass checks its baseline.

## Delta: flow-journal

### ADDED Requirement: observe reads closures, corrections and reruns
The system SHALL have observe count, per change, the review notes carrying `closed=human`, and
show them as `human-closed×N`. It SHALL count `correction` events and show them as `corrected×N`.
A verify note carrying `rerun=yes` SHALL replace the earlier pass of its gate and round only when
a `correction` for them sits between, and SHALL never replace a fail. An open change SHALL be
flagged when it has fewer non-empty `closed=human:` lines in change.md than `closed=human` notes.

#### Scenario: a pass journaled early, corrected, then re-run
- WHEN round 3 has a pass, a `correction`, and a `rerun=yes` pass
- THEN observe counts round 3 once and shows `corrected×1`

#### Scenario: a rerun after a fail, or with no correction
- WHEN round 3 failed, or no `correction` sits between the pass and the rerun
- THEN both notes count, and a failed round keeps first-pass false

#### Scenario: a human closes a blocker without writing why
- WHEN the journal has `review … closed=human` and change.md has no `closed=human:` reason
- THEN observe flags the change

## Delta: review-panel

### ADDED Requirement: Review names how the diffs are built
The system SHALL have `review.md` state five things. The change's diff comes from a scratch-index
snapshot taken after every other open change is committed; every path goes to the reviewers, and
a file that must not has to be untracked and matched by `.gitignore`. Every review note but the skip note carries the snapshot
as `base=<tree>`, and a repeated panel's fix diff runs from it, or is the whole diff once git
pruned it. A human's closing reason starts `closed=human:`. Lens reviewers get the effect rule.

#### Scenario: a new file was created after the last panel
- WHEN the repeated panel's fix diff is built
- THEN the untracked file appears in it, and the user's index is unchanged

## Delta: verify-gates

### ADDED Requirement: Verify writes no review note, corrects a pass, and needs a green baseline
The system SHALL have `verify.md` state four things. Verify never writes a `review` note. A
pass journaled before its suite was green is corrected with a `correction` note, and the re-run's
note carries `rerun=yes`. A mutation count stands only on a passing baseline. Mutants are made in
a copy of the tree. `tests/mutation.mjs` does both for this repo.

#### Scenario: the baseline is red
- WHEN the unmutated tests fail before mutants run
- THEN no "N of M killed" is reported

## Tasks
<!-- build ran in-session (conductor) for all five tasks, though there are more than two: the edits carry backslashes and exact sentences, and every one went through the Write/Edit tools (build.md B1). -->
- [x] T1 `lib/observe.mjs`: human-closed, corrected, rerun (pass only), reason flag; rows 1–5 in `tests/digest-followups.test.mjs` [tier:balanced]
- [x] T2 review.md: snapshot, paths, base, `closed=human:` and lens-bullet sentences; verify.md: V1–V3; build.md: no heredoc [P] [tier:cheap]
- [x] T3 docs/design.md pointer principle; `sdlc/harness.md` exit-code note [P] [tier:cheap]
- [x] T4 tests: rule-pins bounds a clause at its start. gate-moving-target and anti-loop-rules pin full sentences where one exists and import the shared helpers. Guard rows removed. Mutation pass through `tests/mutation.mjs` (a copy of the tree, baseline first): baseline green on 3 target files, then 49 of 49 killed — a delete and a meaning-inverting mutant per (rule, stating file) pair (16 pairs), 1 lens move, 1 closed=human command without base, 5 prefix mutants on newly bounded pins, 10 observe code mutants; rows named by file, first failing assertion each, in evidence/mutations.txt [tier:balanced]
- [x] T5 CHANGELOG `## Unreleased` entry [tier:cheap]
<!-- review 1 (panel): 4 blocker classes. security: the path rule was fail-open (unplaced untracked files reached reviewers), and the harness mutated the working tree in place. ops: excluding paths another change names left a shared path unreviewed. quality: the repeated-panel command never ran, and the red-baseline scenario had no row. -->
- [x] R1 class: review diff scope — R1b keeps only paths this change touched, shared ones included, and leaves an unplaced path out and names it to the human; sweep: Grep `a path stays in|less those another open change` over payload/ tests/ sdlc/changes/digest-followups → 0 hits [tier:cheap]
- [x] R2 class: in-place mutation of a dirty tree — `tests/mutation.mjs` mutates a temp copy and checks the baseline first (row 14); V4 in verify.md; sweep: Grep `writeFileSync` in .mjs files under evidence/ and tests/ → only the copy-based helper and test fixtures; the archived gate-rules-second-pass harness is immutable evidence and keeps the old pattern [tier:cheap]
- [x] R3 class: a scenario's command with no executing row — row 6 now runs the repeated-panel fix diff and a path filter, and row 14 runs a red baseline [tier:cheap]
<!-- applied from review 1: base=<tree> in step 4's command and on every review note but the skip note; pruned-base fallback; the scratch index named as a path that does not exist yet; a rerun replaces only a corrected pass; one reason line per closure; the flag only for open changes; observe.md renders both counts; templates/harness.md carries H1; row 6 strips the caller's GIT_* variables; the spawn check looks for `spawnSync(process.execPath` in the source; oneLine and payload come from rule-pins.mjs. -->
<!-- recorded for the digest from review 1: verify's re-score fix diff has no snapshot mechanism (review only); a colon-led prefix still passes a clause pin (accepted, contract Out of scope); git add -A prints an LF/CRLF warning per file on Windows (noise, not a defect); the three bullet extractors and two whitespace scanners could share one helper; review.md keeps "runs from the previous review note" beside the base sentence (S13 is pinned). -->
<!-- review 2 (repeated panel): the 4 review-1 classes closed (all four agree). New, caused by the fix diff: ops and quality — the closed=human command in step 4 had no base=<tree>; quality — an unplaced path was "named to the human" through no recorded channel. -->
- [x] R4 class: a doctrine example missing a pinned field — the closed=human command carries base=<tree>; row 7 checks every `note review blockers=` command but the skip note; gate-rules-second-pass S14 updated; sweep: Grep `note review blockers=` in review.md → 3 commands, the skip note exempt, the other 2 carry base=<tree> [tier:cheap]
- [x] R5 class: an exclusion with no recorded channel — an unplaced path goes on an `unreviewed:` line in change.md, and R1c defines "placed" (named by a task or written by a build); sweep: Grep `named to the human` over payload/ tests/ → 0 hits [tier:cheap]
<!-- applied from review 2: the archived-change exemption has its row 5 case and a mutant; tests/mutation.mjs creates its copy inside try and drops the unused pattern option; CHANGELOG states the correction condition, observe.md and the harness seed. -->
<!-- recorded for the digest from review 2: a load-error mutant counts as surviving, not killed (understates kills); no row runs the pruned-base fallback; an archived closure without a reason is never surfaced (could move to archive time); event-name folding differs between verify and correction in replacedPasses; tests/mutation.mjs has no containment check on a mutant's file path and keeps symlinks (trusted callers only); the mutate.mjs sentence table repeats the test's RULES. -->
<!-- review 3 (repeated panel): R4 and R5 closed (all four). New, from quality: an unplaced path was left out of every diff and its `unreviewed:` line had no reader, and "a build wrote it" is not recorded anywhere. Third round in a row where the path rule moved; the human decided (2026-10-22): every path goes to the reviewers, only a secret-looking name is left out, and observe flags it. -->
- [x] R6 class: an exclusion whose input is unrecorded or whose marker has no reader — R1b keeps every path but another change's task-named ones ("when unsure, a path stays in"); R1c leaves out only secret-looking names onto `unreviewed:`; observe flags a non-empty `unreviewed:` line (row 16); sweep: Grep `builds wrote it|named to the human|cannot place` over payload/ tests/ lib/ → 1 hit, unrelated (journal-residency row 17's title: "a traversing change id cannot place telemetry") [tier:cheap]
<!-- review 4 (repeated panel): R6 closed (all four). Over budget: 4 review rounds with blockers, all from the path rule — ops: a path another change names was dropped with no record, the secret-name list was narrow, CHANGELOG claimed "every path"; quality: S11 still said "limited to the files the change touched". Escalated; the human chose (2026-10-22) the simplest rule. -->
- [x] R7 class: a path-scope rule that drops or filters paths — gone. Every path in the snapshot goes to the reviewers, other open changes are committed first, and `.gitignore` is the one way to keep a file out; S11 loses "limited to the files the change touched" (pin updated); `unreviewed:` and its observe flag are removed; sweep: Grep `unreviewed|less only those another|limited to the files the change touched|looks like a secret` over payload/ lib/ tests/ CHANGELOG.md → 1 hit, the comment in tests/gate-rules-second-pass.test.mjs that records the dropped words [tier:cheap]
<!-- review 5 (repeated panel): R7 closed (all four). Two blockers on R1c, the one .gitignore sentence. quality: "the snapshot takes every file git does not ignore" is false for a tracked file. ops: this repo's .gitignore named no secret pattern, so the control was empty. -->
- [x] R8 class: a pinned sentence that states a mechanism git does not provide — R1c now says the file must be untracked and matched by `.gitignore`, and that a tracked file is in the snapshot whatever `.gitignore` says; row 6 proves both in a temp repo; this repo's .gitignore gains `.env`, `.env.*`, `*.key`, `*.pem` (git ls-files: 0 tracked files match); sweep: Grep `belongs in \`.gitignore\`|takes every file git does not ignore|kept out by` over payload/ tests/ CHANGELOG.md sdlc/changes/digest-followups/contract → 0 hits [tier:cheap]
closed=human: after five panels on the path rule, the human chose to fix R1c and .gitignore and ship without a sixth panel; the fix is verified by row 6 against real git, the mutation pass and the full suite.

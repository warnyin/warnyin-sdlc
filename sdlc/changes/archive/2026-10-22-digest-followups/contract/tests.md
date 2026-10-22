# Test contract — digest-followups
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Prose rules are pinned as EXACT full sentences with `tests/rule-pins.mjs` `assertSentence`, bounded on both sides. Sentences, verbatim:
- **R1** `Take the change's diff from a snapshot of the tree: with a scratch index at a path that does not exist yet, \`GIT_INDEX_FILE=<tmp> git add -A\` then \`git write-tree\`, so untracked files are in it and the real index is untouched; the change's diff is \`git diff HEAD <tree>\`.`
- **R1b** `Commit every other open change first, so the snapshot holds this change alone; every path it lists goes to the reviewers.`
- **R1c** `A file that must never reach a reviewer must be untracked and matched by \`.gitignore\` before the snapshot; a tracked file is in the snapshot whatever \`.gitignore\` says.`
- **R2** `Every review note but the skip note carries that snapshot as \`base=<tree>\`, and a repeated panel's fix diff comes from \`git diff <base> <tree>\`, with \`<tree>\` taken the same way now; if git has pruned \`<base>\`, the repeated panel gets the change's whole diff instead.`
- **R3** `The human's reason line in change.md starts with \`closed=human:\` and says why.` · **R4** `Each lens reviewer is handed this rule with its brief.` · **R5** (substring) `` `node sdlc/.hooks/journal.mjs note review blockers=<n> mode=<panel|solo> base=<tree>`. ``
- **V1** `Verify never writes a \`review\` note, the skip note included.` · **V4** `Mutants are made in a copy of the tree, never in the working tree, so an interrupted run leaves nothing mutated.`
- **V2** `A mutation count stands only on a passing baseline: the unmutated tests run first, and a red baseline voids the count.`
- **V3** `A pass journaled before its suite was green is corrected, never deleted: \`node sdlc/.hooks/journal.mjs note correction gate=<fast|final> round=<n>\`, then the re-run's verify note carries \`rerun=yes\`.`
- **B1** `Write file text with the file tools, never a shell heredoc: the shell drops \`\s\`, \`\t\` and \`\u0001\`, so scan each written file for control characters.`
- **D1** `An agent file carries verbatim a rule it applies; a term it only reads is defined once, in the playbook, and the agent points there.` · **H1** `Its own exit code decides a pass; a pipe reports the last stage's exit, not the suite's.`
- **S8** (gate-rules-second-pass) `A finding is a security, data-loss or contract defect by its effect, not by the label it carries; when unsure, it is one.`

Anchors: review.md and verify.md as whole files, except the lens bullet (review.md step 1, from `- Plus one reviewer per recorded lens` through its deeper-indented lines). build.md, observe.md and docs/design.md are whole files; harness.md (repo and template) uses `## Sandbox & execution`. Observe rows build journals for OPEN changes in `mkdtemp` projects.

| # | Given / When / Then | Kind | Maps to requirement |
|---|---|---|---|
| 1 | two `review` notes with `closed=human` (one ` Human `) · `humanClosed` 2, text `human-closed×2`; none · 0 and no `human-closed×` | int | observe reads closures, corrections and reruns |
| 2 | one `correction` · `corrections` 1, text `corrected×1`; none shows no `corrected×` | int | observe reads closures, corrections and reruns |
| 3 | fast pass r1, pass r3, `correction` r3, pass r3 `rerun=YES` · rounds 2, text `corrected×1` | int | observe reads closures, corrections and reruns |
| 4 | rerun with nothing before it, or another round or gate · replaces nothing. fail r3, correction, rerun pass · rounds 2, firstPass false. pass r3 then rerun with no correction · rounds 2. pass r3, correction, rerun fail · rounds 1, firstPass false | int | observe reads closures, corrections and reruns |
| 5 | flag `<id>: a blocker closed by a human has no reason in change.md` · raised with no `closed=human:` line, an empty one, or 1 line for 2 closures; not raised with 1 written line for 1 closure, nor for an archived change | int | observe reads closures, corrections and reruns |
| 6 | review.md contains R1, R1b, R1c, R2. In a `mkdtemp` git repo (GIT_DIR, GIT_INDEX_FILE, GIT_WORK_TREE, GIT_OBJECT_DIRECTORY stripped) · an untracked file is in `git diff HEAD <base>`, the real index is unchanged, and after a new file `git diff <base> <now>` lists only it; with `.gitignore` naming both, an untracked file is out of the snapshot and a tracked one is in | unit+int | Review names how the diffs are built |
| 7 | review.md · contains R3 and R5, and every `note review blockers=` command but the skip note carries `base=<tree>`; the lens bullet contains R4 and S8 | unit | Review names how the diffs are built |
| 8 | verify.md · contains V1, V2, V3, V4 | unit | Verify writes no review note, corrects a pass, needs a green baseline, mutates a copy |
| 9 | build.md · contains B1; docs/design.md · contains D1 | unit | (learner proposal; decision record) |
| 10 | sdlc/harness.md and payload/templates/harness.md `## Sandbox & execution` · contain H1; sdlc/harness.md within its cap | unit | (learner proposal) |
| 11 | `assertRule` on clause `a clause holds` · fails after `not ` or a letter; passes at the anchor start, after `- `, `. `, `; ` or `: ` | unit | (guard — a clause pin is bounded at its start) |
| 12 | the four doctrine test files never spawn `node` (`spawnSync(process.execPath`); gate-moving-target and anti-loop-rules declare no local `section`, `step`, `nonEmpty`, `body` and import from `./rule-pins.mjs`; each formerly guarded file exists | unit | (guard rows removed; helpers shared) |
| 13 | CHANGELOG entry `**Close the gate-rules-second-pass digest**` · contains `human-closed`, `rerun=yes`, `base=<tree>`, `closed=human:` | unit | (release note) |
| 14 | `tests/mutation.mjs` `runMutants` on a `mkdtemp` fixture · red baseline → `count` null; green → `1 of 2` with rows named by file, and the fixture's own file unchanged | int | Verify writes no review note, corrects a pass, needs a green baseline, mutates a copy |
| 15 | observe.md · contains `human-closed×N` and `corrected×N` | unit | observe reads closures, corrections and reruns |

## Out of scope (explicitly untested + why)
- Whether a live main loop takes the snapshot, or whether a human really decided a `closed=human`: judgment. Rows 6–7 pin the doctrine; row 5 pins observe's check.
- `base=<tree>` stored by the journal [verified: `note` keeps any key but event/ts/session — payload/hooks/journal.mjs:83-101].
- Clause pins after a colon (gate-moving-target `changelogAdvisory`): a clause lives after a colon, so `Not true: <clause>` passes. Accepted, and named here.

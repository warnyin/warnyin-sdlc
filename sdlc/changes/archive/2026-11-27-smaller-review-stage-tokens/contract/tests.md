# Contract — smaller-review-stage-tokens
<!-- cap:60 · rows are Given/When/Then · kind: pin = exact sentence in payload prose (tests/rule-pins.mjs) · unit = lib/observe.mjs -->

Sentences (whitespace collapsed, each exactly once in its file, bounded by rule-pins):
- P1 `review.md` step 1: "A repeated panel — one after a review that recorded blockers — runs `sdlc-security`, every lens reviewer, and every other reviewer that raised a blocker last round or whose domain the fix diff touches; when unsure whether one did, it runs, and a deep change's repeated panel runs all four."
- P2 `review.md` step 1: "A first panel on tier standard runs `sdlc-security` and `sdlc-quality`, adds `sdlc-architect` when change.md holds more than one `## Delta:` section or the diff changes more than 10 files, and adds `sdlc-ops` when the diff touches or may touch config, migrations or deploy files or the change has a `runbook.md`; tier deep runs all four."
- P3 `review.md`: "Run it as a read-only subagent when possible; every reviewer this step calls still runs."
- P4 `review.md` step 4: "`mode=panel` only when every reviewer that ran — core, and each lens — was an independent agent;"
- P6 `review.md` solo wording: "reviewed its own work through the lenses of the reviewers this step calls instead."
- P5 `observe.md` Cost bullet: "per stage (`contract`, `build`, `verify`, `review`, `ship`): input and output tokens grown since the previous stage event, from `stages`, printed under the change's line."

| # | Given / When / Then | kind |
|---|---|---|
| 1 | review.md step 1 states P1 | pin |
| 2 | review.md step 1 states P2 | pin |
| 3 | review.md states P3; "the four core reviewers still run" is gone | pin |
| 4 | review.md step 4 states P4 and P6 | pin |
| 5 | sweep over the whole tree (not `archive/`, not `sdlc/changes/`, not tests/) finds no "four core reviewers still run", "the four and each lens", "through those four lenses" in `payload/**`, and `sdlc/specs/expert-lenses/spec.md` no longer says "keeps its four core reviewers" | pin |
| 6 | guard: `sdlc-security.md` body still states "A repeated panel never narrows what you check: a vulnerability in any code is a blocker." (passes today; spec row exists) | pin |
| 7 | records 100/10 at t1, 300/40 at t2; contract event at t2; record 500/90 at t3 and build at t3 · stages = contract 200/30, build 200/50 (record at an event's time counts) | unit |
| 8 | contract, build, review, verify, verify, ship events each with a record · all six appear in time order with their own growth (`review` and `ship` are stages) | unit |
| 9 | records plus only `gate`/`compact`/`inject` events, or one `review` note with `skipped=no-signal` · `stages` is [] and renderReport prints no stage line | unit |
| 10 | session A records before and after an event, session B's first record between the previous event and this one · growth = A's growth + B's whole total, each once | unit |
| 11 | a record lower than the one before it, one session; and sessions whose sum falls · growth 0 per class, never negative | unit |
| 12 | a record after the last stage event · in no stage, change `tokens` unchanged | unit |
| 13 | every stage entry carries input, output, cacheRead, cacheWrite | unit |
| 14 | renderReport prints `    · <stage> <fmtK in>in/<fmtK out>out` per stage, in order, under the change line | unit |
| 15 | `observe --json` in a temp project holds `stages` on each change | cli |
| 16 | observe.md states P5 | pin |
| 17 | stage event before any session record, then a record, then a build · contract grows 0; build grows the record's total; sum = last total − 0 | unit |
| 18 | change archived through `runCli archive`, with stage events and records · `buildReport` gives the same `stages` as before archiving plus the `ship` entry archive writes itself | unit |
| 19 | `build` note with `source=review` · entry has stage `build` and `source: 'review'`; a build without source has no `source` key | unit |

Out of scope (and why):
- The evaluator re-score is unchanged: `verify.md` step 1 (Evals) already keeps a met line's score unless the fix touched it. Checked by reading; no row runs it.
- Reviewer agent files are unchanged; row 6 guards `sdlc-security.md`, a guard not a red-first row.
- Which reviewers a real panel calls is the main loop's judgment: rows 1-2 pin the rule, not a run; scenarios "quality only blocker", "unsure", "one capability, 4 files", "deep change" rest on those pins.
- The `review` command stub description and the two rubrics under `sdlc/evals/` name the four roles, not a rule.
- "Done" (fewer review-stage tokens next change) is a human comparison; `[UNVERIFIED]` blur size of Stop-time records.

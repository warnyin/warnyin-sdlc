# Test contract — artifact-followups
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

New tests go in `tests/artifact-followups.test.mjs`; rows 13–14 edit `tests/change-artifacts.test.mjs`.
BAD = `x` + U+009B U+202E U+200B U+2066 + `y` (C1 CSI, RLO, ZWSP, LRI; NTFS accepts all four). "Escaped" =
output contains `\u{9b}`, `\u{202e}`, `\u{200b}`, `\u{2066}` and no raw Cc/Cf character.

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | `escapeEntry` of every code point U+0000–U+10FFFF (surrogates skipped) · each Cc, Cf, Zl, Zp one comes back as `\u{…}` | unit | Every refusal shows the change id escaped |
| 2 | `resolveChangeFile(sdlcRoot, BAD)` in each failing state — no folder; folder without change.md; folder linked out; change.md linked out (link cases skip only on EPERM/EACCES/ENOSYS) · every error is escaped | unit | Every refusal shows the change id escaped |
| 3 | `artifact BAD plan.html` : no such change; no `artifact/` folder; folder without the file (`is missing`); a successful stamp (stdout `stamped:` escaped); a cap refusal · each escaped | e2e | Every refusal shows the change id escaped |
| 4 | `journal.mjs park BAD` with `{"reason":"shelved"}`: no such change; an existing change (success line); `park` again (refusal); `unpark` (success); `unpark` again (refusal) · each stdout+stderr escaped | e2e | Every refusal shows the change id escaped |
| 4b | park/unpark refusal branches, one project each: an empty reason; a waiter folder named BAD with `blocked-by: [victim]` when parking `victim`; change.md a directory (park and unpark); no frontmatter; a duplicated `parked:` key (unpark) · each output escaped | e2e | Every refusal shows the change id escaped |
| 4c | source of lib/park.mjs, lib/change-file.mjs and `cmdArtifact` · no `${changeId}` and no `${waiters.join` left (pins the race-only and round-trip branches no fixture reaches) | unit | Every refusal shows the change id escaped |
| 5 | changes `a;b`, `a$b`, `a b`, `-x` stamped, Delta edited · `validate` · the stale line ends `(re-run: warnyin-sdlc artifact <change-id> plan.html)` | e2e | The stale hint is safe to paste |
| 5b | `hintId` over every code point (surrogates skipped), as the first char (`<c>x`) and inside (`a<c>b`) · the id is kept exactly when the char is in `[A-Za-z0-9_]` (first) or `[A-Za-z0-9._-]` (inside); otherwise `<change-id>` | unit | The stale hint is safe to paste |
| 6 | `plain-id-1.x_y`, and an 85-char `[a-z]` id, stamped then edited · the hint names the full id | e2e | The stale hint is safe to paste |
| 7 | a standard change at exactly 100 effective lines with `## Artifacts` listing another path · stamp `plan.html` · non-zero, stderr `cap of 100 lines` and `nothing was written`, change.md byte-identical | e2e | A stamp never pushes change.md over its cap |
| 8 | row 7 at 99 lines with no `## Artifacts` section (stamp adds 2); a vibe change at 40; a `tier: constructor` change at 100; a CRLF standard change at 100 · each refused, byte-identical, naming its cap (constructor → 100) | e2e | A stamp never pushes change.md over its cap |
| 8b | a standard change at 99 lines with `## Artifacts` listing another path · stamp `plan.html` · exit 0 and 100 effective lines (`exceed` means `>`, not `>=`) | e2e | A stamp never pushes change.md over its cap |
| 9 | (green guard) a change at 100 lines, and one at 101, with the path already listed · stamp · exit 0 (re-stamp adds no line) | e2e | A stamp never pushes change.md over its cap |
| 10 | in-process `cmdArtifact`, `fs.lstatSync` mocked to throw EACCES for `artifact/plan.html` · throws `cannot be checked (EACCES)`, not `is missing`; byte-identical | unit | A stamp names why it could not check the file |
| 11 | same, mocked for the `artifact` folder · throws `cannot be checked (EACCES)`, not `not a real directory`; `validate` with the same mock warns `cannot be checked (EACCES)` | unit | A stamp names why it could not check the file |
| 12 | stamp, rewrite the basis upper-case, then mixed-case (`AbC…`) · `validate` → no artifact warning each time; edit the Delta · `validate` → `artifact/plan.html is stale` | e2e | A basis is read in any case |
| 13 | change-artifacts row 4 · second near-miss neighbour `- artifact/plan.html-old`; the per-path match ends only at whitespace, `)` or end of line | unit | (green guard, archived spec: An artifact is listed with the basis it was made from) |
| 14 | change-artifacts row 25 · lib/artifacts.mjs, lib/fences.mjs, lib/change-file.mjs match none of `/\bimport\s*\(/`, `createRequire`, `getBuiltinModule`, `/process\s*(\.|\[)\s*['"]?binding/`; every `\bfs\b` in lib/artifacts.mjs is the import or `fs.lstatSync` | unit | (green guard, archived spec: A stale or missing artifact is reported and never blocks) |

## Out of scope (explicitly untested + why)
- Rows 13–14 harden existing tests and are green before the change; verify proves them by mutation (`const g = fs`, `fs?.readFileSync`, `await import ('node:fs')`, a `plan.html-old` miscount).
- Dropping `Math.min(section.end, …)` and `code ?? ''` changes no behaviour: the existing change-artifacts and security-regressions rows run unchanged in the full suite.
- Row 11 checks validate through in-process `artifactWarnings`, the function validate calls.
- Raw id echoes outside artifact/park, found by the contract attack and the review-1 ops sweep (line numbers as of contract time): bin/cli.mjs:791,851,854,886,964,969; lib/relations.mjs:230,373; lib/validate.mjs:65; lib/observe.mjs:200-206,261; payload/hooks/journal.mjs:34,47,59; payload/hooks/session-summary.mjs:66 — a follow-up change.

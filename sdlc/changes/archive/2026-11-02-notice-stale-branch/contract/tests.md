# Test contract — notice-stale-branch
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Rows 1–2 in `tests/update-from-the-notice.test.mjs` (fresh cache, no network); rows 3–8 in
`tests/notice-stale-branch.test.mjs`. P = `payload/playbook/update.md`; its step 3 via `rule-pins.mjs`
`step(text, 3)`, whitespace collapsed. B1–B10 are pinned verbatim (exact strings live in the test file):
B1 `Before offering, check whether this branch is behind its base: …` · B2 own `version.json`, default may carry newer ·
B3 the two commands; empty name = failed · B4 equal names → default branch, offer · B5 `git show <default ref>:…` ·
B6 plain `X.Y.Z` part by part, else failed · B7 newer → no choice, name it "as of the last fetch", recommend sync ·
B8 note once per session · B9 any failure or not newer → offer · B10 no `git fetch`.
Rows marked † came from the contract attack (one round, 15 findings).

| # | Given / When / Then | Kind (unit/int/e2e) | Maps to requirement |
|---|---|---|---|
| 1 | installed `0.9.0`, latest `0.10.0` · SessionStart · first line holds `(this checkout has 0.9.0)` and † `follow \`sdlc/.playbook/update.md\`` and † `unless the default branch already carries a newer version`; `this project has` nowhere in stdout | e2e | A newer published version is announced at session start |
| 2 | † every file under `lib/`, `payload/`, `bin/`, `docs/`, plus `README.md` · none contains `this project has` | unit | A newer published version is announced at session start |
| 3 | P step 3 · contains B1–B10, † each exactly once (first index = last index), strictly in order | unit | A branch behind its base is sent to the base, not offered the update |
| 4 | † P · B1 lies inside step 3 and before `**apply now**`; step 1 does not carry it (manual `/sdlc:update` with no notice still meets it) | unit | A branch behind its base is sent to the base, not offered the update |
| 5 | scratch clone, origin `main` at `0.31.0`, `feat` at `0.24.0` checked out · B3/B5 commands taken from P's text · `origin/main`, `feat`, blob version `0.31.0`; checkout's file `0.24.0` | e2e | A branch behind its base is sent to the base, not offered the update |
| 6 | repo with no remote; † origin added by `git remote add` + fetch (no `origin/HEAD`); clone on detached HEAD · symbolic-ref exits non-zero twice; `--show-current` prints empty (B3 → B9) | e2e | A branch behind its base is sent to the base, not offered the update |
| 7 | † clone on `main` · B3 names equal after dropping `origin/` (B4); † origin `main` without `sdlc/.hooks/version.json` · B5's `git show` exits non-zero (B9) | e2e | A branch behind its base is sent to the base, not offered the update |
| 8 | † the origin directory deleted after cloning · B3 and B5 still print `origin/main` and `0.31.0` (B10: local only) | e2e | A branch behind its base is sent to the base, not offered the update |

## Out of scope (explicitly untested + why)
- The rest of row 1's Delta scenario (both versions, the command, one line, no file or manifest change) and
  "already current" — existing rows 1 and 3 of `update-from-the-notice.test.mjs` assert them (read: lines 99–137).
- Installed copy of P — existing row 11 asserts it installs, is manifested and is restored by `update` (read: 199–220).
- The agent's own comparison (numeric order, a non-`X.Y.Z` value, CRLF in the blob) and the once-per-session note —
  agent judgment, scored in `contract/evals.md`.
- `payload/adapters/claude/commands/sdlc/update.md` and `sdlc/specs/update-notice/spec.md` restate the three
  options, which this change does not alter (read: command stub line 2; spec "picking" requirement).

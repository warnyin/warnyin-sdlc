# Digest — update-reclaim (#11, deep)
- Shipped: `update` reclaims a payload file missing from the manifest when its content matches what some released version installed there (bin/shipped-hashes.json, 38 versions); user-edited files stay kept; a bad ledger skips reclaim with a warning. Every init/update write goes through writeFileContained; a refused write keeps the path's manifest entry and reports `kept (symlink in path, not written)`. Release job runs `shipped-hashes --check`.
- Spec merged: specs/tool-adapters/spec.md (reclaim; shipped hashes; installer never writes through a symlink). No MODIFIED warning.
- Assumptions: reclaim on an exact normalized hash only (human approved); `archive` writes deferred to a follow-up (human decision, stated in CHANGELOG).
- Verify: 6 rounds, all pass; final gate full suite 768 / 767 pass / 1 skip (con.html on win32), row 25 run live in a case-sensitive folder. Evaluator pass (4,4,5,5; over-build 3 advisory).
- Review: 4 panels, blockers 1/1/3/3. Panel 4 exceeded the 3-round budget and was escalated; the human chose "fix all three, ship without another panel" — so the R4 fixes (manifest row 20, CRLF appends row 24, link-safe case folding row 25) were not panel-reviewed. They are red-proven: evidence/red-proof.txt, 7 mutations, each off → fail, on → pass.
- The escalation is recorded in change.md R4, not as a journal `escalation` event.
- Release note: `npm run shipped-hashes` must run after the commit — `--check` fails until lib/safe-path.mjs's new hash is in the ledger.
- Cost: session totals (span earlier changes too) 10.1k in / 6.2M out, cacheRead 1.30B; lead 2.8h.
- Learner proposals awaiting the human (always-loaded, not applied):
  1. harness.md: a review-added row needs a `contract` journal event before its `build source=review`.
  2. harness.md autonomy policy: escalate on "verify or review still blocking after 3 rounds", journaling `escalation`.
  3. constitution: a review fix's own diff is enumerated for new classes before the next panel.
- Freed / waiting: none.

# Digest — windows-test-flakes (vibe, autopilot)
- Shipped: the kimi rules-card test compares after EOL normalization. `makeTempProject` cleanup
  retries EPERM/EBUSY/ENOTEMPTY for up to ~5 s. Only tests changed; no runtime behavior changed.
- Class enumerated (constitution): `grep -rn "rmSync(" tests/*.mjs`. Only update-notice spawns
  the detached update check, and its row 20 keeps every other suite off the notifier, so
  `makeTempProject` is the one instance. Raw payload text compared with installed output:
  `grep -rln "readFileSync(path.join(PKG_ROOT, 'payload'" tests/` → 5 files; only kimi compares
  it with installed output (caps-sync compares numbers).
- Build: 1 fix round. `rmSync` `maxRetries`/`retryDelay` did not retry on Node 24 Windows
  (EPERM in 5 of 8 runs), so it became an explicit async retry loop.
- Verify: `sdlc-runner` ran `npm test` → 593 pass, 0 fail on Windows, the first green run here;
  update-notice 5/5 runs; kimi 9/9. The judgment is self-produced (`mode=solo`); the runner only
  ran the commands. The final gate reused the fast gate's full run: `reused=yes`, not repeated.
- Review: no signal (vibe, 2 test files), recorded as `skipped=no-signal`.
- Pilot decisions: none. No escalation was reached and no hard-floor was touched. The npm
  publish (approved `irreversible`) happens after this ship, gated on CI.
- Done in the same run, outside this change (per mandate): README "Retuning model routing";
  constitution rule (a Delta that states playbook prose names its file) via /sdlc:steer, 24/60
  resident; harness rule (every contract row runs before a fast gate).
- Found, not fixed (outside the confirmed scope): observe gives every change the whole
  session's running total when one session spans several changes. Evidence: this 0.1 h change
  shows 567k out and $3.45, the same cost as stage-model-routing. The fix is to attribute each
  change its delta from the session's previous record. A follow-up change is proposed.
- Learner: no durable lesson (thin evidence).

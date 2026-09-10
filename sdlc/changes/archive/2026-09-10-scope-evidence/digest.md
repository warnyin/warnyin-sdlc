# Digest — scope-evidence
<!-- cap:15 -->
**Shipped** (issue #2). The Confirm step of an unattended run must now show, per scope item,
the command that established it and what that command returned — not the list, not a summary.
Evidence that searched a term the request did not name is flagged with both terms; a narrowing
the request never asked for becomes its own refusable item; and an exclusion made on an empty
result must name the pattern searched, because finding nothing is a claim about the pattern.
**Specs merged:** `unattended-run`, 3 ADDED requirements (4 existing untouched). **Tests:** 198 green.
**Reach — read this before trusting it:** enforcement is doctrine plus tests that the doctrine
says it, plus an eval rubric. The confirmation is written by the model at runtime, so there is
nothing static to gate it. This lowers the odds of an unchecked scope; it does not make one
impossible.
**Verify:** 1 round, `mode=panel`. Review found no blockers and 4 improvements, all applied —
the load-bearing one: the "per scope item" rule sat only in `## Design`, which never merges,
so the shipped spec would have lost it silently.
**Process, honestly:** I edited `auto.md` before writing its tests, so they were green on
arrival. Nothing in the harness caught that — I reverted the file to check they could go red.
Eight did; two are declared regression guards. A run that skipped that check would have shipped
tests that proved nothing, and the digest would have looked identical.
**Awaiting you:** nothing new. The prior change's proposal (route eval judging to `balanced`
for deep tier) still stands unapplied.

---
id: scope-evidence
tier: deep
status: shipped
---
# Change: A confirmed scope shows how it was derived, not just what it concluded
<!-- cap:150 · deep tier: hard-floor surface (security/payments/data-loss/irreversible) or new/multi-capability delta. Human gates apply per Autonomy policy. -->

## Why (≤5 lines)
The Confirm step presents the scope it settled on and asks for approval, but never the
command that produced it or what that command returned. A reader can only check the
conclusion, so a derivation that searched the wrong thing passes as agreed. One reported
run got the scope wrong three times this way — wrong symbol, an unrequested folder
filter, and an empty search read as proof of absence. GitHub issue #2.

## Assumptions
- Enforcement is doctrine plus tests that the doctrine says it, plus an eval rubric —
  not a mechanical gate. Safe only in the narrow sense that it matches how the rest of
  `unattended-run` is enforced: the confirmation is produced by the model at runtime, so
  there is nothing static to validate. This lowers the odds of a bad scope; it does not
  make one impossible, and the digest should not read as if it did.
- Tier is `deep`: same capability as the change that introduced `--auto`, which was deep,
  and this governs the gate deciding when a human is bypassed.
- "Evidence" means the command and its output, not a paraphrase of them. A summary of
  what a search found is the same class of claim as the scope itself.

## Delta: unattended-run

### ADDED Requirement: A confirmed scope carries the evidence that produced it
The system SHALL present, for each item of the scope in the confirmation, the command
whose output established that item and what the command returned, so the human can check
each derivation and not only the conclusion.

#### Scenario: the scope was narrowed by a search
- WHEN a search over candidates decided what is in scope
- THEN the confirmation shows that search and its output next to the resulting list

#### Scenario: items established by different commands
- WHEN the scope holds items that different commands established
- THEN each item carries its own evidence, so one approval never covers a derivation
  that was never checked on its own

#### Scenario: the scope rests on no command at all
- WHEN nothing was run to establish the scope
- THEN the confirmation says so, rather than presenting the list as derived

### ADDED Requirement: Evidence that does not match the request is flagged
The system SHALL mark a scope whose evidence searched for something other than what the
request described, rather than presenting that scope as settled.

#### Scenario: the evidence searched a different name
- WHEN the search used a name the request did not name
- THEN the confirmation flags that mismatch on the scope item it produced

#### Scenario: candidates narrowed by an unrequested property
- WHEN the candidate set was cut by something the request never specified, such as a
  naming convention or a folder pattern
- THEN that narrowing appears as its own item the human can refuse on its own

### ADDED Requirement: An exclusion on an empty result names what was searched
The system SHALL state, when a candidate is left out because a search returned nothing,
the pattern that was searched, so a convention nobody anticipated is visible instead of
silently decisive.

#### Scenario: a candidate excluded because nothing matched
- WHEN a candidate is dropped from scope on an empty search result
- THEN the confirmation shows the pattern searched and that it returned nothing

## Design
<!-- decisions & trade-offs only — never restate the delta. Escalate irreversible decisions per Autonomy policy. -->
- decision: the requirement is on the confirmation's CONTENT, never its wording ·
  alternatives: pin the phrasing so a test can match it · because: the existing contract
  already ruled that out — asserting on prose freezes it — and a frozen sentence would be
  satisfied by a run that pasted it without deriving anything.
- decision: evidence is shown per scope item, not once per run · alternatives: one
  evidence block for the whole scope · because: the reported failure excluded four
  repositories on one claim and missed a fifth on another; a single block invites one
  approval to cover derivations that were never separately checked.
- decision: an empty result is treated as a claim needing evidence, not as a fact ·
  alternatives: only cover positive matches · because: two of the three reported errors
  were absences — "no matching branch" was a statement about a pattern, not about a repo.

## Tasks
- [x] T1 `payload/playbook/auto.md`: the Confirm section requires per-item evidence, the mismatch flag, and the empty-result rule [tier:balanced]
- [x] T2 `contract/tests.md` rows → `tests/unattended.test.mjs`, following the existing doctrine-assertion style [tier:cheap]
- [x] T3 `contract/evals.md` rubric for the behaviour tests cannot reach [tier:cheap]
- [x] T4 check the cap: `auto.md` grows only by what these three rules need [P] [tier:cheap]
- [x] R1 review: the per-item rule moved into the ADDED Requirement itself — `## Design` never merges into the living spec, so the shipped spec would have lost it [tier:balanced]
- [x] R2 review: tightened keyword-only assertions and made the Confirm-section slice fail loudly when unbounded [tier:cheap]

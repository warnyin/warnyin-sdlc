# Digest — assumptions-are-claims (standard)
<!-- cap:15 -->

- **Shipped**: the doctrine now treats an assumption that REMOVES work — "already covered",
  "unchanged", "harmless", "pre-existing", "self-heals" — as a claim about the code, to be run
  and proven before it is recorded, or recorded `[UNVERIFIED]`. Written as the sibling of the
  rule already in `new.md`: what can be looked up is never asked, and never assumed either.
- **Where**: `new.md` (where the claim is made), `contract.md`'s out-of-scope list (where it is
  spent to delete a test row), `review.md` step 1c (the panel attacks those claims first, being
  the first stage that reads code rather than the Delta), the rules card and all three templates.
- **Specs merged**: `clarification-rounds` (1 ADDED, 4 scenarios).
- **Evidence it was worth doing**: three deep changes shipped this week, and each one's bug sat
  inside the Assumption used to argue the work away. All three were false; each took under two
  minutes to disprove by running it; none was ever run.
- **Budget**: `new.md`'s pin raised 43 → 46 in both tests that assert it, with the reason
  recorded beside the pin. The first draft landed at 47 and was trimmed instead of raising
  further — the card stayed at 20/40 and no other pinned budget moved.
- **Self-applied**: this change's own budget-pin assumption was checked against both test files
  before being written, and its row 3 was caught passing before the rule existed (a 320-char
  window matched "prove" from an unrelated sentence) and tightened.
- **Judged solo, not by a panel**: standard tier, no review signal; the evals were scored in the
  main loop and the journal records `mode=solo`. Weaker evidence than a panel, said plainly.
- **Process note**: run as a standard-tier change on purpose — no design stage, no panel, tests
  written in the main loop — after this session's lesson that ceremony had been applied out of
  proportion to risk. 425/425 tests, 8 new rows.

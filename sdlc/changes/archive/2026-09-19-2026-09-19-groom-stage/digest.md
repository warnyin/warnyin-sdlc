# Digest — groom-stage (standard)
<!-- cap:15 -->

- **Shipped**: `/sdlc:groom` — an optional stage BEFORE a change exists. It grills the problem
  rather than the solution it was handed, researches feasibility by running things instead of
  reasoning about them, offers 2–3 shapes cheapest-acceptable-first, and may end in "not worth
  building". It writes no artifact: its output is the Why and Assumptions `/sdlc:new` opens with.
- **Specs merged**: `change-focus` (1 ADDED, 4 scenarios). Purpose written at ship — it was still
  the empty placeholder, and `mergeDelta` never touches Purpose.
- **Why it exists, from this repo's own week**: "make sdlc work in Kimi Code" went straight to
  `new`, was scoped as a rules-file-only adapter, and four changes later needed `0.16.0` to add
  the stage commands the human wanted from the start. Nothing had asked what "work" meant.
- **Costs no always-loaded budget**: grooming precedes the lifecycle the constitution and rules
  card describe, so their flow line is untouched. Row 10 is a guard that pins exactly that —
  it fails if a future edit smuggles grooming into always-loaded context.
- **The 0.16.0 design paid off immediately**: this is the first stage added since Kimi's skills
  became rendered from the Claude stubs, and `/skill:sdlc-groom` appeared with zero Kimi-specific
  work. 16 commands, 16 skills, verified on a live install rather than assumed.
- **Judged solo**: standard tier, no review signal; evals scored in the main loop and the journal
  records `mode=solo`. Weaker evidence than a panel, stated plainly.
- 446/446 tests, 10 new rows.

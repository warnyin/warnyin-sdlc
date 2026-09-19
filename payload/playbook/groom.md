# /sdlc:groom <rough idea> — find the real requirement, before a change exists (optional)

Run when the ask is one line, names a solution instead of an outcome, or you cannot yet say what
done looks like. Skip it when the ask is already concrete — a ceremonial grooming is garbage.
It writes no artifact of its own: its result is the Why and the Assumptions `/sdlc:new` opens with.

1. Grill the human about the PROBLEM. Their proposed solution is evidence of the problem, never
   the scope — do not let it set the questions. Ask, in rounds (`clarification-rounds` doctrine,
   recommended answer per question, 2–4 options through the tool's picker where there is one):
   - what breaks today, for whom, and how often
   - what done looks like — observable, not "better"
   - what must not change (the thing you would be angry to lose)
   - the cheapest outcome they would accept, and what they would drop to get it sooner
   - who else touches this, and what they expect to keep working
2. Research feasibility in the code, not in your head. Read what already exists, and RUN the
   thing you are about to claim. Anything you intend to carry into `## Assumptions` — "already
   covered", "unchanged", "harmless", "pre-existing" — is a claim, so prove it now or carry it
   as `[UNVERIFIED]` (`new.md` §5). What grooming hands over should already be verified.
3. Offer 2–3 shapes for reaching the outcome, the cheapest acceptable one FIRST and marked
   recommended, each with what it costs and what it gives up. Say plainly when a shape is bigger
   than the problem. "Not worth building" is a legitimate ending, and the cheapest of all.
4. Confirm: restate the settled outcome, the shape picked, and what is explicitly out of scope.
   Wait for the human. A corrected answer reopens a round.
5. Hand off: `/sdlc:new "<the settled title>"`, carrying the Why and the verified Assumptions —
   `new` triages the tier and writes the Delta; grooming does not pre-empt either.

Next: /sdlc:new, or nothing at all. No change folder exists until `new` runs, so ending here
costs nothing.

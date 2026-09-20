# Eval contract — change-parking
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: were rows 1–4 — the four defects that withdrew this feature from `change-relations`
  — written as failing tests and RUN red before any implementation, rather than fixed first and
  tested afterwards?
- Trajectory: was every claim that removed work proved by running it, not by reading the code?
- Quality — the containment primitives are single-sourced in `lib/safe-path.mjs` and every
  writer builds on them rather than on a copy; the extraction changed no behaviour, and any
  predicate deliberately left separate is named in the change with the command that found it.
- Quality — the writer touches only the frontmatter block: it reports whether it changed the
  file, refuses when it did not, and a body line that merely looks like frontmatter survives
  byte-identical.
- Quality — no command-line form for the reason exists at all, in code or in usage text. An argv
  fallback kept "for convenience" scores 1: it is the exact rule the constitution names.
- Quality — the deadlock is prevented from both directions, and each refusal names the changes
  that would be stranded and the park reason, never a generic message.
- Quality — a reason survives the round trip: what is written into frontmatter reads back
  identically, and every echo of it is escaped and length-capped the way a relation entry is.
- Quality — parking is invisible where it should be and reachable where it should be: absent
  from the default listing, the ordering, next work and the no-pointer fallback; present in the
  count, under `--all`, and in the machine output.
- Quality — doctrine and code agree: `next.md`, `ship.md` and the templates describe how parking
  is entered and left, and no stage is told to do something the tool refuses.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

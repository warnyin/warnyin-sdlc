# Digest — warn-scenario-drop (2026-08-25)

**Shipped**: a `### MODIFIED Requirement:` body replaces the requirement wholesale, so
one that carries over only some of the spec's scenarios used to drop the rest in
silence — no error, no warning, `spec merged` either way (issue #1). `archive` now
names every scenario the new body removes or rewrites before phase 2 writes anything,
and `validate` reports the same thing while the change is still fixable.

**Specs merged**: `spec-merge` (1 requirement, new capability).

**Assumptions**: a warning, never an error — dropping a scenario is sometimes the point
of the change; only doing it silently is the bug. A reworded clause reports the same as
a deleted one: nothing mechanical can tell "said better" from "promises less", and a
false warning costs a re-read while a missed one costs a guarantee. Cosmetic churn
(indent, bullet marker, clause order, heading case, whitespace) is normalized away.

**Self-produced outcomes**: contract, build and verify all ran `mode=solo` — no panel
saw this change. The verification is the suite, not a second opinion.

**Verify**: 1 round, first-pass PASS · 165/165 (was 156) · `validate --strict` clean.

**Note for the reader**: the fix cannot distinguish a rewrite that preserves meaning
from one that removes it. If this warns too often in practice, the answer is to compare
clauses more cleverly, not to raise its threshold — the issue it closes was caused by
exactly the silence a threshold reintroduces.

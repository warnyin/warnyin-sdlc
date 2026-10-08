---
id: fence-close-marker
tier: standard
status: shipped
spawned-from: [deploy-runbook]
---
# Change: a code fence closes only on its own marker
<!-- cap:100 · standard tier: one capability, behavior change. -->

## Why (≤5 lines)
`linesOutsideFences` flips in/out of a fence on any line starting with ``` or ~~~. A ``` block
holding a ~~~ line is read as closed there, so a `## Rollback` or `## Mandate` that sits inside
code counts as a real heading: a runbook or a grill.md passes with the section only quoted.

## Assumptions
- Follow-up recorded in deploy-runbook's digest; the human said to continue ("ทำต่อเลย").
- CommonMark rule: a fence closes on a line of the same character, at least as long as the
  opener, with nothing after it but spaces. An opener may carry an info string (```js).
- One helper serves grill.md and runbook.md (`grep -n linesOutsideFences lib/*.mjs` → 3 hits,
  all in validate.mjs), so both get the fix and both get a row.
- An unclosed fence still runs to the end of the file, as today. Safe: that only hides
  headings, which fails closed.
- Stays standard: validator only, no hook/prune/merge semantics.

## Delta: fenced-code

### ADDED Requirement: A fence closes only on its own marker
The system SHALL treat text as fenced from an opening line of three or more backticks or
tildes until a line of the same character, at least as long, with nothing else on it, when it
decides whether a required heading of `grill.md` or `runbook.md` is present.

#### Scenario: a tilde line inside a backtick fence
- WHEN a ``` fence holds a ~~~ line and then a required heading, and closes with ```
- THEN the heading does not count and validation names it missing

#### Scenario: a longer opener
- WHEN a fence opens with four backticks and holds a three-backtick line and a heading
- THEN the heading does not count

#### Scenario: a fence with an info string
- WHEN a fence opens as ```md and closes with ```
- THEN a required heading after the close counts

## Tasks
- [x] T1 `lib/validate.mjs` `linesOutsideFences`: track the opener's char and length [tier:balanced]
- note: class sweep `grep -rnE "```|~~~|fence" lib bin payload/hooks scripts --include=*.mjs` → the only
  code-fence reader is `linesOutsideFences` (frontmatter.mjs `fenceBounds` is the `---` block).

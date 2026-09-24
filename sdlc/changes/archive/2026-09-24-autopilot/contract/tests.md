# Test contract — autopilot
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

Playbook behaviour is prose an agent executes; rows over `autopilot.md` assert the rule is
stated (the house pattern of `tests/unattended.test.mjs`). Code rows run the real CLI/lib.
Rows 9, 12, 24, 30 are green before code by design: they guard against an over-strict validator
and against any edit to `auto.md`. Every other row is red for its own missing behaviour.

| # | Given / When / Then | Kind | Maps to requirement |
|---|---|---|---|
| 1 | a fresh project / `init --tool claude` runs / `.claude/commands/sdlc/autopilot.md`, `sdlc/.playbook/autopilot.md` and `sdlc/.playbook/templates/grill.md` exist and are in the manifest | int | One grill up front settles the mandate |
| 2 | the autopilot command stub / read / it points at `sdlc/.playbook/autopilot.md`, has an argument-hint, body ≤15 lines | unit | One grill up front settles the mandate |
| 3 | `autopilot.md` / read / it grills in rounds: frontier per round, numbered questions, recommended answer each, facts looked up not asked, picker when available | unit | One grill up front settles the mandate |
| 4 | `autopilot.md` / read / the grill settles requirement + done, the priority order of requirement/quality/time/cost with its default, every `auto.md` escalation row, and each hard-floor surface item by item | unit | One grill up front settles the mandate |
| 5 | `autopilot.md` / read / it states nothing is written (no change folder, journal, gate, pointer) before confirmation, and a declined/edited item reopens a round or stops | unit | One grill up front settles the mandate |
| 6 | `autopilot.md` / read / "hard-floor found mid-run is decided without you" is its own refusable confirmation item, and a refusal turns that condition back into a stop | unit | After confirmation the run never stops to ask |
| 7 | `autopilot.md` / read / grill.md is the first write after confirmation, at `sdlc/changes/<id>/grill.md`, from the template | unit | The mandate is recorded as the change's operating model |
| 8 | `payload/templates/grill.md` / read / it carries `## Delegation`, `## Priorities`, `## Mandate`, `## Decisions` and a `cap:80` comment equal to `CAPS.grill` | unit | The mandate is recorded as the change's operating model |
| 9 | a change with a grill.md holding all four sections within cap / validate runs / 0 errors | int | The mandate is recorded as the change's operating model |
| 10 | a change whose grill.md exceeds `CAPS.grill` effective lines / validate runs / error naming the change, `grill.md`, the count and the cap; exit 1 | int | The mandate is recorded as the change's operating model |
| 11 | a change whose grill.md lacks each one of the four sections in turn / validate runs / error naming the missing section; exit 1 | int | The mandate is recorded as the change's operating model |
| 12 | a change with NO grill.md (auto or manual flow) / validate runs / no grill-related issue — presence is not required | int | The mandate is recorded as the change's operating model |
| 13 | a grill.md whose sections appear only inside a fenced code block or as `### Mandate` / validate runs / reported missing (headings are `## ` at line start, outside fences) | int | The mandate is recorded as the change's operating model |
| 14 | grill.md present but unreadable (a directory in its place) / validate runs / an issue naming the change, never a throw | int | The mandate is recorded as the change's operating model |
| 15 | `autopilot.md` / read / after confirmation an escalation not pre-approved is decided by the agreed priority order and the run continues — it never stops to ask | unit | After confirmation the run never stops to ask |
| 16 | `autopilot.md` / read / it names `cap-pin-exceeded` and `final-gate-env-failures` (or "any condition outside the escalation table") as decided, not stopped | unit | After confirmation the run never stops to ask |
| 17 | `autopilot.md` / read / tie-break prefers the reversible option, then the priority order; a mandate check precedes each pilot decision | unit | After confirmation the run never stops to ask |
| 18 | `autopilot.md` / read / each pilot decision journals exactly `note escalation condition=<name> preauth=pilot priority=<requirement/quality/time/cost> reversible=<yes/no> hardfloor=<yes/no>` (tokens only) and writes one `grill.md § Decisions` line: condition · options · choice · recovery | unit | Every decision taken alone leaves an evidence trail |
| 19 | `autopilot.md` / read / for an irreversible choice the § Decisions recovery line is written BEFORE the action | unit | Every decision taken alone leaves an evidence trail |
| 20 | `autopilot.md` / read / human-written grill answers reach grill.md through the file tool, never as a shell argument | unit | Every decision taken alone leaves an evidence trail |
| 21 | `ship.md` / read / the digest lists every `preauth=pilot` escalation, hard-floor first, with reversibility and recovery, apart from `preauth=yes` | unit | The human stays accountable after the fact |
| 22 | a journal with 2 `preauth=pilot`, 1 `preauth=yes`, 1 `preauth=no` escalation / `buildReport` runs / `pilot` = 2, `preauthorized` = 1 | unit | The human stays accountable after the fact |
| 23 | the same journal / `renderReport` and `observe --json` run / text shows `pilot×2` apart from `unattended×1`; JSON carries `pilot: 2`; a change with no pilot events has `pilot: 0` and no `pilot×` text | int | The human stays accountable after the fact |
| 24 | `auto.md` / read / it contains no "pilot"/"autopilot" and still states "A condition outside the confirmed set stops the run" | unit | After confirmation the run never stops to ask |
| 25 | README.md and `payload/playbook/README.md` / read / each has a `/sdlc:autopilot` row; `docs/design.md` ledger has a `grill.md` row | unit | One grill up front settles the mandate |
| 26 | `autopilot.md` / read / a resume with grill.md present does not re-grill the requirement but re-asks the delegation items once (authority covers one run) | unit | After confirmation the run never stops to ask |
| 27 | `autopilot.md` / read / the mandate check before each decision looks the condition up in `grill.md § Mandate`; one the human refused stops and asks | unit | After confirmation the run never stops to ask |
| 28 | a change whose journal holds 2 `preauth=pilot` escalations and grill.md § Decisions holds 1 line / `validate --strict` runs / error naming the change and both counts; non-strict validate only warns | int | Every decision taken alone leaves an evidence trail |
| 29 | the same with 2 lines, and a change with pilot events but NO grill.md / `validate --strict` runs / first is clean; second errors that pilot decisions have no grill.md | int | Every decision taken alone leaves an evidence trail |
| 30 | a valid grill.md written with CRLF line endings / validate runs / 0 errors (sections and cap read the same as LF) | int | The mandate is recorded as the change's operating model |
| 31 | `autopilot.md` / read / an argument naming an open change (or an active one) without grill.md resumes at its status's stage per `auto.md`/`next.md`, never rewrites `change.md` nor re-runs a finished stage, and grills only unsettled items (priorities, escalations, delegation, open markers) | unit | After confirmation the run never stops to ask |
| 32 | `autopilot.md` / read / a fresh start happens only when the argument matches no open change | unit | One grill up front settles the mandate |
| 33 | a pilot event whose `condition` is `a b`, `x;y` or 60 chars / `validate --strict` / error naming the change and that it is not a token; `cap-pin-exceeded` passes | int | Every decision taken alone leaves an evidence trail |
| 34 | pilot events `cap-pin-exceeded` ×2 and `final-gate` ×1; § Decisions bullets `cap-pin-exceeded` ×2 + an unrelated prose line / `--strict` / error naming `final-gate` as unexplained (prose line not counted) | int | Every decision taken alone leaves an evidence trail |
| 35 | § Mandate `- Refused (stops the run): ship-approval, data-loss` and a pilot event `ship-approval` with a matching bullet / `--strict` / error naming `ship-approval` as refused | int | After confirmation the run never stops to ask |
| 36 | pilot events in session B, `delegation` only in session A / `--strict` / error; add a session-B `delegation` before them / clean; pilot events with no `delegation` at all / error | int | After confirmation the run never stops to ask |
| 37 | `journal.mjs note x` run with `CLAUDE_CODE_SESSION_ID=s1` / the event carries `session: "s1"`; without it / no `session` key | int | Every decision taken alone leaves an evidence trail |
| 38 | a grill.md whose mandate is within cap but § Decisions pushes the file past 80 / validate / no cap error; mandate alone past 80 / cap error | int | The mandate is recorded as the change's operating model |
| 39 | every anchor `autopilot.md` cites (`auto.md` escalation table + Gather/Confirm/Run steps, `next.md` §2 line `2. Answer for the current change`, `groom.md` step 1, `new.md` §5) / read / each exists in its file | unit | One grill up front settles the mandate |
| 40 | a strict run whose pilot condition carries a bidi override and fails token, bullet and delegation checks / validate / every issue line shows it escaped, none raw | int | Every decision taken alone leaves an evidence trail |
| 41 | `journal.mjs note x event=delegation ts=2000-01-01T00:00:00Z session=forged` with `CLAUDE_CODE_SESSION_ID` unset / the event is `x`, its `ts` is now, no `session` key | int | Every decision taken alone leaves an evidence trail |
| 42 | a session-A `delegation` then a pilot event with no session / `--strict` fails; a fully sessionless journal (delegation, then pilot) / clean | int | After confirmation the run never stops to ask |
| 43 | Mandate `- refused (stops the run): ship-approval` and a pilot `ship-approval` / strict fails as refused; `- Refused: ship-approval data-loss` / warns the entry is not a token | int | After confirmation the run never stops to ask |
| 44 | grill template / read / a fixed token per `auto.md` escalation row plus `hardfloor-midrun`, `cap-pin-exceeded`, `final-gate-env-failures`, and autopilot.md tells the agent to reuse them; autopilot.md ≤ 60 effective lines | unit | One grill up front settles the mandate |
| 46 | Mandate `- Refused: Ship-Approval` and a pilot `ship-approval` / `--strict` / fails twice: the entry is not a token (error, not warn) and it is refused (case-folded match) | int | After confirmation the run never stops to ask |
| 47 | Mandate refuses `hardfloor-midrun`; a pilot `auth-change` with `hardfloor=yes` / `--strict` / fails as a refused hard-floor; same with `hardfloor=no` / clean | int | After confirmation the run never stops to ask |
| 48 | pilot events journaled `preauth=Pilot`, as event `Escalation`, and with `hardfloor` `YES` / `true` / absent, under a Mandate refusing `hardfloor-midrun` / `--strict` / every one is still checked as a pilot decision and refused as hard-floor; `observe` counts them as pilot | int | Every decision taken alone leaves an evidence trail |
| 49 | `### Hard floors` holding `- payments: no`, `: declined`, a `*` bullet or a bare `- payments` / `--strict` / each errors (allowlist: only `<surface>: approved`); a pilot `hardfloor=approved surface=payments` with `- payments: approved` under a refused `hardfloor-midrun` / clean; the same with no or another `surface` / refused as hard-floor | int | After confirmation the run never stops to ask |

## Out of scope (explicitly untested + why)
- Agent obedience at run time (`evals.md`, `observe`); enforced budget and non-Claude shortcuts (human's choice).
- `/sdlc:auto`/`--auto` — untouched (row 24, unchanged `tests/unattended.test.mjs`); `update` refresh — generic manifest (row 1).
- A delegation event proving a human spoke — the agent writes it; the grill confirmation is the human act.

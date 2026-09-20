# Test contract — change-relations
<!-- cap:60 · written BEFORE code. This is the deterministic half of the contract with the AI; failing tests are generated from this table. -->

| # | Given / When / Then | Kind | Maps to requirement |
|---|---|---|---|
| 1 | two blockers declared / relations are read / both live on the waiting change, and each named change's `change.md` is byte-identical before and after | unit | A change records what blocks it and where it came from |
| 2 | a project where no change declares a relation key / `status --json` and `observe --json` run / the `changes` array keeps its order and every previously present field its value; new fields are additive | int | A change records what blocks it and where it came from |
| 3 | a blocker that is neither open nor archived / validate runs / error names the entry and says to remove it from the list to proceed | unit | A relation must name a real change |
| 4 | a change naming itself, and the same id listed twice / validate runs / each is an error naming the entry | unit | A relation must name a real change |
| 5 | `blocked-by: [archive]` and `blocked-by: [ARCHIVE]` / validate runs / both refused as naming no change, and neither ever counts as an open blocker | unit | A relation must name a real change |
| 6 | a change archived as `<date>-add-auth` and a blocker named `auth` / validate runs / refused — only the whole id satisfies a blocker; `add-auth` satisfies it | unit | A relation must name a real change |
| 7 | an entry with a separator, `..`, `:`, a trailing dot or space, a Windows device name, an ANSI escape, a bare CR, or a bidi override / validate runs / refused, no path derived from it, and what is echoed back is escaped and length-capped | unit | A relation must name a real change |
| 8 | `blocked-by: change-x` as a scalar, `blocked-by: [2026]`, and a list of the wrong shape / validate runs / each errors naming the value | unit | A relation must name a real change |
| 9 | A waits on B, B on C, C on A / validate runs / error names the changes in the cycle and no ordering is reported | unit | Relations never form a cycle |
| 10 | `spawned-from` forming a two-change loop / validate runs / it is an error, and no walk of the discovery direction hangs | unit | Relations never form a cycle |
| 11 | a waiting chain of exactly three, then one of four / validate runs / three raises nothing, four warns on the chain length without erroring | unit | Relations never form a cycle |
| 12 | a cycle between two changes / ship runs on a third, then project-wide validate runs / both report the cycle — single-change and full-scan validation give the same verdict | int | Relations never form a cycle |
| 13 | a cycle plus a relation naming a hand-deleted change / status, `status --json` and observe run / all three list every change, none throws, none claims an ordering | int | Reporting survives a graph that does not validate |
| 14 | a change waiting on two others / status runs / both names appear and the machine output carries them, distinguishable from an idle change | int | Status says why a change is paused |
| 15 | a change with an open blocker / ship runs / fails naming every open blocker, and specs, the `status:` line and the folder location are all unchanged | int | Shipping refuses while a blocker is still open |
| 16 | a blocker still under `changes/` but stamped `status: shipped` / ship runs on the waiting change / still refused — only an archived blocker is satisfied | int | Shipping refuses while a blocker is still open |
| 17 | a change waits on two, the first ships / ship runs / it is reported still waiting, naming the remaining blocker, and is not called resumable | int | Shipping reports who it freed and who is still waiting |
| 18 | the last blocker ships / ship runs / the waiting change is reported free to resume, with the command that resumes it | int | Shipping reports who it freed and who is still waiting |
| 19 | a change waiting on one open and one archived blocker, the open one ships / ship runs / it is reported free to resume; the archived one never counted as open | int | Shipping reports who it freed and who is still waiting |
| 20 | a diamond — D waits on B and C, both wait on A — and A ships / ship runs / B and C are reported freed, D still waiting on two, and D is not offered as next work | int | Shipping reports who it freed and who is still waiting |
| 21 | a waiting change's `change.md` replaced by a directory / an unrelated change ships, then project-wide validate runs / the ship succeeds and warns the freed report is incomplete, while project-wide validation reports the unreadable change as an error | int | Reporting survives a graph that does not validate |
| 22 | every blocker shipped and nothing since / observe runs / a flag reports it freed but not resumed | int | A change freed long ago but never resumed is surfaced |
| 23 | two changes waiting on one / observe runs / a flag reports how many wait on it | int | A change freed long ago but never resumed is surfaced |
| 24 | two ready changes, two others waiting on the first / status runs / the first is ordered ahead, and the count that decided it appears in the human listing as well as the machine output | int | Among ready changes, the one that frees the most goes first |
| 25 | three ready changes, same tier, no journal events (a fresh checkout) / the order is asked for twice / the order is identical across runs | int | Among ready changes, the one that frees the most goes first |
| 26 | an archive folder named for a blocker but holding no shipped change — empty, or a `change.md` whose id or status does not match / validate and ship run / the blocker still counts as open and the change waiting on it is refused | int | A relation must name a real change |
| 27 | the ship playbook / it is read / it tells the stage to relay the freed / still-waiting report and to record it in the digest | unit | Shipping reports who it freed and who is still waiting |
| 28 | the session's active change waits on an open change / the next step is asked for / the blocker is named as the work and the waiting change is not | int | Next answers for this session's change first |
| 29 | a waiting change and a ready one / the order is asked for / only the ready one is named | int | Among ready changes, the one that frees the most goes first |

## Out of scope (explicitly untested + why)
- Parking a change — moved to its own change, opened from this one; four of the six review
  blockers on the first draft came from it, and its write path needs its own security contract.
- Write-time hook coverage — `validate-artifact.mjs:30` calls `validateChange`, which takes no
  `sdlcRoot`. Passing one is additive and would work; keeping the full-graph scan off the
  keystroke path is a cost decision, stated in Assumptions rather than a constraint.
- A declared priority key — ordering is derived; see the Design decision.
- Concurrent ships racing on one waiter — the freed report may be stale; `status` is authoritative.

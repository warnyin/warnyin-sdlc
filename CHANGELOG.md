# Changelog

## 0.21.0 (2026-09-24)

- **Feature (model routing per stage)**: stage commands now pick a model for their stage.
  `verify`, `next`, `observe` and `update` run on `haiku`, and `contract`, `build` and `review`
  run on `sonnet`. Judgment stages (groom, new, design, init, steer, converge, feedback, auto,
  autopilot, ship) carry no override and run on your session's model. No stage costs more than
  before. To change a direct command's model, edit its stub: `update` keeps your edit.
- **Unattended runs delegate work units at their tier**: in `/sdlc:auto`, `/sdlc:autopilot` and
  `--auto`, every build task goes to its own `sdlc-builder` at its `[tier:x]`, whatever the
  count. A task on a hard-floor surface is never below balanced. The verify test run goes to the
  new `sdlc-runner` (haiku), which returns pass/fail per contract row with short failure
  excerpts; verify reads that report as data. Grill, confirmation and escalation decisions stay
  in the main session. The rule lives in `routing.md` § Unattended delegation.
- **`--auto` on a tiered command hands off**: a model override lasts the rest of the turn. So
  `/sdlc:contract|build|verify|review <id> --auto` finish their own stage, then tell you to
  continue with `/sdlc:auto <id>`. Gathering, confirming and deciding never run on the cheaper
  model. `new`, `design` and `ship` given `--auto` still carry on to ship.
- **`## Stage routing` in `harness.md`**: new projects get a table from each stage to a tier
  (cheap, balanced, deepest or session). Its `build` and `verify` rows set the builder default
  and the runner's model for delegation. The other rows record each command's `model:`. Existing
  projects keep their harness, and delegation falls back to `routing.md`'s defaults.
- **Review panel**: `sdlc-architect` moves from opus to sonnet, so no agent defaults to opus.
- **Fix (cost)**: `/sdlc:observe` overcounted every change. The Stop hook records a session's
  running total at every turn, and observe summed all those records: about 5× on a long
  session. Each session now counts once, at its latest record, so reported costs for existing
  changes drop to their real figure. Session cost now also includes the subagents it spawned
  (`<session>/subagents/agent-*.jsonl`), which were never counted before.
- **Known gap, recorded**: `sdlc-runner` has Bash, and hooks match Edit/Write only, the same
  accepted gap as `sdlc-contractor`. See `docs/design.md`.

## 0.20.0 (2026-09-24)

- **Feature (autopilot)**: `/sdlc:autopilot <idea|change-id>` is a delegate above `/sdlc:auto`.
  It grills you once, up front, in rounds: the requirement, your priority order among
  requirement, quality, time and cost, a choice for every escalation, each hard-floor item, and
  whether a hard-floor found mid-run may be decided without you. Nothing is written until you
  confirm. Then it runs to ship without asking again — even past conditions `auto` cannot
  pre-approve, such as `cap-pin-exceeded` — deciding each by your priorities, preferring the
  reversible option. It resumes a change you already opened and grills only what is unsettled.
  `/sdlc:auto` and `--auto` are unchanged.
- **Every decision it takes alone is on the record, and checked**: the mandate lives in
  `sdlc/changes/<id>/grill.md` (who delegated, priorities, what may and may not be decided), and
  each decision adds one `§ Decisions` bullet with how to recover from it — written before an
  irreversible act — plus a `preauth=pilot` journal event carrying a kebab token, never prose.
  `archive` (strict validate) refuses a pilot decision with no bullet, one on a condition you
  refused, or one made in a session where you did not confirm the delegation. The grill template
  fixes one token per escalation, plus `cap-pin-exceeded`, `final-gate-env-failures` and
  `hardfloor-midrun`, so a refusal binds the decision it names; refusals match case-folded, a
  malformed refusal fails strict validation, and refusing `hardfloor-midrun` refuses every
  hard-floor decision whatever it was called. Journal fields are read fail-closed: casing never
  changes what an event is, and a `hardfloor` other than `no` or `approved` counts as `yes`. A
  hard-floor surface is approved (`- payments: approved`; a decision on it names
  `surface=payments`) or refused as a token — anything else under `### Hard floors` fails, and an
  `approved` flag without a matching surface counts as `yes`. The hard-floor flag, like the
  delegation event, is recorded by the agent: validate holds it to what it recorded, and a decision
  it never flagged is outside what any check can see. `journal.mjs note` now records the session when the harness provides one, and ignores
  `event=`, `ts=` and `session=` passed as arguments. A delegation event is written by the agent:
  it proves a confirmation was recorded for the run, not that a human spoke — the grill is that.
- **You take ownership back at ship**: the digest lists pilot decisions apart from pre-approved
  ones, hard-floor first, and `observe` counts them as `pilot×N`.

## 0.19.0 (2026-09-20)

- **Feature (parking)**: a change you are not ready to work on can step aside instead of
  competing for attention forever. `node sdlc/.hooks/journal.mjs park <id>` takes the reason on
  stdin as `{"reason": "..."}` — never as an argument, because human prose on a command line is
  the hazard the framework refuses everywhere else — and `unpark <id>` brings it back. A parked
  change keeps its stage, drops out of the listing, the ordering, next work and the
  freed-but-not-resumed flag, is counted in the summary and listed with `status --all`, and
  refuses to be made active or shipped until it is unparked. Nothing may be stranded behind one:
  parking a change others wait on is refused, and so is a `blocked-by` that names a parked change.
- **Writes into your files are checked at the path being written**, immediately before the write
  and with the kernel refusing to follow a symlink where the platform allows it. The same rule
  now guards the journal append, which previously checked only `sdlc/.state` and would follow a
  planted `.state/journal` link out of the project.
- **A park or unpark that did not happen is never reported as done**: both prove the file changed
  and re-read it to confirm the state they intended, and a failing write exits non-zero naming
  the change instead of exiting silently.

## 0.18.0 (2026-09-20)

- **Feature (relations)**: a change can now say what it is waiting on. `blocked-by: [id, ...]`
  and `spawned-from: [id, ...]` in a change's frontmatter record the link that used to live only
  in someone's head — you opened a change, found something underneath it, opened another, and
  nothing tied the two together. The edge is stored once, on the change that is waiting; the
  reverse direction is derived, so there is no second copy to drift. Many changes can wait on
  many, which is why `ship` **counts** rather than announces: shipping one of two blockers
  reports the waiter as still waiting and names what remains, and only the last one frees it —
  with the command that resumes it. That report is the point. The moment a paused change becomes
  workable again used to be the one moment with no signal at all.
- **`ship` refuses while a blocker is still open**, before a single spec is merged or a folder
  moved, and an archive folder is now evidence to check rather than a receipt: a blocker counts
  as retired only when the archived change itself says so (matching id, `status: shipped`).
  A planted empty `changes/archive/<date>-<id>/` previously let a change ship straight past a
  blocker that was still open.
- **`status` says why a change is paused** — `⇠ waiting on a, b` — and, for a change that is
  ready, `⇢ frees N`. Ordering among ready changes is derived (frees-most, then tier, then how
  long it has sat), not declared: a `priority:` key would be a second source of truth about what
  matters, and the one nobody re-reads is the one that lies. `observe` flags a change whose
  blockers all shipped but which never resumed, and one that too many are waiting on.
- **Fixed**: `validate` crashed with a raw Node stack trace, reporting nothing, when a
  `change.md` existed but could not be read — it now reports a named issue, which matters
  because the same validator runs inside a write-time hook.

## 0.17.0 (2026-09-19)

- **Feature (groom)**: a new optional stage BEFORE a change exists — `/sdlc:groom "<rough idea>"`
  (`/skill:sdlc-groom` in Kimi Code). `/sdlc:new` starts by writing a Delta, so it can only
  resolve ambiguity it notices once a solution shape is already assumed. Grooming asks the
  earlier question: what breaks today, what done looks like observably, what must not change,
  and the cheapest outcome you would accept — treating the solution you proposed as evidence of
  the problem, never as the scope. It checks feasibility by RUNNING things, so what it hands to
  `new` arrives already verified rather than plausible. It offers two or three shapes with the
  cheapest acceptable one first, and **"not worth building" is a legitimate ending**. It writes
  no artifact and costs no always-loaded budget: its result is simply the Why and Assumptions
  `new` opens with, and no change folder exists until you run `new`. Skip it when your ask is
  already concrete — a ceremonial grooming is garbage.

## 0.16.0 (2026-09-19)

- **Feature (kimi)**: Kimi Code now gets a command per stage, not just a rules file. `init`
  installs 15 skills at `.kimi-code/skills/sdlc-<stage>/SKILL.md`, so a stage runs with
  `/skill:sdlc-new "add OAuth login"` instead of typing "read sdlc/.playbook/new.md and do it".
  They are rendered from the Claude slash-command stubs at install time rather than maintained
  as a second copy, so a stage added for Claude cannot silently miss Kimi. Every skill is
  `disableModelInvocation: true`: a stage runs because you asked, since `ship` merges specs and
  archives. This does not give Kimi hooks — enforcement is still the rules card plus
  `npx @warnyin/sdlc validate`; what changed is invocation, not enforcement.
- **Prune scope**: `update` can now reclaim those skills when Kimi Code is deselected. The
  allowlist matches `sdlc-*/SKILL.md` **only** — `.kimi-code/skills/` is a directory you also
  keep your own skills in, and yours are outside prune's scope entirely rather than relying on
  the hash guard. If you already keep a skill named `sdlc-<stage>`, yours is left untouched and
  unclaimed, and you simply will not receive ours for that stage.

## 0.15.1 (2026-09-19)

- **Doctrine (constitution)**: the verify-or-mark rule is now a hard rule in the seeded
  constitution, not only in the stage playbooks — it extends the assumption rule already there
  rather than competing for a second line of always-loaded residency. New projects get it at
  `init`. **Existing projects do not**: `sdlc/context/constitution.md` is seeded once and
  `update` never overwrites it, by design. To adopt it, add to your own constitution's
  assumption rule: *and SHALL prove by running it any assumption that removes work — or record
  it `[UNVERIFIED]`*. Constitution edits go through `/sdlc:steer`.

## 0.15.0 (2026-09-19)

- **Doctrine (new/contract/review)**: an assumption that *removes work* is now treated as a
  claim about the code, not a judgement call. When a change assumes something need not be
  built, tested or checked — "already covered", "unchanged", "harmless", "pre-existing",
  "self-heals" — the playbook requires running it and proving it before recording it, or
  recording it as `[UNVERIFIED]`. It is the sibling of the rule already there: what the repo
  or tools can answer is looked up, never asked — and never assumed either. The rule is stated
  where the claim is made (`new.md`), where it is spent to drop a test row (`contract.md`'s
  out-of-scope list), and where the review panel picks targets (`review.md`, which now hands
  every reviewer the unverified claims to attack first). The rules card and all three change
  templates carry it too, so a tool with no hooks gets the same rule. Earned the hard way:
  three consecutive changes shipped with a bug hiding inside the very sentence used to argue
  the work away, each disprovable in under two minutes by running it, none of them ever run.

## 0.14.2 (2026-09-19)

- **Fix (init)**: `init` no longer disowns the tools it did not install that run. It rebuilt the
  ownership manifest from scratch and wrote it wholesale, so running `init` a second time for a
  different tool dropped every entry belonging to the first — the files stayed on disk, but
  `update` could no longer recognise them. The damage showed up later: such a file was **never
  refreshed again** (refresh needs the recorded hash to match what is on disk) and was reported
  as `kept (user-modified)`, blaming you for an edit you never made. `init` now carries forward
  every entry it does not rewrite. It still never prunes — only `update --tool <list>` removes
  a tool, and now that a tool installed by its own `init` run is properly owned, deselecting it
  there prunes its files as it always should have.
- **If a project already hit this**, the fix cannot recover a hash nothing recorded. A disowned
  file that still matches the current payload is re-claimed silently on your next `update`; one
  that has already drifted stays frozen and keeps reporting `kept (user-modified)`. To recover
  it, delete that file and run `update` — it is rewritten from the payload and owned again.

## 0.14.1 (2026-09-19)

- **Fix (init)**: adding a tool to a project that already has `sdlc/` no longer loses it on the
  next update. `init --tool <newtool>` installed the tool's files but never recorded it in
  `sdlc/config.yaml`'s `tools:` line, so the next plain `update` read that stale list and
  **silently pruned the files it had just installed**. `init` now records what it installs,
  added to whatever was already listed — never removing an entry, because `init` has no prune
  capability and this does not give it one. Only `update --tool <list>` still replaces the list
  wholesale and prunes what is left out. The install summary says `(recorded <tools>)` when the
  list actually grew, and only then. A `config.yaml` carrying no `tools:` line at all is still
  left alone, exactly as `update` already leaves it.
- **Fix (config)**: the `tools:` line rewrite — now shared by `init` and `update` instead of
  living inline in one of them — passes its replacement as a function rather than a string, so
  a tool name containing `$&`, `` $` `` or `$'` in a hand-edited config is written literally
  instead of being interpreted by `String.replace` and mangling the surrounding file.

## 0.14.0 (2026-09-19)

- **Feature (init)**: `kimi` (Kimi Code CLI) is now a supported tool. Selecting or detecting it
  installs a dedicated `.kimi-code/AGENTS.md` — the shared rules-card plus a pointer to
  `sdlc/.playbook/` — the same lite-tier treatment every non-Claude tool gets: no hooks, no
  skills, no agents, just the rules-card and the validator as the enforcement floor. Detection
  looks for an existing `.kimi-code/` directory, mirroring `claude`/`cursor`/`windsurf`; its
  absence never blocks picking `kimi` explicitly with `--tool kimi` or `--tool all`. The file
  is manifest-owned like `.cursor/rules/sdlc.mdc`: a hand-written file at that path is left
  untouched and never claimed, and it is correctly pruned if a project later deselects the tool.

## 0.13.0 (2026-09-19)

- **Feature (update notice)**: the notice that a newer version exists now **asks** instead of
  telling. On the first reply of a session whose context carried it, the agent offers a choice —
  **apply now** (recommended), **see what changes**, or **not now** — through the tool's question
  picker where there is one, and as labelled inline options where there is none. **Nothing is
  updated without an explicit pick**: `not now` changes nothing, and `see what changes` runs the
  new `changelog` command, writes nothing, and re-offers the same choice with the decision still
  open. The choice is offered once per session. An **unattended run (`--auto`) is never offered
  it and never updates** — unattended is not consent. When a change is already in flight the
  choice says so and recommends deferring, because the update replaces the very playbooks that
  change was contracted against. Applying reports what it did: files written, kept (named
  individually, with the reason), pruned, and every warning. The agent **never passes `--force`**
  — a prune held back by the blast cap is handed back as its own decision. The doctrine lives in
  `sdlc/.playbook/update.md`, reachable as `/sdlc:update`. Turning the check off is unchanged:
  `updateCheck: false` in `sdlc/config.yaml`, or `CI` / `NO_UPDATE_NOTIFIER`.
- **Feature (CLI)**: `warnyin-sdlc changelog [--since X.Y.Z]` prints what this package changes
  above a version and **writes nothing**. Without `--since` it reads `sdlc/.hooks/version.json`;
  with no project, or an unreadable one, it prints the invoked version's own entry alone. It
  reads the `CHANGELOG.md` already inside the package `npx` downloaded, so it costs no extra
  network request and the notice's one-request-per-24-hours budget is untouched. Entries are
  ordered by parsed version rather than file order, a heading that is not a version is skipped,
  and a `--since` the changelog never names is reported as a gap instead of being passed over.
  The preview is **bounded** — the newest few entries, with the number of older ones it left out
  named and a pointer to `CHANGELOG.md` — because an agent reads it, so it lands in a session's
  context. `update` now prints the same entries for the range it moved the project across.
- **Breaking (update)**: `--force`, the one way past the prune blast cap, now needs a person at
  the terminal. Without an interactive terminal it refuses and changes nothing; automation that
  always meant to force sets `WARNYIN_SDLC_FORCE=1`. Before this release the only thing standing
  between an agent and an uncapped delete was a sentence asking it not to — and an `npx` run
  through an agent's shell is seen by neither the hooks nor the validator.
- **Fix (update)**: an `update` run from a package **older** than the project says so instead of
  moving the version backwards in silence, and prints no entries as if it were a gain.
- **Fix (update)**: `update` refuses to run against the framework's own source from a *published*
  copy — that would overwrite the `payload/` under development — and names `npm run setup:dogfood`
  instead. Running it from the tree it is updating, which is what that script does, still works.

## 0.12.0 (2026-09-18)

- **Feature (verify)**: `/sdlc:verify` no longer runs your full test suite after every fix
  ([#7](https://github.com/warnyin/warnyin-sdlc/issues/7)). Each fix round runs a **fast gate**:
  the tests covering the contract and the files you touched, a live smoke check when the change
  has a CLI, server or UI to run, and the evals. The **final gate** runs the full test command
  once, after review, and only it marks a change `verified`. The flow is now
  `build → verify (fast) → [review] → verify (final) → ship`. Name a quick subset as
  `fast test command` in `sdlc/harness.md` if you have one; without it verify derives the tests,
  and falls back to the full command when it cannot. When the fast gate already ran the full
  suite and nothing was built since, the final gate reuses that run and the digest says so.
  Review signals are defined once, in `review.md`: verify checks them itself every time; once
  the journal shows a fast pass (or the change is verified) review always runs, in any session;
  and a fix review applies itself counts as a build, so the fast gate covers it. A change with a build after its final gate goes back to
  verify before ship.
  Before the final gate runs the full suite it asks you to run or skip it (run is recommended;
  `--auto` asks once, up front). A vibe change skips it without asking. A skip still marks the
  change `verified`, is recorded as `result=skipped by=tier|human`, is not counted as a round
  by `/sdlc:observe`, and the digest says the full suite never ran before ship.
  Journal verify notes gain `gate=fast|final`; `/sdlc:observe` counts fast outcomes and final
  failures as rounds, and a final failure clears first-pass. Existing installs get the new
  doctrine with `update`. `update` never rewrites your `sdlc/harness.md` or
  `sdlc/context/constitution.md`: add the optional key yourself, and your constitution's flow
  line keeps the old order until you edit it through `/sdlc:steer`. The playbooks are what
  the agent follows. A change already `verified` under the old flow still ships; if review
  signals apply and no review was recorded, ship sends it to review first.

## 0.11.0 (2026-09-17)

- **Feature (new)**: `/sdlc:new` clarification questions can now be answered by picking an
  option instead of typing ([#6](https://github.com/warnyin/warnyin-sdlc/issues/6)). A question
  with a few concrete answers now comes with 2–4 options, the recommended one first and marked,
  each with its trade-off. An open-ended question keeps a single recommended answer and never
  gets invented options, and an answer outside the options is applied as given. In Claude Code
  option questions go through its question picker (`AskUserQuestion`): at most 4 questions and
  2–4 options a prompt, with Other for a free answer, so a bigger round arrives as consecutive
  prompts and no later round starts until every question is answered. Tools without a picker
  get the options lettered inline, so you can reply `1b, 2a`. The round, defer and
  confirmation rules are unchanged, and `--auto` still folds everything into its single
  confirmation. The rules card for Cursor and Windsurf carries a summary. Existing installs get
  the new doctrine with `update`.

## 0.10.0 (2026-09-14)

- **Feature (update notice)**: a project is now told when a newer `@warnyin/sdlc` exists. Once a
  day the SessionStart hook hands a background process one request to the npm registry for the
  `latest` version; the session never waits on it. When the installed version (recorded in the
  new `sdlc/.hooks/version.json`) is older, the next session's context opens with one line
  naming both versions and `npx @warnyin/sdlc@latest update`, and telling the agent to mention
  it and not run it. It repeats at every session start (including resume and `/clear`) until
  the project is updated or the check is off. Nothing updates by itself. Only a plain `X.Y.Z` from the registry is ever cached
  or shown; redirects, bodies over 64 KiB and anything slow or broken leave silence. **Existing
  installs are on by default** after `update`, because `update` never rewrites your
  `sdlc/config.yaml`: add `updateCheck: false` there to switch it off, or set `CI` or
  `NO_UPDATE_NOTIFIER`. Behind a proxy the check stays silent (Node's fetch ignores
  `HTTPS_PROXY`). Claude Code only; other tools install no hooks. `update` now always rewrites
  `sdlc/.hooks/version.json`, even where your other hook files are kept.
- **Release**: versions are now published by GitHub Actions from a pushed `vX.Y.Z` tag through
  npm trusted publishing, with a provenance attestation that links each tarball to its commit
  and workflow run. No npm token is involved.

## 0.9.0 (2026-09-14)

- **Feature (new)**: `/sdlc:new` now asks its clarifying questions in rounds that follow
  their dependencies. Before this, it asked every question it could not safely assume in
  one batch. A question whose answer hinged on another was asked too early, so the human
  answered it blind or the agent quietly re-decided it later. A round now holds every open
  question whose prerequisites are already answered. A question that depends on one still
  open waits for a later round, and one an earlier answer made moot is dropped. Each
  question is numbered and comes with the agent's recommended answer, so you can reply by
  number. Anything the repository or tools can answer is looked up instead of asked. After
  the last round the settled answers are restated for confirmation, and correcting one
  reopens that question. A change that asked nothing needs no confirmation. The
  assume-safely policy is unchanged, and `--auto` still puts questions and answers into
  its single confirmation. The rules card carries a one-line summary for non-Claude tools.
  Existing installs get the new doctrine with `update`.

## 0.8.0 (2026-09-14)

- **Feature (lenses)**: stages now bring in UX/UI, API or data expertise only when a change
  needs it. Before this, every change got the same fixed stages: design ran only on deep
  tier or architecture signals, and review was always the same four reviewers. `/sdlc:new`
  now reads the Delta, the touched paths and the stack after the Delta is written. It picks
  lenses from `playbook/lenses.md` (`ux-ui`, `api`, `data`) and records them as
  `lenses: [<lens>@project:<skill> | <lens>@user:<skill> | <lens>@builtin]`. Each lens
  names its signals and a ground step: how it reads what exists first (current screens
  and components, the API contract, the schema). It also names what it contributes and
  the stages it joins. Design runs for a recorded lens, and contract carries its bars.
  Review adds one reviewer per lens next to the four core reviewers, which still run.
  Verify scores the lens bars and sends the change to review. A change with no signal
  records no lens and loads nothing new. `validate` rejects unknown lenses, malformed
  sources, a lens recorded twice, and a scalar `lenses`. Lens names live only in
  `lib/lenses.mjs`, and they are only ever added.
- **Feature (skills)**: `warnyin-sdlc skills [--json]` lists the Claude skills and agents
  installed for the project and for the user (`.claude/skills/*/SKILL.md`,
  `.claude/agents/*.md`). Lenses resolve against this list strictly: project, then user,
  then builtin. Skill files are third-party content, so the listing reads only the first
  8 KiB of each and keeps only frontmatter `name` and `description`. It strips control,
  C1 and bidi characters and cuts descriptions at 160 chars. It stops at 200 entries and
  opens at most 1000 per directory. It skips project entries whose real path leaves the
  project. A skill that is missing is suggested and never installed. A skill that is
  read later is reference material, not directives. `~/.claude/plugins/` and other
  tools' rule files are not scanned yet.
- **Harness template**: installing a skill or agent is now an escalation to the human.
  Existing installs keep their seeded `sdlc/harness.md` unchanged, because `update` never
  refreshes user-owned seeds. Add the line by hand if you want it.

## 0.7.0 (2026-09-14)

- **Fix (next)**: with several changes open, `/sdlc:next` gave every one of them its own
  next command and gave the change this session was actually on no precedence — so the
  agent walked off onto someone else's change mid-flight. Underneath, the active-change
  pointer was one project-wide file: two sessions overwrote each other's focus, and hooks
  recorded one session's telemetry against the other's change. The pointer is now kept per
  session at `sdlc/.state/sessions/<session-id>.json`, with `.state/active.json` still
  written as the project-wide fallback. `status` lists the current change first and marks
  it `← this session`, or `← last set for project` when this session has not set one; other
  changes are marked `(not this session)` only when this session set its own pointer.
  `status --json` gains `current: {id, source}` and keeps `changes` in their original
  order. `/sdlc:next` answers for the marked change, and a human who names a different one
  wins. Hooks take the session from their stdin `session_id`; shell-run commands read
  `CLAUDE_CODE_SESSION_ID`, which Claude Code does not document, so when it is absent — and
  in every other tool — the project-wide pointer answers exactly as before. A session's own
  pointer does not survive resume or `/clear`, which start a new session id. (#4)
- **Fix (pointers)**: a session id now becomes a filename, so it is refused — not stripped —
  by the same single-safe-segment rule as change ids; the steering-seen file uses
  `nosession` for an unsafe id instead of aliasing `a/b` onto `ab`. Pointer reads and
  writes check that the real path is where it claims to be, so a link planted at `.state`,
  `.state/sessions` or the pointer file itself — a dangling one included — cannot carry a
  write out of the project. `set-active` now exits 2 for an id that is not an open change
  rather than writing a pointer that is then ignored, and reports a refused write instead
  of claiming success; `archive` removes the pointers naming the change it ships.
  Journal and `phase.json` writes do not have this check yet. Downgrading to 0.6.0 leaves
  `.state/sessions/` unread and harmless on disk.

## 0.6.0 (2026-09-10)

- **Fix (auto)**: the Confirm step of an unattended run showed the scope it had settled on
  and asked for approval, but never how it got there — so a derivation that searched the
  wrong thing was approved as readily as a right one. It now shows, per scope item, the
  command that established it and what that command returned; a summary of what a search
  found does not count. Evidence that searched a term the request did not name is flagged
  with both terms side by side, a narrowing the request never asked for (a folder pattern,
  a naming convention) becomes its own refusable item, and an exclusion made on an empty
  result must name the pattern searched — finding nothing is a claim about the pattern, not
  a fact about the candidate. This is doctrine the model follows, checked by tests on the
  doctrine and by the eval rubric; the confirmation is written at runtime, so nothing gates
  it mechanically. (#2)
- **Fix (journal)**: telemetry the hooks append lived in `sdlc/changes/<id>/journal.ndjson`,
  which git tracks, so merely opening a project modified a shared file no human touched —
  `git pull` and branch switches refused to move until someone discarded it, and two people
  on one change conflicted on the appended tail for a reason unrelated to the change under
  review. While a change is open, telemetry now goes to `sdlc/.state/journal/<id>.ndjson`;
  `.state/` is already git-ignored in every installed project, so no new `.gitignore` entry
  and no `git rm --cached` is needed. `archive` seals the journal into the shipped change
  folder in one write at ship, so `/sdlc:observe` still reports cost and verify history for
  changes a teammate shipped. Projects installed before this keep their in-tree journal: it
  is read alongside the new stream and consumed at ship, so no recorded event is lost.
  Two interim states worth knowing: a project that runs `update` mid-change carries telemetry
  split across the two files until that change ships, and downgrading to 0.5.2 afterwards
  leaves anything under `.state/journal/` unread by the older code — it is still on disk,
  but that version does not know to look there. (#3)

## 0.5.2 (2026-08-25)

- **Fix (delta)**: a `### MODIFIED Requirement:` body replaces the requirement wholesale,
  so one that carried over only some of the spec's scenarios dropped the rest in silence —
  no error, no warning, `spec merged` printed either way. Both shapes are now reported:
  the scenario name gone from the replacement body, and the name surviving while WHEN/THEN
  clauses it promised have no counterpart (the one a name-level comparison cannot see).
  `archive` prints the report before it writes a byte and counts it in the summary;
  `validate` reports the same at warn level, so the loss is visible while the change folder
  is still readable rather than after ship archived it. A warning, never an error — removing
  a scenario is sometimes the point of the change, and only the silence was ever the bug.
  A reworded clause reports the same as a deleted one: nothing mechanical can tell "said
  better" from "promises less". Cosmetic churn — indentation, bullet marker, clause order,
  heading case, whitespace — is normalized away and never warns. (#1)

## 0.5.1 (2026-08-25)

- **Fix (cost)**: `costUsd()` never charged cache-write tokens, the highest-rate of
  the four classes the usage parser collects. Every cost `/sdlc:observe` and the
  session summary have printed was therefore low. A model priced without a
  `cacheWrite` rate now charges nothing for that class rather than inferring one from
  `input` — the module's rule is never to guess a price, and a guess reports as
  confidently as a known rate. Existing journalled costs are left alone: backfilling
  would rewrite history from a rate that was not in force at the time.

## 0.5.0 (2026-08-25)

- **`--auto` on every pipeline stage.** `/sdlc:auto` already ran the whole pipeline,
  but it stopped at every escalation — so you were pulled back in three or four times
  per change and typed each stage anyway. Now all seven stage commands take `--auto`:
  the run gathers what it needs, confirms once, and goes to ship. The confirmation is
  decidable item by item — scope as understood, the tier and why, every ambiguity with
  the assumption to be acted on, and each escalation as its own refusable line, the
  ship row naming the hard-floor surface it covers instead of hiding behind a general
  "run without me". Nothing is written before you confirm, down to the active-change
  pointer, so declining leaves the repository untouched. The approval covers that run
  only — not config, not the next change, not a resume. Anything outside what you
  confirmed still stops and asks.
- Escalations passed unattended are journalled, counted by `/sdlc:observe` as
  `unattended×N`, and listed in the digest: the record shows where a human would
  normally have stood and, that run, did not.
- **Verify and review outcomes now record how they were produced** (`mode=panel|solo`).
  A journal that says "verify passed" hides the thing a reader most needs later —
  whether that verdict came from independent reviewers or from the same loop that
  wrote the code. `observe` marks such changes `self-judged`, and the digest must name
  self-produced outcomes. Absent provenance reads as unknown, never as `panel`, so
  older journals are not retroactively dressed up as independently reviewed; where
  provenance is mixed, the weakest link decides.
- Where a panel cannot run, the playbooks now say to judge in the main loop and record
  that — not to skip the stage. A review that never happened is worse than one
  labelled honestly.
- The constitution gains a hard rule: human-written text SHALL NOT reach a shell as an
  argument. It is the defect that got past two separate gates in 0.4.0.

## 0.4.0 (2026-08-25)

- **New stage command `/sdlc:feedback`** — reports a bug, a rough edge, or a missing
  feature in the framework itself to `warnyin/warnyin-sdlc`, from inside the session
  where you hit it. It collects the context a maintainer triages by (framework and
  Node version, OS, tool adapter, active change id and status), redacts it, shows you
  the complete draft, and files it only after you approve. Submission goes through
  `gh`; when `gh` is missing, logged out, or authenticated only against an enterprise
  host, you get a prefilled issue URL instead — a normal path, not an error.
  Nothing is attached automatically: no logs, no journal, no diff. Redaction is a
  rule list rather than a guarantee, and the playbook says so — your eyes on the
  draft are the control.
- Human-written text never reaches a shell as an argument: the body travels over
  stdin, while the title and the duplicate-search keywords are written by the agent
  under a length and character allow-list instead of being pasted raw.
- **New: `warnyin-sdlc version`** (also `--version` / `-v`). Nothing in an installed
  project was readable as a version — an npx install leaves no package behind — so
  every bug report would have carried `unknown` in the field that decides whether a
  report can be acted on at all.
- The repository now ships `.github/ISSUE_TEMPLATE/` bug and feature forms asking for
  the same fields the command collects, so web-filed and command-filed reports read
  alike.

## 0.3.0 (2026-08-21)

- **`/sdlc:auto` resumes an open change** instead of always starting at `new`. It
  resolves its entry stage from `sdlc status` first: an argument naming an active
  change maps that change's status to the entry stage and the pipeline starts
  there, keeping the tier, Delta and Assumptions it was already triaged with. Only
  an argument matching no active change starts at `new`. The entry stage is stated
  in the plan line, so a resume is never silent. The status → stage table stays in
  `next.md` alone rather than being copied into a second place that can drift.
- **Fix (ownership)**: `installFile` dropped a file's manifest entry whenever it
  kept the file. The next run then saw a path it had never installed, which
  permanently disarmed `update`'s refresh branch — the file froze at its old
  payload version and every later run relabelled it user-modified. That affects
  anyone who re-runs `init` to upgrade before `update`. A kept file now carries
  its recorded hash forward; prune is unaffected (its guard compares the file on
  disk against that same hash) and in fact strictly safer, since a kept file is no
  longer even a prune candidate.
- A file whose content still matches its recorded hash is reported as
  `kept (ours, older version — run update to refresh)` instead of
  `kept (user-modified)`, which sent people hunting for an edit they never made.

## 0.2.2 (2026-08-20)

- `init` (and `update`) now drop a `.gitkeep` in `sdlc/changes/archive/`, so the
  directory survives a commit and is still there after a clone. 0.2.1 made
  `archive` recover from the missing directory; this stops it going missing.
  The marker is not payload-owned — prune never reclaims it and the installer
  never warns about it.

## 0.2.1 (2026-08-20)

- **Fix**: `archive` failed with `ENOENT` on the first change a repo ever ships.
  `init` scaffolds `sdlc/changes/archive/`, but git does not track empty
  directories, so the folder is absent for everyone who clones before that first
  ship. The rename is now preceded by a `mkdir -p` of the archive root.

  The failure landed mid-phase-2, after the delta had been merged into the living
  specs, evals promoted, `status: shipped` stamped and the ship event journalled —
  a repo left half-shipped while the CLI reported total failure. The directory is
  now prepared next to the other destination checks, before phase 1 computes a
  single merge, so an unusable archive path aborts with the specs untouched.

## 0.2.0 (2026-08-20)

`init` is now an installer you can actually see working — still zero dependencies.

- **Interactive tool picker**: a searchable checkbox list replaces the
  comma-separated typing prompt. Arrows move, `space` toggles, typing filters,
  `ctrl+a` selects everything on screen, `enter` confirms, `ctrl+c` cancels
  without installing anything.
- **Tool detection**: tools the project already uses (`.claude/`, `.cursor/`,
  `AGENTS.md`, …) come pre-selected; an empty project still defaults to claude.
- **Post-install summary**: artifact counts, the adapter path per tool, a
  written/unchanged/refreshed/kept tally, and Getting-started hints that differ
  per tool (slash commands for Claude Code, prose for the rest).
- **Colour** gated on `NO_COLOR` > `FORCE_COLOR` > TTY, with an ASCII glyph
  fallback for legacy Windows consoles.
- `--tool` accepts `all` and `none`; `--tools` is an alias. An empty `--tool`,
  an unknown tool, or `all` mixed with a named tool now fails loudly.
- **Fix**: `update` read an explicit `tools: []` (what `init --tool none` writes)
  as "unset" and reinstalled claude. A missing key and a declared-empty one are
  now distinguished.

## 0.1.2 (2026-08-20)

- Fix: `readStdinJson()` grew a 1s grace timeout — journal and hook utilities no
  longer hang when stdin is open but idle.
- Fix: hooks release stdin (pause + unref) so an open-idle stdin cannot keep a
  hook process alive.

## 0.1.1 (2026-08-20)

- Fix: the entrypoint guard must realpath `process.argv[1]` — npx invokes through
  a `node_modules/.bin` symlink, which made the CLI a silent no-op.
- Fix (CI): `node --test` bare discovery; a quoted glob is not expanded on Node 20.

## 0.1.0 (2026-08-20)

Initial release — the full Day-1 SDLC loop:

- CLI: `init` (multi-tool: claude/cursor/windsurf/copilot/cline/gemini/agents-md),
  `update` (ownership-aware refresh + guarded prune), `validate`, `status`,
  `observe`, `archive`.
- Artifact model: constitution (≤30) + steering with inclusion modes + harness
  (routing/triage/autonomy policy) + living specs + delta-based changes
  (vibe/standard/deep caps 40/100/150) + contracts (tests ≤60, evals ≤40).
- Managed Claude Code hooks: static-context injector, spec write-lock with TTL
  gates, artifact validator + steering pointers, session token/cost journaling,
  compact-event tracking.
- 13 stage playbooks + 13 `/sdlc:*` commands + 3 background skills + 8 agents
  with model routing (cheap/balanced/deepest).
- Observability: per-change tokens/cost, first-pass rate, lead time, dead
  steering and residency flags; post-ship learner loop (distill, never bloat).

# Spec: cost-accounting

## Purpose
How a session's token usage becomes a money figure, and what the reporting does
when it does not know a price.

## Requirements

### Requirement: Every token class the parser counts can be priced
The system SHALL include cache-write tokens in a session's cost whenever the price
table gives a rate for them, and SHALL treat a missing rate as zero for that class
rather than inferring one.

#### Scenario: the rate is configured
- WHEN a session used cache-write tokens and the model's price table lists a rate for them
- THEN the reported cost includes that class

#### Scenario: the rate is absent
- WHEN the model is priced but no cache-write rate is given
- THEN cost is still reported, that class contributes nothing, and no rate is inferred

### Requirement: A session's cost includes its subagents
The system SHALL add to a session's recorded usage the usage of every subagent transcript
that session spawned, per model, and SHALL skip any entry there that is not a regular file.

#### Scenario: a session that delegated work
- WHEN a session's transcript has a `subagents/` folder beside it holding agent transcripts
- THEN the journaled session totals and per-model usage include those agents' tokens

#### Scenario: no subagents, or an unreadable entry
- WHEN the folder is absent, or holds a symlink or a directory named `agent-x.jsonl`
- THEN the totals are the main transcript's alone, and the hook still exits 0

### Requirement: A session is counted once, at its latest total
The system SHALL count, per change, only the latest recorded usage of each session, since each
record is that session's running total; a record carrying no session is counted on its own.

#### Scenario: a session recorded at every turn
- WHEN a change's journal holds three records of one session at 100, 250 and 400 input tokens
- THEN the change reports 400 input tokens and one session, and cost from that record alone

### Requirement: Tokens are reported per stage
`lib/observe.mjs` SHALL add to each change's summary a `stages` list: for each stage event in journal time order, `{stage, input, output, cacheRead, cacheWrite}` (plus `source` when the event has one): the growth of the session totals since the previous stage event, summed over sessions, never below 0 per class. A session's total at an event is its latest record at or before it, 0 before its first. The first stage is measured from the journal's first session record when that is at or before the event, else from 0. It SHALL read live and archived journals alike. `renderReport` SHALL print under a change's line one `    · <stage> <in>in/<out>out` line per stage, and `payload/playbook/observe.md` SHALL tell the reader to show them.

#### Scenario: contract, build, review, verify and ship events
- WHEN the journal holds session records between them
- THEN `stages` lists each in order with its own growth, and their output sums to the total at the last event minus the baseline

#### Scenario: no stage event, or only a review skip note
- WHEN the journal holds session records and no stage event
- THEN `stages` is empty and no stage line is printed

#### Scenario: an archived change, a stage before the first record, or two sessions
- WHEN observe reads them
- THEN the archived journal gives the same stages, an event before the first record grows 0, and each session is counted once
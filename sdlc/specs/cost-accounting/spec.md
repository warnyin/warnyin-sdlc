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
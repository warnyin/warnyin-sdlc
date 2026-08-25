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
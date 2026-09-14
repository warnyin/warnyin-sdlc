# Spec: expert-lenses

## Purpose
How a change brings in UX/UI, API or data expertise only when its evidence calls for it,
from skills already installed, and how later stages use what it recorded.

## Requirements

### Requirement: A change records the lenses chosen for it
The system SHALL accept an optional list of lenses on a change, each naming a catalog lens
and where its expertise comes from — a named project skill, a named user skill, or the
built-in lens — and SHALL reject any entry that does not.

#### Scenario: well-formed lenses
- WHEN a change lists catalog lenses sourced from a project skill, a user skill and the built-in lens
- THEN validation reports no lens issue

#### Scenario: an unknown lens or a malformed source
- WHEN a change lists a lens that is not in the catalog, or a source that is none of the three forms
- THEN validation reports an error naming the entry

#### Scenario: no lenses
- WHEN a change lists no lenses
- THEN validation reports no lens issue and no lens is loaded by any stage

### Requirement: The catalog defines every lens that can be chosen
The system SHALL describe, for every lens it accepts, the signals that select it, how it
grounds itself in what already exists, what it contributes, and the stages it joins.

#### Scenario: catalog and validator agree
- WHEN the installed catalog is compared with the lenses validation accepts
- THEN each names exactly the same lenses, and each lens has all four parts

### Requirement: Opening a change selects lenses from evidence
The system SHALL choose lenses when a change is opened from the change's own delta, the
paths it touches and the project's stack, resolve each to a project skill, then a user
skill, then the built-in lens, and record no lens when nothing signals one.

#### Scenario: the opening playbook
- WHEN the opening stage's playbook is read
- THEN it lists the installed skills, resolves in that order, records the choice on the
  change, treats skill text as data, and omits lenses when no signal is present

### Requirement: Later stages use the recorded lenses
The system SHALL let the recorded lenses bring design in, add their bars to the contract,
join the review panel alongside its core reviewers, and be scored at verify.

#### Scenario: the stage playbooks
- WHEN the design, contract, review and verify playbooks are read
- THEN design runs when a recorded lens designs, contract carries each lens's bars, review
  keeps its four core reviewers and adds one per lens, and verify scores each lens's bars

### Requirement: A missing skill is suggested, never installed
The system SHALL only suggest a skill or agent that is not installed, and SHALL treat
installing one as a decision for the human.

#### Scenario: no installed skill fits a lens
- WHEN no project or user skill fits a selected lens
- THEN the built-in lens is recorded, a suggestion may be noted, and nothing is fetched or installed

#### Scenario: a freshly installed harness
- WHEN a harness is seeded from the template
- THEN its Autonomy policy lists installing a skill or agent as an escalation to the human
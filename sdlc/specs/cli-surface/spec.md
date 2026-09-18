# Spec: cli-surface

## Purpose
What the `warnyin-sdlc` executable itself answers for, beyond installing and moving
changes through stages.

## Requirements

### Requirement: The installed framework version is reportable
The system SHALL report its own version on request, from any project it is installed
in and however it was invoked.

#### Scenario: version asked for
- WHEN the version is requested from an installed project
- THEN the framework's own package version is printed and the command exits successfully

### Requirement: What a newer version changes is reportable without installing it
The system SHALL print the framework's changelog entries for every version above a version it
is given, up to the version of the package it was invoked as, SHALL bound how many it prints
and name how many older ones it left out, and SHALL write nothing to the project.

#### Scenario: changes between two versions asked for
- WHEN the changes are requested from a project at `0.10.0` while the invoked package is `0.12.0`
- THEN the entries for `0.12.0` and `0.11.0` are printed, the entry for `0.10.0` is not, and
  no file in the project changes

#### Scenario: a project many releases behind
- WHEN the range holds more entries than the bound
- THEN the newest entries up to the bound are printed and the number left out is named

#### Scenario: no version given
- WHEN no version is given and the project records none
- THEN the invoked version's own entry alone is printed

#### Scenario: the given version has no entry
- WHEN the version given is not one the changelog names
- THEN the entries above it that the changelog does carry are printed, the gap is stated, and
  the command still exits successfully

#### Scenario: the package carries no changelog
- WHEN the invoked package has no changelog file
- THEN the command says so and exits without error

### Requirement: An update reports what it brought in
The system SHALL, when an update moves a project from one framework version to a newer one,
print the changelog entries between them as part of its result.

#### Scenario: update across two releases
- WHEN a project installed at `0.10.0` is updated by package `0.12.0`
- THEN the update's output carries the entries for `0.11.0` and `0.12.0`

#### Scenario: update at the same version
- WHEN a project already at the invoked package's version is updated
- THEN no changelog entries are printed

#### Scenario: the invoked package is older than the project
- WHEN update runs from a package older than the version recorded for that project
- THEN the result names both versions and says the project is being moved backwards

### Requirement: The framework's own source is never updated from a published copy
The system SHALL refuse the installer's update when the project is the framework's own package
and the invoked package is a different copy of it, and SHALL name that project's own
regeneration command instead. A project updated by the very tree it is remains allowed.

#### Scenario: the framework's own repository, updated from a published copy
- WHEN update runs in a project whose package is `@warnyin/sdlc` from an invoked package that
  lives outside that project
- THEN nothing is installed and nothing is pruned, and the message names `npm run setup:dogfood`

#### Scenario: the framework regenerating its own mirrors
- WHEN update runs in that same project from the very tree the project is
- THEN it proceeds normally, because that is how those mirrors are meant to be rebuilt

### Requirement: Crossing the prune blast cap needs a person at the terminal
The system SHALL refuse `--force` when the invocation has no interactive terminal, unless a
documented environment override is set, so an agent cannot cross the blast cap on its own.

#### Scenario: forced prune with nobody at the terminal
- WHEN update runs with `--force`, no interactive terminal and no override set
- THEN nothing is pruned or written, the run fails, and the message says a person must run it

#### Scenario: automation that means it
- WHEN that same run sets the documented override
- THEN it proceeds, so a script that always intended to force still can
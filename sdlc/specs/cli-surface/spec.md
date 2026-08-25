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
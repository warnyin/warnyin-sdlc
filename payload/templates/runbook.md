# Runbook — <change-id>
<!-- cap:60 · deploy lens; required from `contracted` · headings fixed (English), prose any language · secrets are named, never their values · replace every <…> -->

## Pre-checks
- <what must be true before starting, and the command that shows it: backup taken, build green, access>

## Config & Secrets
<!-- one row per setting; Value source says WHERE the value lives, never the value -->
| Name | Env | New/changed | Value source |
|---|---|---|---|
| <NAME> | <dev, uat, prod> | <new> | <vault path or CI variable> |

## Steps
<!-- one subsection per environment, in rollout order; number steps <env>-1, <env>-2 so Rollback can name them.
     Mark a step that cannot be undone IRREVERSIBLE — a change with one is deep tier (new.md step 1). -->
### <env>
- <env>-1 <step>

## Migration order
<!-- before or after the app deploy, and why. A breaking schema change goes expand/contract:
     expand (additive, old + new app both work) → deploy app → contract (remove old) in a later release. -->
- <migration, when it runs, which app versions it is safe with; "none" if there is no migration>

## Verify
- <env>: <the check, and the result that means it worked>

## Rollback
- <env>-<n>: <how to undo it; for an IRREVERSIBLE step, what restores the data instead>

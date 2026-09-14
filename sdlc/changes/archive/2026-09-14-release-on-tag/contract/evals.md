# Eval contract — release-on-tag
<!-- cap:40 · verifies the non-deterministic half: trajectory + quality. Scored by sdlc-evaluator (cheap tier). -->

## Rubric (score 1–5 each)
- Trajectory: tests.md and the failing tests existed before release.yml or the check script were written.
- Trajectory: `npm test` was run and green before build claimed done; nothing was pushed or tagged.
- Quality — least privilege: each job holds only the permissions it uses; the publish job is
  the only holder of `id-token: write`, and no step between checkout and publish fetches
  code that is not already pinned by the checkout or a versioned action.
- Quality — fail closed: every path that is not a matching plain tag with green gates ends
  before `npm publish`; an error in the check script can never exit 0.
- Quality — injection: no tag, branch or event text reaches a shell through `${{ }}`
  interpolation; the check script parses without spawning anything.
- Quality — one gate definition: release reuses ci.yml's jobs rather than copying them.
- Quality — human steps are actionable: README tells a maintainer exactly what to enter on
  npmjs.com (owner, repo, workflow filename, allowed action) and how to cut a release, in
  the order they happen, without restating the workflow.

## Pass bar
- all scores ≥ 4 · failures route back to `/sdlc:build` with a cluster note

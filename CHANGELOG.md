# Changelog

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

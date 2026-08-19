#!/usr/bin/env node
// PreToolUse hook — the deterministic guardrail ("things the agent should
// never forget but often does"). Denies direct edits to:
//   sdlc/specs/**              outside an open ship gate
//   sdlc/changes/archive/**    outside an open ship gate
//   sdlc/context/constitution.md (existing) outside an open steer gate
//   sdlc/.state/** and any journal.ndjson   always (machine-owned)
// The sanctioned paths are the CLI (`warnyin-sdlc archive`) and the gates
// opened by `journal.mjs open-ship|open-steer`.

import fs from 'node:fs';
import process from 'node:process';
import path from 'node:path';
import { resolveRoots, readStdinJson, readPhase, activeChange, appendJournal, toPosixRel } from './_shared.mjs';

const { sdlcRoot, projectRoot } = resolveRoots(import.meta.url);

function deny(reason, rel) {
  appendJournal(sdlcRoot, activeChange(sdlcRoot), { event: 'guard', action: 'deny', path: rel, reason });
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
}

async function main() {
  const input = await readStdinJson();
  const filePath = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
  if (!filePath || !fs.existsSync(sdlcRoot)) return;

  const rel = toPosixRel(projectRoot, path.resolve(projectRoot, filePath));
  if (!rel || !rel.startsWith('sdlc/')) return;

  if (rel.startsWith('sdlc/.state/') || rel.endsWith('journal.ndjson')) {
    deny(`"${rel}" is machine-owned (hooks/CLI write it) — never edit it by hand.`, rel);
    return;
  }

  const phase = readPhase(sdlcRoot);

  if (rel.startsWith('sdlc/specs/') || rel.startsWith('sdlc/changes/archive/')) {
    if (phase?.phase === 'ship') return;
    deny(
      `"${rel}" is write-locked outside ship. Living specs change only by merging a change's Delta: `
      + 'run `warnyin-sdlc archive <id>` (or `node sdlc/.hooks/journal.mjs open-ship <id>` first if you must edit).',
      rel,
    );
    return;
  }

  if (rel === 'sdlc/context/constitution.md' && fs.existsSync(path.join(projectRoot, rel))) {
    if (phase?.phase === 'steer' || phase?.phase === 'ship') return;
    deny(
      'The constitution is always-loaded context — edits go through /sdlc:steer '
      + '(`node sdlc/.hooks/journal.mjs open-steer` opens the gate).',
      rel,
    );
  }
}

main().catch(() => process.exit(0)); // fail open

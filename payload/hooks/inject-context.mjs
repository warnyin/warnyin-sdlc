#!/usr/bin/env node
// SessionStart hook — THE static-context loader. Emits (hard cap 60 lines):
//   the missing-argument rule + constitution + every `inclusion: always` steering file + a
//   one-line pointer to the active change. Everything else stays dynamic.
// Journals what was injected so /sdlc:observe can price residency honestly. When a newer
// framework version is known, one notice line leads the output, outside the budget.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { resolveRoots, readStdinJson, activeChange, appendJournal } from './_shared.mjs';
import { parseFrontmatter } from './lib/frontmatter.mjs';
import { CAPS } from './lib/caps.mjs';
import { pickSessionId } from './lib/active.mjs';
import { escapeEntry } from './lib/relations.mjs';
import { updateNotice } from './_update-notice.mjs';

const { sdlcRoot, hooksDir } = resolveRoots(import.meta.url);

const ARG_RULE = "A required command argument the human did not type is a question, never a guess from what the session was just doing; the only default is the `Active change:` pointer, and only for an sdlc command's change id.";

async function main() {
  const input = await readStdinJson();
  if (!fs.existsSync(sdlcRoot)) return;
  const sessionId = pickSessionId(input?.session_id, process.env.CLAUDE_CODE_SESSION_ID);

  const injected = [];
  // First, so truncation (which cuts the tail) never drops it: a project's own command reaches the
  // agent with nothing else loaded, and a missing argument guessed from the session did real damage.
  const out = [ARG_RULE];

  const constitutionPath = path.join(sdlcRoot, 'context', 'constitution.md');
  if (fs.existsSync(constitutionPath)) {
    out.push(fs.readFileSync(constitutionPath, 'utf8').trim());
    injected.push('context/constitution.md');
  }

  const steeringDir = path.join(sdlcRoot, 'context', 'steering');
  if (fs.existsSync(steeringDir)) {
    for (const f of fs.readdirSync(steeringDir).filter((n) => n.endsWith('.md')).sort()) {
      const raw = fs.readFileSync(path.join(steeringDir, f), 'utf8');
      const { data, body } = parseFrontmatter(raw);
      if (data.inclusion !== 'always') continue;
      out.push(body.trim());
      injected.push(`context/steering/${f}`);
    }
  }

  const active = activeChange(sdlcRoot, sessionId);
  if (active) out.push(`Active change: sdlc/changes/${escapeEntry(active, Infinity)}/change.md — run /sdlc:next for status.`);

  const notice = updateNotice({ sdlcRoot, hooksDir });
  let lines = out.join('\n\n').split('\n');
  if (lines.length > CAPS.alwaysBudget) {
    lines = lines.slice(0, CAPS.alwaysBudget);
    lines.push(`[sdlc] static context truncated at ${CAPS.alwaysBudget} lines — run /sdlc:steer to distill (validate also flags this).`);
  }
  console.log((notice ? [notice, ...lines] : lines).join('\n'));

  // `lines` stays the budgeted count; the notice is recorded on its own, outside the budget.
  appendJournal(sdlcRoot, active, { event: 'inject', files: injected, lines: lines.length, notice: Boolean(notice) });
}

main().catch(() => process.exit(0)); // fail open

#!/usr/bin/env node
// Gate + journal utility. Called by playbooks (sanctioned phase transitions)
// and wired as the PreCompact hook (`journal.mjs note compact`).
//
//   node sdlc/.hooks/journal.mjs open-ship <change-id>   unlock specs/archive writes (TTL 30m)
//   node sdlc/.hooks/journal.mjs open-steer              unlock constitution edits (TTL 30m)
//   node sdlc/.hooks/journal.mjs close                   close any open gate
//   node sdlc/.hooks/journal.mjs set-active <change-id>  attribute this session's (and the
//                                                         project's) events to a change
//   node sdlc/.hooks/journal.mjs note <name> [k=v ...]   append a journal event

import process from 'node:process';
import {
  resolveRoots, readStdinJson, writePhase, clearPhase, activeChange, appendJournal,
} from './_shared.mjs';
import { isOpenChange, pickSessionId, writeActive } from './lib/active.mjs';

const { sdlcRoot } = resolveRoots(import.meta.url);

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === 'open-ship') {
    const change = rest[0];
    if (!change) { console.error('usage: journal.mjs open-ship <change-id>'); process.exit(2); }
    const phase = writePhase(sdlcRoot, { phase: 'ship', change });
    appendJournal(sdlcRoot, change, { event: 'gate', gate: 'ship', action: 'open', expires: phase.expires });
    console.log(`ship gate open for "${change}" until ${phase.expires}`);
  } else if (cmd === 'open-steer') {
    const phase = writePhase(sdlcRoot, { phase: 'steer' });
    appendJournal(sdlcRoot, null, { event: 'gate', gate: 'steer', action: 'open', expires: phase.expires });
    console.log(`steer gate open until ${phase.expires}`);
  } else if (cmd === 'close') {
    clearPhase(sdlcRoot);
    console.log('gate closed');
  } else if (cmd === 'set-active') {
    const change = rest[0];
    if (!change) { console.error('usage: journal.mjs set-active <change-id>'); process.exit(2); }
    // A pointer the resolver would ignore must not be written and reported as done.
    if (!isOpenChange(sdlcRoot, change)) {
      console.error(`usage: journal.mjs set-active <change-id> — "${change}" is not an open change under sdlc/changes/`);
      process.exit(2);
    }
    const written = writeActive(sdlcRoot, change, { sessionId: process.env.CLAUDE_CODE_SESSION_ID });
    // A refused write (a planted link under .state/) must be visible, not reported as done.
    if (written.project) console.log(`active change: ${change}`);
    else console.error(`[sdlc] active change "${change}" not recorded: sdlc/.state does not resolve inside this project`);
  } else if (cmd === 'note') {
    // When used as a hook, drain stdin so the harness never blocks on us.
    let stdinInput = null;
    if (!process.stdin.isTTY) stdinInput = await readStdinJson();
    const sessionId = pickSessionId(stdinInput?.session_id, process.env.CLAUDE_CODE_SESSION_ID);
    const name = rest[0] ?? 'note';
    const extra = {};
    for (const kv of rest.slice(1)) {
      const [k, ...v] = kv.split('=');
      if (k && v.length) extra[k] = v.join('=');
    }
    appendJournal(sdlcRoot, activeChange(sdlcRoot, sessionId), { event: name, ...extra });
  } else {
    console.error('usage: journal.mjs open-ship|open-steer|close|set-active|note ...');
    process.exit(2);
  }
}

main().catch(() => process.exit(0)); // fail open

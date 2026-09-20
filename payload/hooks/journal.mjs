#!/usr/bin/env node
// Gate + journal utility. Called by playbooks (sanctioned phase transitions)
// and wired as the PreCompact hook (`journal.mjs note compact`).
//
//   node sdlc/.hooks/journal.mjs open-ship <change-id>   unlock specs/archive writes (TTL 30m)
//   node sdlc/.hooks/journal.mjs open-steer              unlock constitution edits (TTL 30m)
//   node sdlc/.hooks/journal.mjs close                   close any open gate
//   node sdlc/.hooks/journal.mjs set-active <change-id>  attribute this session's (and the
//                                                         project's) events to a change
//   node sdlc/.hooks/journal.mjs park <change-id>       step a change aside; the reason comes
//                                                         on stdin as {"reason": "..."} — never
//                                                         as an argument, it is human prose
//   node sdlc/.hooks/journal.mjs unpark <change-id>     bring it back
//   node sdlc/.hooks/journal.mjs note <name> [k=v ...]   append a journal event

import process from 'node:process';
import {
  resolveRoots, readStdinJson, writePhase, clearPhase, activeChange, appendJournal,
} from './_shared.mjs';
import { isOpenChange, pickSessionId, writeActive } from './lib/active.mjs';
import { park, unpark } from './lib/park.mjs';
import { analyze, escapeEntry } from './lib/relations.mjs';

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
    // A parked change is deliberately out of the way; pointing a session at it would undo that.
    const reason = analyze(sdlcRoot, { rank: false }).byId.get(change)?.parked;
    if (reason) {
      console.error(`"${change}" is parked (${escapeEntry(reason, 60)}) — run \`journal.mjs unpark ${change}\` first`);
      process.exit(2);
    }
    const written = writeActive(sdlcRoot, change, { sessionId: process.env.CLAUDE_CODE_SESSION_ID });
    // A refused write (a planted link under .state/) must be visible, not reported as done.
    if (written.project) console.log(`active change: ${change}`);
    else console.error(`[sdlc] active change "${change}" not recorded: sdlc/.state does not resolve inside this project`);
  } else if (cmd === 'park' || cmd === 'unpark') {
    // These are commands, not hooks: the fail-open catch around main() would turn a failed
    // write into a silent exit 0, which is precisely "reported as done without happening".
    const change = rest[0];
    // The reason is human prose, and prose on a command line is exactly what the constitution's
    // feedback-channel rule forbids. There is no argument form to fall back to.
    const piped = process.stdin.isTTY ? null : await readStdinJson();
    let result;
    try {
      result = cmd === 'park' ? park(sdlcRoot, change, piped?.reason) : unpark(sdlcRoot, change);
    } catch (err) {
      console.error(`cannot ${cmd} "${escapeEntry(String(change))}": ${escapeEntry(err.message ?? String(err), 120)}`);
      process.exit(2);
    }
    if (!result.ok) {
      console.error(result.message);
      if (cmd === 'park' && /reason|change to park|not an open change/.test(result.message)) {
        console.error('usage: journal.mjs park <change-id>  with {"reason": "..."} on stdin — there is no argument form');
      }
      process.exit(2);
    }
    appendJournal(sdlcRoot, change, { event: cmd, change, ...(result.reason ? { reason: escapeEntry(result.reason, 200) } : {}) });
    console.log(result.message);
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
    console.error('usage: journal.mjs open-ship|open-steer|close|set-active|park|unpark|note ...');
    process.exit(2);
  }
}

main().catch(() => process.exit(0)); // fail open

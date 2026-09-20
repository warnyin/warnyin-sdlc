// Parking a change: stepping it out of the way with a stated reason, and bringing it back.
//
// This is the only code that writes `parked:` into a change someone else owns, so every guard
// that failed in the first attempt lives here: containment before any read or write, a reason
// that must survive the round trip through our own reader, a write that is proved to have
// happened, and a refusal to strand anything waiting behind the change being parked.
//
// Reading the key back — `parkReason`, and who is waiting on whom — belongs to
// `lib/relations.mjs`; this module imports from there and nothing imports back.
//
// `node:*` only: copied into user projects as `sdlc/.hooks/lib/`.

import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, setFrontmatterKey, removeFrontmatterKey } from './frontmatter.mjs';
import { isRealPathInside, writeFileContained } from './safe-path.mjs';
import { analyze, escapeEntry, parkReason, PARKED } from './relations.mjs';
import { isSafeChangeId } from './journal.mjs';

const fail = (message) => ({ ok: false, message });

// A reason is human prose, so it is checked for what the FORMAT can carry, never for taste.
// Multi-line is out because a frontmatter value is one line; the rest is settled by the
// round trip, not by guessing which characters are dangerous.
function reasonError(reason) {
  if (typeof reason !== 'string') return 'a reason is required, as text, on stdin';
  if (/[\r\n]/.test(reason)) return 'a reason must be a single line';
  if (reason.trim().length === 0) return 'a reason must say something';
  return null;
}

// Resolves the change's file, refusing anything that is not really where it claims to be. The
// folder is checked before the file: a symlinked folder is the shape that carried the first
// attempt's write outside the project entirely.
function resolveChangeFile(sdlcRoot, changeId) {
  if (typeof changeId !== 'string' || changeId.length === 0) {
    return { error: 'name the change to park' };
  }
  if (!isSafeChangeId(changeId) || changeId.toLowerCase() === 'archive') {
    return { error: `"${escapeEntry(changeId)}" is not a change id — one path segment, not the archive` };
  }
  const dir = path.join(sdlcRoot, 'changes', changeId);
  const file = path.join(dir, 'change.md');
  if (!fs.existsSync(dir)) return { error: `"${changeId}" is not an open change under sdlc/changes/` };
  if (!isRealPathInside(sdlcRoot, dir)) {
    return { error: `"${changeId}" does not really resolve inside this project — refusing to write through it` };
  }
  if (!fs.existsSync(file)) return { error: `"${changeId}" has no change.md` };
  if (!isRealPathInside(sdlcRoot, file)) {
    return { error: `"${changeId}"'s change.md does not really resolve inside this project — refusing to write through it` };
  }
  return { file };
}

// Everything that would be left with nothing to free it. A change that is itself waiting is
// fine to park; a change others wait on is not.
function strandedBy(sdlcRoot, changeId) {
  try {
    return analyze(sdlcRoot, { rank: false }).byId.get(changeId)?.waitedOnBy ?? [];
  } catch {
    return [];
  }
}

// The single write. Containment is re-checked against the exact path here, not at resolve time:
// a whole-tree `analyze()` runs in between, so the earlier check is a window, not a guarantee.
function commit(file, sdlcRoot, text, changeId, verb, result) {
  try {
    if (!writeFileContained(sdlcRoot, file, text)) {
      return fail(`cannot ${verb} "${changeId}": change.md does not really resolve inside this project — nothing was written`);
    }
  } catch (err) {
    return fail(`cannot ${verb} "${changeId}": the write failed (${escapeEntry(err.code ?? err.message)})`);
  }
  return { ok: true, ...result };
}

export function park(sdlcRoot, changeId, reason) {
  const { file, error } = resolveChangeFile(sdlcRoot, changeId);
  if (error) return fail(error);
  const reasonProblem = reasonError(reason);
  if (reasonProblem) return fail(`cannot park "${changeId}": ${reasonProblem}`);

  const waiters = strandedBy(sdlcRoot, changeId);
  if (waiters.length) {
    const are = waiters.length === 1 ? 'is' : 'are';
    return fail(`cannot park "${changeId}": ${waiters.join(', ')} ${are} waiting on it — nothing was written`);
  }

  let before;
  try {
    before = fs.readFileSync(file, 'utf8');
  } catch (err) {
    return fail(`cannot park "${changeId}": change.md could not be read (${escapeEntry(err.code ?? err.message)})`);
  }
  const after = setFrontmatterKey(before, PARKED, reason);
  if (after === null) {
    return fail(`cannot park "${changeId}": change.md has no frontmatter block to carry the reason`);
  }
  if (after === before) {
    return fail(`cannot park "${changeId}": change.md was not changed — nothing was written`);
  }
  // The reader unquotes without unescaping, so a reason like `true`, `2026`, one ending in a
  // quote or one with padding comes back as something else. Rather than invent an escaping
  // scheme this reader cannot undo, prove the round trip and refuse when it does not hold.
  const readBack = parseFrontmatter(after).data[PARKED];
  if (readBack !== reason) {
    return fail(`cannot park "${changeId}": the frontmatter format cannot carry that reason unchanged — it would read back as "${escapeEntry(readBack)}"`);
  }
  return commit(file, sdlcRoot, after, changeId, 'park', { message: `parked: ${changeId}`, reason });
}

export function unpark(sdlcRoot, changeId) {
  const { file, error } = resolveChangeFile(sdlcRoot, changeId);
  if (error) return fail(error);
  let before;
  try {
    before = fs.readFileSync(file, 'utf8');
  } catch (err) {
    return fail(`cannot unpark "${changeId}": change.md could not be read (${escapeEntry(err.code ?? err.message)})`);
  }
  if (!parkReason(parseFrontmatter(before).data[PARKED])) {
    return fail(`"${changeId}" is not parked — nothing was written`);
  }
  const after = removeFrontmatterKey(before, PARKED);
  if (after === null || after === before) {
    return fail(`cannot unpark "${changeId}": change.md was not changed — nothing was written`);
  }
  // A duplicated key makes the remover drop the first while the reader still sees the last, so
  // the result is proved the way park proves its own — reporting success is not the same as
  // having succeeded.
  if (parkReason(parseFrontmatter(after).data[PARKED])) {
    return fail(`cannot unpark "${changeId}": it would still read as parked — remove the extra ${PARKED} line by hand`);
  }
  return commit(file, sdlcRoot, after, changeId, 'unpark', { message: `unparked: ${changeId}` });
}

// Resolving an open change's `change.md` for a write, refusing anything that is not really
// where it claims to be. One implementation serves every caller that writes into a change.
//
// `node:*` only: copied into user projects as `sdlc/.hooks/lib/`.

import fs from 'node:fs';
import path from 'node:path';
import { isRealPathInside } from './safe-path.mjs';
import { escapeEntry } from './relations.mjs';
import { isSafeChangeId } from './journal.mjs';

// The folder is checked before the file: a symlinked folder is the shape that carried the
// first attempt's write outside the project entirely.
export function resolveChangeFile(sdlcRoot, changeId, verb = 'park') {
  if (typeof changeId !== 'string' || changeId.length === 0) {
    return { error: `name the change to ${verb}` };
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

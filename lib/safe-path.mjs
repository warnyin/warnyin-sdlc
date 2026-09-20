// Containment primitives for writes into a project we do not own.
//
// A change folder, `.state/` or any path under them can be a symlink: git carries symlinks
// (mode 120000), so a checkout can point one at anywhere on the machine. Every write this
// package makes therefore asks the same two questions — is this entry really where it claims
// to be, and is there anything at this path at all — and both answers must come from ONE
// implementation. `change-relations` had to unify five copies of a far simpler rule that had
// already drifted apart; this is that lesson applied before the second copy exists.
//
// `node:*` only: this file is copied into user projects as `sdlc/.hooks/lib/`.

import fs from 'node:fs';
import path from 'node:path';

// True only when `target`'s real location is the one it claims relative to `root`. A planted
// link anywhere along the path makes the two disagree. Missing paths are false too; callers
// only ask about entries they have already found. `root` is realpath-resolved first, so a
// project reached through a symlinked root is not mistaken for an escape.
export function isRealPathInside(root, target) {
  try {
    const expected = path.join(fs.realpathSync.native(root), path.relative(root, target));
    return fs.realpathSync.native(target) === expected;
  } catch {
    return false;
  }
}

// Whether ANY directory entry sits at `p`, dangling links included. `existsSync` follows the
// link and reports a dangling one as absent — and a write would then create the link's target,
// wherever it points.
export function hasEntry(p) {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

// Every EXISTING segment from `root` down to `target` must really be where it claims. Checking
// only an ancestor is what let a planted `.state/journal` carry a write out of the project: the
// ancestor was untouched, so the guard passed and the link one level down was followed.
export function pathIsContained(root, target) {
  const rel = path.relative(root, target);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  let cur = root;
  for (const segment of rel.split(path.sep)) {
    cur = path.join(cur, segment);
    if (hasEntry(cur) && !isRealPathInside(root, cur)) return false;
  }
  return true;
}

// The house standard for writing into a project we do not own, in one place so no caller can
// implement a weaker version of it. `O_NOFOLLOW` closes the window the check alone cannot: a
// symlink swapped in after the check is refused BY THE KERNEL at open time rather than
// followed. Where the platform has no such flag, the check immediately before the write is the
// same guarantee `lib/active.mjs` has always offered.
export function writeFileContained(root, file, data) {
  if (!pathIsContained(root, file)) return false;
  const noFollow = fs.constants.O_NOFOLLOW ?? 0;
  if (!noFollow) {
    fs.writeFileSync(file, data);
    return true;
  }
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_TRUNC | fs.constants.O_CREAT | noFollow);
    fs.writeFileSync(fd, data);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  return true;
}

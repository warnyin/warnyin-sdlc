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
const CASE_FOLDING = process.platform === 'win32' || process.platform === 'darwin';

export function isRealPathInside(root, target, { caseFolding = CASE_FOLDING } = {}) {
  try {
    const realRoot = fs.realpathSync.native(root);
    const expected = path.join(realRoot, path.relative(root, target));
    const real = fs.realpathSync.native(target);
    if (real === expected) return true;
    // On a case-folding file system (Windows, macOS) realpath returns the on-disk spelling, so a
    // user's `agents.md` asked for as `AGENTS.md` differs only in case: the same entry, not a link.
    // Only the part below the root folds, and only when no segment is a link: a case-sensitive
    // directory can hold `.hooks -> .HOOKS`, and a sibling `Proj` is not the project `proj`.
    if (!caseFolding || !real.startsWith(realRoot)) return false;
    if (real.slice(realRoot.length).toLowerCase() !== expected.slice(realRoot.length).toLowerCase()) return false;
    return noLinkBelow(root, target);
  } catch {
    return false;
  }
}

function noLinkBelow(root, target) {
  let cur = root;
  for (const segment of path.relative(root, target).split(path.sep)) {
    cur = path.join(cur, segment);
    if (fs.lstatSync(cur).isSymbolicLink()) return false;
  }
  return true;
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
//
// The content goes to a fresh temporary file beside the target and is renamed into place, so a
// write that dies part way leaves the previous content whole: half a hook or half a change.md is
// worse than an old one. rename replaces a link at the final component instead of following it.
// Windows refuses a rename onto a file another process holds open; only then, and only while the
// path is still contained, does the write fall back to the in-place write it always did.
const RENAME_HELD = new Set(['EPERM', 'EACCES', 'EBUSY']);

function writeInPlace(file, data) {
  const noFollow = fs.constants.O_NOFOLLOW ?? 0;
  if (!noFollow) {
    fs.writeFileSync(file, data);
    return;
  }
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_TRUNC | fs.constants.O_CREAT | noFollow);
    fs.writeFileSync(fd, data);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// An existing regular file's permission bits (a hook may be executable); a new file gets none.
function existingMode(file) {
  try {
    const st = fs.lstatSync(file);
    return st.isFile() ? st.mode & 0o7777 : null;
  } catch {
    return null;
  }
}

export function writeFileContained(root, file, data) {
  if (!pathIsContained(root, file)) return false;
  const tmp = path.join(path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.tmp`);
  const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0);
  const mode = existingMode(file);
  let fd;
  // Removed afterwards only once this call has created it: `O_EXCL` refusing an existing entry
  // means the name is someone else's, and cleaning up would delete their file.
  let created = false;
  try {
    fd = fs.openSync(tmp, flags);
    created = true;
    fs.writeFileSync(fd, data);
    if (mode !== null) fs.fchmodSync(fd, mode);
    fs.closeSync(fd);
    fd = undefined;
    try {
      fs.renameSync(tmp, file);
    } catch (err) {
      if (!RENAME_HELD.has(err.code) || !pathIsContained(root, file)) throw err;
      writeInPlace(file, data);
    }
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* the original failure is the one to report */ }
    }
    if (created) fs.rmSync(tmp, { force: true });
  }
  return true;
}

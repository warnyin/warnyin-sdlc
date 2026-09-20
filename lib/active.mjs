// Active change — which change a session (and the project as a whole) is working on.
//
// Two pointers exist so two sessions never overwrite each other's focus: a per-session
// file under `.state/sessions/<id>.json`, and a project-wide fallback at `.state/active.json`
// for tools (and past sessions) that never set one. Resolution tries session, then
// project, then the most-recently-edited open change — never an error: a pointer that
// is missing, stale, or malformed just falls through to the next source.
//
// Shared by the CLI and the installed hooks, so `node:*` only.

import fs from 'node:fs';
import path from 'node:path';
import { isSafeChangeId } from './journal.mjs';
import { listOpenChangeIds } from './relations.mjs';

// A session id reaches us from `CLAUDE_CODE_SESSION_ID` (shell) or stdin `session_id`
// (hooks) — both outside our control. It becomes a filename, so it is held to the same
// single-safe-segment rule as a change id rather than a separate one: two id kinds, one
// hazard (path traversal / device names / ADS colons), one rule to keep in sync.
export function isSafeSessionId(id) {
  return isSafeChangeId(id);
}

// stdin is the documented, per-invocation channel; the env var is inherited from a
// parent process and may be stale or belong to someone else. No safety check here —
// this is a raw pick, the caller validates before turning it into a path.
export function pickSessionId(stdinSessionId, envSessionId) {
  if (typeof stdinSessionId === 'string' && stdinSessionId.length > 0) return stdinSessionId;
  if (typeof envSessionId === 'string' && envSessionId.length > 0) return envSessionId;
  return null;
}

// `null` for an unsafe id, so callers fall back to the project pointer instead of
// writing or reading somewhere surprising.
export function sessionPointerPath(sdlcRoot, sessionId) {
  if (!isSafeSessionId(sessionId)) return null;
  return path.join(sdlcRoot, '.state', 'sessions', `${sessionId}.json`);
}

export function projectPointerPath(sdlcRoot) {
  return path.join(sdlcRoot, '.state', 'active.json');
}

// One rule for "this id names an open change", used both when a pointer is read and before
// one is written: a single safe segment, not the archive folder in any case (`ARCHIVE` opens
// it on Windows and macOS), and a folder that exists.
export function isOpenChange(sdlcRoot, change) {
  if (typeof change !== 'string' || change.toLowerCase() === 'archive' || !isSafeChangeId(change)) return false;
  try {
    return fs.statSync(path.join(sdlcRoot, 'changes', change)).isDirectory();
  } catch {
    return false;
  }
}

// A pointer path is trusted only when its real location is the one it claims. `.state/` is
// gitignored but not unwritable — a repo can ship a link there — and a planted link at
// `.state`, `.state/sessions` or the pointer file itself would otherwise carry a read or a
// write out of the project. Missing paths fail too; callers only ask about existing ones.
function isRealPathInside(sdlcRoot, target) {
  try {
    const expected = path.join(fs.realpathSync.native(sdlcRoot), path.relative(sdlcRoot, target));
    return fs.realpathSync.native(target) === expected;
  } catch {
    return false;
  }
}

// Reads a pointer file and returns the change id it names, or null if the file is
// missing, malformed, names something unsafe/archived, the change folder is gone, or the
// file is not really where it claims to be. A stale, corrupt or redirected pointer must
// never throw — it is just evidence the caller ignores.
function readPointerChange(sdlcRoot, filePath) {
  if (!filePath || !isRealPathInside(sdlcRoot, filePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isOpenChange(sdlcRoot, data?.change) ? data.change : null;
  } catch {
    return null;
  }
}

// The last-resort source: no pointer answers, so fall back to whichever open change was
// touched most recently. Never reported as this session's or the project's own choice.
function mostRecentOpenChange(sdlcRoot) {
  const changesDir = path.join(sdlcRoot, 'changes');
  let best = null;
  for (const id of listOpenChangeIds(sdlcRoot)) {
    const p = path.join(changesDir, id, 'change.md');
    let mtime;
    try {
      mtime = fs.statSync(p).mtimeMs;
    } catch {
      continue;
    }
    if (!best || mtime > best.mtime) best = { change: id, mtime };
  }
  return best?.change ?? null;
}

// Session pointer, then project pointer, then the most-recently-edited open change.
// Fails open at every step: a thrown error anywhere resolves to null rather than
// surfacing to a hook, which must never block a session over a state-file glitch.
export function resolveActive(sdlcRoot, { sessionId } = {}) {
  try {
    if (isSafeSessionId(sessionId)) {
      const change = readPointerChange(sdlcRoot, sessionPointerPath(sdlcRoot, sessionId));
      if (change) return { change, source: 'session' };
    }
    const projectChange = readPointerChange(sdlcRoot, projectPointerPath(sdlcRoot));
    if (projectChange) return { change: projectChange, source: 'project' };
    const recent = mostRecentOpenChange(sdlcRoot);
    if (recent) return { change: recent, source: 'recent' };
    return null;
  } catch {
    return null;
  }
}

// Creates `dir` one segment at a time below `sdlcRoot`, checking each segment before the
// next is made: a recursive mkdir would first create `sessions/` inside whatever a planted
// `.state` link points at, and only then could the check notice.
function ensureRealDir(sdlcRoot, dir) {
  let cur = sdlcRoot;
  for (const seg of path.relative(sdlcRoot, dir).split(path.sep)) {
    cur = path.join(cur, seg);
    if (!hasEntry(cur)) fs.mkdirSync(cur);
    if (!isRealPathInside(sdlcRoot, cur)) return false;
  }
  return true;
}

// Whether ANY directory entry sits at `p`, dangling links included. `existsSync` follows the
// link and reports a dangling one as absent — and `writeFileSync` would then create the
// link's target, wherever it points.
function hasEntry(p) {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

// Writes one pointer, refusing when its directory — or any entry already at the path,
// dangling link included — is really somewhere else. `writeFileSync` follows links, so the
// check has to come first.
function writePointer(sdlcRoot, filePath, change) {
  try {
    if (!ensureRealDir(sdlcRoot, path.dirname(filePath))) return false;
    if (hasEntry(filePath) && !isRealPathInside(sdlcRoot, filePath)) return false;
    fs.writeFileSync(filePath, JSON.stringify({ change }));
    return true;
  } catch {
    return false;
  }
}

// Writes the project-wide fallback, and the session pointer only when the id is safe, so
// an unsafe id can never cause a file to be created anywhere. A redirected `.state` or
// `.state/sessions` makes the matching write a no-op rather than a write out of the project.
export function writeActive(sdlcRoot, change, { sessionId } = {}) {
  const project = writePointer(sdlcRoot, projectPointerPath(sdlcRoot), change);
  const sessionPath = sessionPointerPath(sdlcRoot, sessionId);
  const session = sessionPath ? writePointer(sdlcRoot, sessionPath, change) : false;
  return { project, session };
}

// Releases every pointer naming `changeId`. Called at ship, after the folder has moved, so the
// id no longer resolves and is matched by name instead. Only real files inside `.state/` are
// read or removed — a planted link is left alone, never followed. Never throws: the ship has
// already happened by the time this runs.
export function clearPointersFor(sdlcRoot, changeId) {
  const candidates = [projectPointerPath(sdlcRoot)];
  const sessionsDir = path.join(sdlcRoot, '.state', 'sessions');
  if (isRealPathInside(sdlcRoot, sessionsDir)) {
    try {
      for (const f of fs.readdirSync(sessionsDir)) {
        if (f.endsWith('.json')) candidates.push(path.join(sessionsDir, f));
      }
    } catch { /* nothing to release */ }
  }
  let released = 0;
  for (const p of candidates) {
    try {
      if (!isRealPathInside(sdlcRoot, p)) continue;
      if (JSON.parse(fs.readFileSync(p, 'utf8'))?.change !== changeId) continue;
      fs.rmSync(p);
      released += 1;
    } catch { /* missing, malformed or vanished — leave it */ }
  }
  return released;
}

// Shared plumbing for installed hooks. This file lives at
// <project>/sdlc/.hooks/_shared.mjs with lib/ as a sibling directory.
// Every hook must be fail-open: on any unexpected condition, exit 0 silently
// so the harness is never blocked by our tooling.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { liveJournalPath, globalJournalPath, appendEvent } from './lib/journal.mjs';
import { resolveActive } from './lib/active.mjs';
import { pathIsContained } from './lib/safe-path.mjs';

export function resolveRoots(importMetaUrl) {
  const hooksDir = path.dirname(fileURLToPath(importMetaUrl));
  const sdlcRoot = path.dirname(hooksDir);
  const projectRoot = path.dirname(sdlcRoot);
  return { hooksDir, sdlcRoot, projectRoot };
}

// Reads the hook payload from stdin. Must NEVER hang: when a playbook or a
// user script invokes a hook utility with stdin open-but-idle (no piped JSON),
// resolve null after a short grace period instead of blocking forever.
export function readStdinJson({ timeoutMs = 1000 } = {}) {
  return new Promise((resolve) => {
    let data = '';
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      // Release stdin so an open-idle stream cannot keep the event loop alive.
      process.stdin.pause();
      if (typeof process.stdin.unref === 'function') process.stdin.unref();
      try { resolve(data.trim() ? JSON.parse(data) : null); } catch { resolve(null); }
    };
    const timer = setTimeout(finish, timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', finish);
    process.stdin.on('error', finish);
  });
}

// Resolve symlinks on the deepest EXISTING ancestor, then re-attach the tail.
// Needed because import.meta.url is symlink-resolved while tool file_paths may
// arrive through a symlink (/tmp → /private/tmp on macOS).
export function realResolve(p) {
  let cur = path.resolve(p);
  const tail = [];
  while (!fs.existsSync(cur)) {
    const parent = path.dirname(cur);
    if (parent === cur) break;
    tail.unshift(path.basename(cur));
    cur = parent;
  }
  try { cur = fs.realpathSync.native(cur); } catch { /* keep as-is */ }
  return tail.length ? path.join(cur, ...tail) : cur;
}

export function toPosixRel(projectRoot, absPath) {
  const rel = path.relative(realResolve(projectRoot), realResolve(absPath));
  if (rel.startsWith('..')) return null;
  return rel.split(path.sep).join('/');
}

// Lexical (no-symlink-resolution) relative path: what the path CLAIMS to be.
// Tried against both the raw and the realpathed project root so /tmp-style
// root symlinks don't break matching. Guards must compare this against
// toPosixRel — a divergence means a symlink sits inside the project.
export function lexicalPosixRel(projectRoot, absPath) {
  const abs = path.resolve(absPath);
  const realRoot = realResolve(projectRoot);
  for (const base of [path.resolve(projectRoot), realRoot]) {
    const rel = path.relative(base, abs);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
      return rel.split(path.sep).join('/');
    }
  }
  // Root-level symlinks (/tmp → /private/tmp): find the SHALLOWEST ancestor of
  // abs whose realpath IS the project root; the remaining tail is the lexical
  // claim. In-project symlinks are deliberately not resolved here.
  const segs = abs.split(path.sep);
  for (let i = 1; i < segs.length; i++) {
    const ancestor = segs.slice(0, i).join(path.sep) || path.sep;
    let real;
    try { real = fs.realpathSync.native(ancestor); } catch { continue; }
    if (real === realRoot) {
      const tail = segs.slice(i).join('/');
      return tail || null;
    }
  }
  return null;
}

// Gate state written by `journal.mjs open-<phase>` — {phase, change?, expires}.
export function readPhase(sdlcRoot) {
  try {
    const raw = fs.readFileSync(path.join(sdlcRoot, '.state', 'phase.json'), 'utf8');
    const phase = JSON.parse(raw);
    if (phase.expires && Date.parse(phase.expires) < Date.now()) return null;
    return phase;
  } catch {
    return null;
  }
}

export function writePhase(sdlcRoot, phase, ttlMinutes = 30) {
  const stateDir = path.join(sdlcRoot, '.state');
  fs.mkdirSync(stateDir, { recursive: true });
  const payload = { ...phase, expires: new Date(Date.now() + ttlMinutes * 60_000).toISOString() };
  fs.writeFileSync(path.join(stateDir, 'phase.json'), JSON.stringify(payload));
  return payload;
}

export function clearPhase(sdlcRoot) {
  fs.rmSync(path.join(sdlcRoot, '.state', 'phase.json'), { force: true });
}

// Active change: session pointer, then project pointer, then the most recently
// modified changes/*/change.md — resolution lives in lib/active.mjs so the CLI's
// `status` answers the same question the hooks do. Callers still get just the id
// (the `recent` fallback still attributes hook events, it just isn't reported as
// confirmed by `status`).
export function activeChange(sdlcRoot, sessionId = null) {
  return resolveActive(sdlcRoot, { sessionId })?.change ?? null;
}

// Journal: per-change ndjson when a change is active, else a global one — both under
// .state/, which is gitignored, so a session never dirties a version-controlled file
// just by running. Hook-written only — agents never hand-edit.
//
// Attribution does not depend on the change folder existing: a stale active pointer
// still records the event under that id rather than silently reattributing it.
export function appendJournal(sdlcRoot, change, event) {
  try {
    // Guarded at the TARGET, not at `.state`: an ancestor check passes while `.state/journal`
    // is itself a link, and the append then follows it out of the project. An event is not
    // worth writing outside the project someone handed us; dropping it is.
    const target = (change && liveJournalPath(sdlcRoot, change)) || globalJournalPath(sdlcRoot);
    if (!target || !pathIsContained(sdlcRoot, target)) return;
    appendEvent(target, { ts: new Date().toISOString(), ...event });
  } catch { /* fail open */ }
}

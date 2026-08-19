// Shared plumbing for installed hooks. This file lives at
// <project>/sdlc/.hooks/_shared.mjs with lib/ as a sibling directory.
// Every hook must be fail-open: on any unexpected condition, exit 0 silently
// so the harness is never blocked by our tooling.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export function resolveRoots(importMetaUrl) {
  const hooksDir = path.dirname(fileURLToPath(importMetaUrl));
  const sdlcRoot = path.dirname(hooksDir);
  const projectRoot = path.dirname(sdlcRoot);
  return { hooksDir, sdlcRoot, projectRoot };
}

export async function readStdinJson() {
  try {
    let data = '';
    for await (const chunk of process.stdin) data += chunk;
    return data.trim() ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function toPosixRel(projectRoot, absPath) {
  const rel = path.relative(projectRoot, absPath);
  if (rel.startsWith('..')) return null;
  return rel.split(path.sep).join('/');
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

// Active change: explicit .state/active.json first, else the most recently
// modified changes/*/change.md.
export function activeChange(sdlcRoot) {
  try {
    const explicit = JSON.parse(fs.readFileSync(path.join(sdlcRoot, '.state', 'active.json'), 'utf8'));
    if (explicit?.change && fs.existsSync(path.join(sdlcRoot, 'changes', explicit.change))) {
      return explicit.change;
    }
  } catch { /* fall through */ }
  const changesDir = path.join(sdlcRoot, 'changes');
  if (!fs.existsSync(changesDir)) return null;
  let best = null;
  for (const d of fs.readdirSync(changesDir, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name === 'archive') continue;
    const p = path.join(changesDir, d.name, 'change.md');
    if (!fs.existsSync(p)) continue;
    const mtime = fs.statSync(p).mtimeMs;
    if (!best || mtime > best.mtime) best = { change: d.name, mtime };
  }
  return best?.change ?? null;
}

// Journal: per-change ndjson when a change is active, else a global one under
// .state/ so no signal is lost. Hook-written only — agents never hand-edit.
export function appendJournal(sdlcRoot, change, event) {
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n';
    if (change) {
      const dir = path.join(sdlcRoot, 'changes', change);
      if (fs.existsSync(dir)) {
        fs.appendFileSync(path.join(dir, 'journal.ndjson'), line);
        return;
      }
    }
    const stateDir = path.join(sdlcRoot, '.state');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.appendFileSync(path.join(stateDir, 'journal.ndjson'), line);
  } catch { /* fail open */ }
}

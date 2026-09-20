// SessionStart side of the update notice: reads the cached check, and when it is due records
// the attempt and hands the network request to a detached `check-update.mjs`. Never waits on
// the network and never throws — any failure means no notice.

import fs from 'node:fs';
import path from 'node:path';
import { isRealPathInside } from './lib/safe-path.mjs';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { parseConfig } from './lib/config.mjs';
import { parseVersion } from './lib/version.mjs';
import { isCheckDisabled, isCheckDue, noticeLine } from './lib/update-notice.mjs';

export const cachePath = (sdlcRoot) => path.join(sdlcRoot, '.state', 'update-check.json');

export function readJsonFile(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

// `.state/` is gitignored, not unwritable: a repo can ship a link there. Write only into a
// `.state/` that already exists and really is `<sdlcRoot>/.state` (same rule as the change
// pointers in lib/active.mjs); never create it, so a deleted project is not resurrected.
function isRealStateDir(sdlcRoot) {
  try {
    const stateDir = path.join(sdlcRoot, '.state');
    return fs.lstatSync(stateDir).isDirectory()
      && isRealPathInside(sdlcRoot, stateDir);
  } catch {
    return false;
  }
}

// Temp file + rename: a symlink at the destination is replaced rather than written through,
// and a concurrent reader sees the old file or the new one, never half of either.
export function writeCache(sdlcRoot, value) {
  const p = cachePath(sdlcRoot);
  if (!isRealStateDir(sdlcRoot)) return false;
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(value), { flag: 'wx' });
    fs.renameSync(tmp, p);
    return true;
  } catch {
    fs.rmSync(tmp, { force: true });
    return false;
  }
}

function readConfig(sdlcRoot) {
  try { return parseConfig(fs.readFileSync(path.join(sdlcRoot, 'config.yaml'), 'utf8')); } catch { return {}; }
}

// The checker talks to a third-party host; it gets only what a request needs, not the
// session's tokens. SYSTEMROOT keeps Windows sockets working; the CA var keeps corporate TLS.
const CHECKER_ENV = ['PATH', 'SYSTEMROOT', 'NODE_EXTRA_CA_CERTS', 'WARNYIN_SDLC_REGISTRY_URL'];
const checkerEnv = (env) => Object.fromEntries(CHECKER_ENV.filter((k) => env[k] !== undefined).map((k) => [k, env[k]]));

function startCheck(hooksDir) {
  const child = spawn(process.execPath, [path.join(hooksDir, 'check-update.mjs')], {
    detached: true, stdio: 'ignore', windowsHide: true, env: checkerEnv(process.env),
  });
  child.on('error', () => {});
  child.unref();
}

export function updateNotice({ sdlcRoot, hooksDir, now = Date.now() }) {
  try {
    if (isCheckDisabled(process.env, readConfig(sdlcRoot))) return null;
    const installed = readJsonFile(path.join(hooksDir, 'version.json'))?.version;
    if (!parseVersion(installed)) return null;
    const cache = readJsonFile(cachePath(sdlcRoot));
    const latest = parseVersion(cache?.latest) ? cache.latest : undefined;
    // No recorded attempt, no request: a cache that cannot be written would otherwise mean a
    // request on every session.
    if (isCheckDue(cache, now) && writeCache(sdlcRoot, { checkedAt: new Date(now).toISOString(), latest })) {
      startCheck(hooksDir);
    }
    return noticeLine(installed, latest);
  } catch {
    return null;
  }
}

// Pure decisions for the update notice: whether to check, whether a check is due, and the
// line to show. No fs, no network — the SessionStart hook and the detached checker own I/O.

import { parseVersion, compareVersions } from './version.mjs';

export const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
export const PACKAGE_NAME = '@warnyin/sdlc';
export const CHECK_INTERVAL_MS = 24 * 3600_000;
export const FETCH_TIMEOUT_MS = 3000;
export const MAX_BODY_BYTES = 64 * 1024;

const OFF_VALUES = new Set(['false', 'no', 'off', '0']);
const set = (v) => typeof v === 'string' && v !== '';

const unquote = (v) => String(v ?? '').trim().replace(/^(['"])(.*)\1$/, '$2').toLowerCase();

// `CI=false` / `CI=0` are how some runners say "not CI"; any other non-empty CI means CI.
export function isCheckDisabled(env = {}, config = {}) {
  if (OFF_VALUES.has(unquote(config.updateCheck))) return true;
  if (set(env.NO_UPDATE_NOTIFIER)) return true;
  return set(env.CI) && !OFF_VALUES.has(env.CI.toLowerCase());
}

// Missing, unparsable or future timestamps are stale: a clock that jumped back must not
// silence the check until real time catches up.
export function isCheckDue(cache, now) {
  const at = Date.parse(cache?.checkedAt);
  if (Number.isNaN(at) || at > now) return true;
  return now - at >= CHECK_INTERVAL_MS;
}

export function latestUrl(base) {
  return `${String(base).replace(/\/+$/, '')}/${PACKAGE_NAME.replace('/', '%2F')}/latest`;
}

export function noticeLine(installed, latest) {
  if (!parseVersion(installed) || !parseVersion(latest)) return null;
  if (!(compareVersions(latest, installed) > 0)) return null;
  // One line, and it opens a decision rather than closing one: the agent offers the choice on
  // its first reply and the person picks. The doctrine for that choice lives in the playbook,
  // not here — this line only has to get the agent there.
  // `@latest`: a bare `npx <pkg>` may resolve a local or cached copy and update to nothing.
  return `[sdlc] ${PACKAGE_NAME} ${latest} is available (this project has ${installed}). On your first `
    + `reply, offer the choice in \`sdlc/.playbook/update.md\` — apply now (\`npx ${PACKAGE_NAME}@latest update\`), `
    + 'see what changes, or not now — and update only if the user picks it.';
}

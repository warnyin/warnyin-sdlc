// Journal residency — where a change's telemetry lives, and how the two possible
// streams are read back as one.
//
// Telemetry is appended by hooks on their own schedule, so it must never live in a
// version-controlled file: a session would dirty the tree by merely running, and two
// people on one change would conflict on the appended tail. While a change is open it
// goes to `sdlc/.state/journal/<id>.ndjson` — `.state/` is gitignored in every
// installed project — and `archive` seals it into the shipped change folder, one
// write, at ship. Projects installed before this carry a legacy in-tree journal; it is
// still read, and consumed at ship.
//
// Shared by the CLI, the report builder and the installed hooks, so `node:*` only.

import fs from 'node:fs';
import path from 'node:path';

// Windows resolves these to devices no matter what extension follows, so a write to
// `COM1.ndjson` goes to a serial port rather than a file.
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

// A change id reaches the path builder from `sdlc/.state/active.json` and from CLI
// argv — both user-writable. An id that is not a single safe path segment is refused
// outright rather than normalized: normalizing invites a `..` to be resolved into a
// write outside `.state/`, and there is no legitimate id that needs it.
//
// The Windows-specific rejections are not hypothetical for a CLI that installs itself
// into other people's checkouts: `:` makes NTFS treat the rest as an alternate data
// stream (`foo:bar.ndjson` writes a hidden stream on `foo`, invisible to a directory
// listing), and a trailing dot or space is stripped silently, so `add-2fa.` would
// alias onto the real `add-2fa` change and fold one change's telemetry into another's.
export function isSafeChangeId(id) {
  return typeof id === 'string'
    && id.length > 0
    && id.length <= 100
    && id !== '.'
    && id !== '..'
    && !id.includes('\0')
    && !/[/\\:]/.test(id)
    && !/[. ]$/.test(id)
    && !WINDOWS_RESERVED.test(id);
}

// The stream a session appends to while the change is open. `null` for an unsafe id,
// so callers fall back to the global journal instead of writing somewhere surprising.
export function liveJournalPath(sdlcRoot, changeId) {
  if (!isSafeChangeId(changeId)) return null;
  return path.join(sdlcRoot, '.state', 'journal', `${changeId}.ndjson`);
}

// Events with no change to attribute them to.
export function globalJournalPath(sdlcRoot) {
  return path.join(sdlcRoot, '.state', 'journal.ndjson');
}

// Where projects installed before this change already have telemetry. Read-only as far
// as new events are concerned — nothing appends here any more.
export function legacyJournalPath(sdlcRoot, changeId) {
  if (!isSafeChangeId(changeId)) return null;
  return path.join(sdlcRoot, 'changes', changeId, 'journal.ndjson');
}

// The sealed journal inside a shipped change folder.
export function sealedJournalPath(changeDir) {
  return path.join(changeDir, 'journal.ndjson');
}

// One malformed line must not cost the rest of the stream: telemetry is best-effort
// evidence, and a truncated tail from a killed process is a normal way to find it.
export function parseJournal(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const event = JSON.parse(trimmed);
      if (event && typeof event === 'object') out.push(event);
    } catch { /* skip the line, keep the stream */ }
  }
  return out;
}

export function readJournalFile(p) {
  if (!p || !fs.existsSync(p)) return [];
  try {
    return parseJournal(fs.readFileSync(p, 'utf8'));
  } catch {
    return [];
  }
}

// Merge two streams by recorded time. The sort is stable and the tie-break is explicit
// — equal timestamps keep stream order (`older` first), then file order — so the sealed
// journal is byte-identical whatever order the reads happened in.
export function mergeByTime(older, newer) {
  const decorated = [];
  [older, newer].forEach((events, stream) => {
    events.forEach((event, position) => decorated.push({ event, stream, position }));
  });
  decorated.sort((a, b) => {
    const at = typeof a.event.ts === 'string' ? a.event.ts : '';
    const bt = typeof b.event.ts === 'string' ? b.event.ts : '';
    if (at !== bt) return at < bt ? -1 : 1;
    if (a.stream !== b.stream) return a.stream - b.stream;
    return a.position - b.position;
  });
  return decorated.map((d) => d.event);
}

// Everything recorded for an open change, legacy first so it wins a timestamp tie —
// it is by definition the older stream.
export function readChangeJournal(sdlcRoot, changeId) {
  return mergeByTime(
    readJournalFile(legacyJournalPath(sdlcRoot, changeId)),
    readJournalFile(liveJournalPath(sdlcRoot, changeId)),
  );
}

// Always `\n`: a legacy journal checked out on Windows can arrive with CRLF, and the
// sealed file is committed — mixing endings there would churn every diff after it.
export function serializeJournal(events) {
  if (!events.length) return '';
  return events.map((e) => JSON.stringify(e)).join('\n') + '\n';
}

export function appendEvent(filePath, event) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(event) + '\n');
}

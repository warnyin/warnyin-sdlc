// Minimal YAML-frontmatter reader (zero-dep). Supports the subset this
// framework writes: strings, numbers, booleans, inline arrays, and
// simple `- item` lists. Anything fancier is a validation error upstream.

const FENCE = '---';

export function parseFrontmatter(text) {
  if (typeof text !== 'string') return { data: {}, body: '' };
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== FENCE) return { data: {}, body: text };

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === FENCE) { end = i; break; }
  }
  if (end === -1) return { data: {}, body: text };

  const data = {};
  let currentListKey = null;
  for (let i = 1; i < end; i++) {
    const raw = lines[i];
    if (!raw.trim() || raw.trim().startsWith('#')) continue;

    const listItem = raw.match(/^\s+-\s+(.*)$/);
    if (listItem && currentListKey) {
      data[currentListKey].push(coerce(listItem[1].trim()));
      continue;
    }

    const kv = raw.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rawValue] = kv;
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const value = rawValue.trim();
    if (value === '') {
      data[key] = [];
      currentListKey = key;
    } else {
      data[key] = coerce(value);
      currentListKey = null;
    }
  }

  return { data, body: lines.slice(end + 1).join('\n') };
}

function coerce(value) {
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((v) => coerce(v.trim()));
  }
  const unquoted = value.replace(/^["']|["']$/g, '');
  if (unquoted !== value) return unquoted;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

const FENCE_RE = /^---\s*$/;

// Locates the frontmatter block. `null` when the text has no usable one: the caller must
// refuse rather than guess, because a body line that merely looks like a key is not one.
function fenceBounds(lines) {
  if (!FENCE_RE.test(lines[0] ?? '')) return null;
  for (let i = 1; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i])) return { start: 1, end: i };
  }
  return null;
}

// A key written with no value parses as an empty LIST and swallows the `- item` lines under
// it. Replacing only the key line would leave those orphaned, so they go with it.
function spanOf(lines, index, end) {
  let last = index;
  if (/^[A-Za-z0-9_-]+:\s*$/.test(lines[index])) {
    while (last + 1 < end && /^\s+-\s+/.test(lines[last + 1])) last += 1;
  }
  return last;
}

function findKey(lines, key, bounds) {
  const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`);
  for (let i = bounds.start; i < bounds.end; i++) {
    if (re.test(lines[i])) return i;
  }
  return -1;
}

// The file's own line ending survives: a CRLF checkout must not silently become LF because
// someone parked a change.
function eolOf(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

// Writes `key: value` inside the fences, replacing any line already there. Returns the new
// text, or `null` when there is no usable frontmatter block. The value is written verbatim —
// this reader unquotes without ever unescaping, so no escaping scheme it cannot undo is
// invented here; the caller proves the round trip by reading the result back.
export function setFrontmatterKey(text, key, value) {
  const eol = eolOf(text);
  const lines = String(text).split(/\r?\n/);
  const bounds = fenceBounds(lines);
  if (!bounds) return null;
  const at = findKey(lines, key, bounds);
  const line = `${key}: ${value}`;
  if (at === -1) lines.splice(bounds.end, 0, line);
  else lines.splice(at, spanOf(lines, at, bounds.end) - at + 1, line);
  return lines.join(eol);
}

// Removes the key and, when it was written as an empty list, the items under it. Returns the
// new text, or `null` when there is no usable frontmatter block or the key is not there.
export function removeFrontmatterKey(text, key) {
  const eol = eolOf(text);
  const lines = String(text).split(/\r?\n/);
  const bounds = fenceBounds(lines);
  if (!bounds) return null;
  const at = findKey(lines, key, bounds);
  if (at === -1) return null;
  lines.splice(at, spanOf(lines, at, bounds.end) - at + 1);
  return lines.join(eol);
}

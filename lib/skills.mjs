// Skill/agent inventory — what expertise is already installed for this project and user.
// Used by: CLI (`warnyin-sdlc skills`), which the opening playbook reads to resolve lenses.
//
// Skill files are third-party content, so the inventory is deliberately shallow: it reads a
// bounded prefix of each file, keeps only frontmatter `name` + `description`, and never
// emits body text. Project entries whose real location leaves the project are skipped (a
// repo can ship a link); the user's own home may link wherever the user put their skills.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { containedIn } from './manifest.mjs';
import { SKILL_NAME_RE } from './lenses.mjs';

export { SKILL_NAME_RE };
export const INVENTORY_CEILING = 200;
// Per-directory bound on how many candidates are opened at all: a checked-out repo can plant
// thousands of folders, and the ceiling alone would still pay to read every one of them.
export const SCAN_LIMIT_PER_DIR = 1000;
export const DESCRIPTION_MAX = 160;
export const READ_PREFIX_BYTES = 8 * 1024;

const KINDS = Object.freeze(['skill', 'agent']);
// Built from code points so the source file itself carries no invisible characters: C0, DEL,
// C1, zero-width and bidi marks/overrides, line/paragraph separators, BOM — anything that
// can move a terminal cursor or visually reorder the line a human or model reads.
const cp = (n) => String.fromCharCode(n);
const CONTROL_CHARS = new RegExp(
  `[${cp(0)}-${cp(0x1f)}${cp(0x7f)}-${cp(0x9f)}${cp(0x200b)}-${cp(0x200f)}${cp(0x2028)}-${cp(0x202e)}${cp(0x2066)}-${cp(0x2069)}${cp(0xfeff)}]+`,
  'g');
const LEADING_BOM = new RegExp(`^${String.fromCharCode(0xfeff)}`);

// Reads at most READ_PREFIX_BYTES; a frontmatter that does not close inside that prefix is
// treated as absent rather than read further. The open is non-blocking where the platform
// has it, and the descriptor itself must be a regular file, so a FIFO or device swapped in
// after the earlier checks can neither hang nor feed the read.
function readPrefix(file) {
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK ?? 0));
    if (!fs.fstatSync(fd).isFile()) return null;
    const buf = Buffer.alloc(READ_PREFIX_BYTES);
    const n = fs.readSync(fd, buf, 0, READ_PREFIX_BYTES, 0);
    return buf.subarray(0, n).toString('utf8').replace(LEADING_BOM, '');
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// One line, no control characters (terminal escapes included), cut with a visible marker.
export function cleanDescription(raw) {
  const flat = String(raw).replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
  if (flat.length <= DESCRIPTION_MAX) return { description: flat, truncated: false };
  return { description: `${flat.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…`, truncated: true };
}

function readEntry(file) {
  const text = readPrefix(file);
  if (text === null) return null;
  const { data } = parseFrontmatter(text);
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!SKILL_NAME_RE.test(name)) return null;
  if (typeof data.description !== 'string' || data.description.trim() === '') return null;
  return { name, ...cleanDescription(data.description) };
}

function isInside(rootReal, target) {
  try {
    return containedIn(rootReal, fs.realpathSync.native(target));
  } catch {
    return false;
  }
}

// The first SCAN_LIMIT_PER_DIR names (sorted), and how many were left unopened.
function listDir(dir) {
  let names;
  try {
    names = fs.readdirSync(dir).sort();
  } catch {
    return { names: [], unscanned: 0 };
  }
  return { names: names.slice(0, SCAN_LIMIT_PER_DIR), unscanned: Math.max(0, names.length - SCAN_LIMIT_PER_DIR) };
}

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

// Candidate files for one `.claude` root, each paired with every path that must stay contained.
function candidates(claudeDir, kind) {
  if (kind === 'skill') {
    const skillsDir = path.join(claudeDir, 'skills');
    const { names, unscanned } = listDir(skillsDir);
    const items = names.map((d) => {
      const folder = path.join(skillsDir, d);
      const file = path.join(folder, 'SKILL.md');
      return { file, checks: [folder, file] };
    });
    return { items, unscanned };
  }
  const agentsDir = path.join(claudeDir, 'agents');
  const { names, unscanned } = listDir(agentsDir);
  const items = names
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ file: path.join(agentsDir, f), checks: [path.join(agentsDir, f)] }));
  return { items, unscanned };
}

function scanRoot(claudeDir, source, containRoot) {
  const entries = [];
  let unscanned = 0;
  for (const kind of KINDS) {
    const found = candidates(claudeDir, kind);
    unscanned += found.unscanned;
    for (const { file, checks } of found.items) {
      if (containRoot && !checks.every((c) => isInside(containRoot, c))) continue;
      if (!isFile(file)) continue;
      const entry = readEntry(file);
      if (entry) entries.push({ source, kind, ...entry });
    }
  }
  entries.sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || a.name.localeCompare(b.name));
  return { entries, unscanned };
}

export function scanInventory(projectRoot, { home = os.homedir() } = {}) {
  let projectReal = null;
  try { projectReal = fs.realpathSync.native(projectRoot); } catch { /* unreadable root → no project entries */ }
  const none = { entries: [], unscanned: 0 };
  const project = projectReal ? scanRoot(path.join(projectRoot, '.claude'), 'project', projectReal) : none;
  const user = home ? scanRoot(path.join(home, '.claude'), 'user', null) : none;
  const all = [...project.entries, ...user.entries];
  // `omitted` = valid entries past the ceiling + candidates never opened (scan limit).
  return {
    entries: all.slice(0, INVENTORY_CEILING),
    omitted: Math.max(0, all.length - INVENTORY_CEILING) + project.unscanned + user.unscanned,
  };
}

export function renderInventory({ entries, omitted }) {
  const lines = entries.map((e) => `${e.source}  ${e.kind}  ${e.name}  ${e.description}`);
  if (omitted > 0) lines.push(`… ${omitted} more not listed`);
  return lines.join('\n');
}

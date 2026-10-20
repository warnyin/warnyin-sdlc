// Artifacts a change lists in its `## Artifacts` section: the name check, the basis a stamp
// records, reading and stamping the section, and the warnings validate shows for it.
//
// `node:*` only: copied into user projects as `sdlc/.hooks/lib/`. Nothing here ever opens an
// artifact — warnings come from `lstat` alone, so a symlink is reported and never followed.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { linesOutsideFences, SECTION_HEADING_RE, sectionEndIndex } from './fences.mjs';
import { WINDOWS_RESERVED } from './journal.mjs';
import { escapeEntry } from './relations.mjs';

// One lowercase kebab segment and one of four extensions, so a name cannot spell a separator,
// a dot-dot, a drive letter or a case variant; reserved device names are refused separately.
const ARTIFACT_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:html|md|png|pdf)$/;

export function artifactNameError(name) {
  if (ARTIFACT_NAME_RE.test(name)) {
    return WINDOWS_RESERVED.test(name) ? `"${name}" is a reserved name on Windows — choose another` : null;
  }
  return `"${escapeEntry(name)}" is not an artifact name — one lowercase kebab segment ending .html, .md, .png or .pdf`;
}

// Unfenced `## ` headings of a body that `isStart` accepts, as { index, end }: [index, end) is
// the whole section, bounded by the same rule validate uses (`sectionEndIndex`).
function sections(lines, isStart) {
  const found = [];
  lines.forEach((l, index) => {
    if (l.fenced || !SECTION_HEADING_RE.test(l.line) || !isStart(l.line.trim())) return;
    found.push({ index, end: sectionEndIndex(lines, index) });
  });
  return found;
}

const isBasisHeading = (h) => h === '## Design' || h.startsWith('## Delta:');

// Whether the text has any unfenced Design or Delta section for a basis to be drawn from.
export function hasBasisSections(text) {
  return sections(linesOutsideFences(text), isBasisHeading).length > 0;
}

// What an artifact was drawn from: the Design and every Delta section, nothing else. Tasks,
// Assumptions, the `## Artifacts` list, frontmatter and line endings do not move it.
export function artifactBasis(text) {
  const lines = linesOutsideFences(text);
  const picked = sections(lines, isBasisHeading);
  const parts = picked.map(({ index, end }) => lines.slice(index, end).map((l) => l.line).join('\n').trimEnd());
  return crypto.createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 12);
}

const artifactSections = (lines) => sections(lines, (h) => h === '## Artifacts');
const ENTRY_RE = /^ {0,3}- /;
const LINK_RE = /\[[^\]]*\]\(([^)\s]+)\)/;
const BASIS_RE = /basis:\s*([0-9a-f]{12})\b/;
const STAMPED_BASIS_RE = /basis:\s*[0-9a-f]{12}\b/i;
const MAX_ENTRY = 2000;

function parseEntry(line) {
  if (line.length > MAX_ENTRY) return { raw: line.slice(0, 200).trim(), path: null, basis: null, tooLong: true };
  const rest = line.replace(ENTRY_RE, '').trim();
  const path = rest.match(LINK_RE)?.[1] ?? rest.split(/\s+/)[0] ?? '';
  return { raw: line.trim(), path: path || null, basis: rest.match(BASIS_RE)?.[1] ?? null };
}

// Entry line indexes (unfenced `- ` lines) inside one section.
function entryIndexes(lines, { index, end }) {
  const out = [];
  for (let i = index + 1; i < end; i++) if (!lines[i].fenced && ENTRY_RE.test(lines[i].line)) out.push(i);
  return out;
}

export function readArtifacts(text) {
  const lines = linesOutsideFences(text);
  return artifactSections(lines).flatMap((s) => entryIndexes(lines, s).map((i) => parseEntry(lines[i].line)));
}

// Adds or replaces the one stamped line for `name`. Bytes before the touched line are unchanged.
export function stampArtifacts(text, name, basis) {
  const lines = linesOutsideFences(text);
  const found = artifactSections(lines);
  if (found.length > 1) return { error: '## Artifacts appears more than once — keep one section and re-run' };
  const eol = /^[^\n]*\r\n/.test(text) ? '\r\n' : '\n';
  const target = `artifact/${name}`;
  const stamped = `- ${target} · basis: ${basis}`;
  const body = text.endsWith('\n') || text === '' ? text : text + eol;
  if (found.length === 0) return { text: `${body}${eol}## Artifacts${eol}${stamped}${eol}` };

  const raw = body.split('\n');
  const cr = eol === '\r\n' ? '\r' : '';
  const section = found[0];
  const same = entryIndexes(lines, section).filter((i) => parseEntry(lines[i].line).path === target);
  if (same.length > 0) {
    if (same.length > 1) return { error: `${target} is listed more than once under ## Artifacts — keep one line and re-run` };
    // The user's line keeps its text; only a hex-shaped basis token is replaced (any case). A bare
    // `basis:` with no such value is the user's text, so a token is appended instead.
    const line = raw[same[0]].replace(/\r$/, '');
    const set = STAMPED_BASIS_RE.test(line) ? line.replace(STAMPED_BASIS_RE, `basis: ${basis}`) : `${line} · basis: ${basis}`;
    raw[same[0]] = set + cr;
    return { text: raw.join('\n') };
  }
  let last = section.index;
  for (let i = section.index + 1; i < Math.min(section.end, lines.length); i++) {
    if (lines[i].line.trim() !== '') last = i;
  }
  raw.splice(last + 1, 0, stamped + cr);
  return { text: raw.join('\n') };
}

// The lstat of `p`, or its error code — never follows a link, never throws.
function lstatOrCode(p) {
  try { return fs.lstatSync(p); } catch (err) { return err.code ?? 'error'; }
}

// What is at `artifact/<name>` of a change, from `lstat` alone: { state, code }. state is ok,
// no-folder, bad-folder (artifact/ is a link or a file), missing, unreadable (code says why),
// symlink, directory or other. The stamp command and validate both read it, each in its own words.
export function artifactFileState(changeDir, name) {
  const dir = lstatOrCode(path.join(changeDir, 'artifact'));
  if (dir === 'ENOENT') return { state: 'no-folder' };
  if (typeof dir === 'string' || !dir.isDirectory()) return { state: 'bad-folder' };
  const st = lstatOrCode(path.join(changeDir, 'artifact', name));
  if (st === 'ENOENT') return { state: 'missing' };
  if (typeof st === 'string') return { state: 'unreadable', code: st };
  if (st.isSymbolicLink()) return { state: 'symlink' };
  if (st.isDirectory()) return { state: 'directory' };
  return { state: st.isFile() ? 'ok' : 'other' };
}

// Warnings for the listed artifacts; never throws, never opens a file.
export function artifactWarnings(changeDir, text) {
  const warnings = [];
  try {
    const entries = readArtifacts(text);
    const current = entries.some((e) => e.basis) ? artifactBasis(text) : null;
    for (const e of entries) {
      if (e.tooLong) { warnings.push(`## Artifacts line is too long to read: ${escapeEntry(e.raw)}`); continue; }
      if (!e.path) { warnings.push(`## Artifacts line has no readable path: ${escapeEntry(e.raw)}`); continue; }
      const p = escapeEntry(e.path);
      const name = /^artifact\/([^/]+)$/.exec(e.path)?.[1];
      if (name === undefined || artifactNameError(name) !== null) {
        warnings.push(`${p} is not an artifact path — expected artifact/<name> inside the change`);
        continue;
      }
      // No artifact/ folder means the file is simply missing; a folder that is a link or a file
      // makes the entry uncheckable.
      const { state, code } = artifactFileState(changeDir, name);
      const problem = {
        'no-folder': 'is missing',
        missing: 'is missing',
        'bad-folder': 'cannot be checked — artifact/ is not a real directory',
        unreadable: `cannot be checked (${escapeEntry(code ?? '')})`,
        symlink: 'is a symlink, not a regular file',
        directory: 'is a directory, not a regular file',
        other: 'is not a regular file',
      }[state];
      if (problem) { warnings.push(`${p} ${problem}`); continue; }
      if (e.basis && e.basis !== current) {
        warnings.push(`${p} is stale — the Design or Delta changed after it was stamped (re-run: warnyin-sdlc artifact ${escapeEntry(path.basename(changeDir))} ${name})`);
      }
    }
  } catch (err) {
    warnings.push(`## Artifacts could not be checked (${err.code ?? err.message})`);
  }
  return warnings;
}

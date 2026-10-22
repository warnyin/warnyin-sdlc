// Shared helper for rule pins: a payload rule is asserted as one EXACT sentence, whitespace
// collapsed, inside a non-empty anchor, bounded on both sides. Not a test file (no `.test.` in the
// name). Used by the *-rules and gate test files; see tests/gate-rules-second-pass.test.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PKG_ROOT } from './helpers.mjs';

export const oneLine = (s) => s.replace(/\s+/g, ' ').trim();

const payloadDir = path.join(PKG_ROOT, 'payload');
export const payload = (...rel) => fs.readFileSync(path.join(payloadDir, ...rel), 'utf8');

// Every anchor is asserted non-empty before any rule is looked for in it.
export function nonEmpty(s, what) {
  assert.ok(typeof s === 'string' && s.trim().length > 0, `anchor missing or empty: ${what}`);
  return s;
}

// Body of an agent or skill file: everything after its leading `---` frontmatter block.
export function body(text, what) {
  assert.match(text, /^---\r?\n[\s\S]*?\r?\n---\r?\n/, `${what} must open with frontmatter`);
  return nonEmpty(text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ''), `${what} body after frontmatter`);
}

// A `## Heading` section runs to the next `## ` line or the end of the file.
export function section(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`## ${heading}`));
  if (start === -1) return '';
  const rel = lines.slice(start + 1).findIndex((l) => l.startsWith('## '));
  return lines.slice(start, rel === -1 ? undefined : start + 1 + rel).join('\n');
}

// A numbered step runs from its "N. " line to the next top-level step line — wrapped lines included.
export function step(text, n) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`${n}. `));
  if (start === -1) return '';
  const rel = lines.slice(start + 1).findIndex((l) => /^\d+[a-z]?\.\s/.test(l));
  return lines.slice(start, rel === -1 ? undefined : start + 1 + rel).join('\n');
}

// A list marker counts as a start only where it opens its line; it is marked before whitespace is
// collapsed. A colon, semicolon or mid-line dash is not a start: "Never: <rule>", "Never; <rule>"
// and "Never - <rule>" would invert it.
const LIST_MARK = '\u0001';
const SENTENCE_BEFORE = new Set(['.', '!', '?', LIST_MARK]);
const collapse = (anchor) => oneLine(anchor.replace(/^[ \t]*[-*][ \t]+/gm, `${LIST_MARK} `));
const FULL_SENTENCE = /^[A-Z][\s\S]*[.!?]$/;

// One occurrence of `want` (already collapsed) at index i is bounded when the nearest non-space
// char before it is absent or one of SENTENCE_BEFORE, and after it comes the anchor end or whitespace.
function isBounded(text, want, i) {
  const end = i + want.length;
  let j = i - 1;
  while (j >= 0 && /\s/.test(text[j])) j -= 1;
  if (j >= 0 && !SENTENCE_BEFORE.has(text[j])) return false;
  return end === text.length || /\s/.test(text[end]);
}

// The sentence must appear verbatim (whitespace collapsed) in the anchor, bounded on both sides.
// Passes when at least one occurrence is bounded.
export function assertSentence(anchor, sentence, where) {
  const text = collapse(nonEmpty(anchor, where));
  const want = oneLine(sentence);
  assert.ok(FULL_SENTENCE.test(want),
    `a pin must be a full sentence (capital first letter, final . ! or ?), got: "${sentence}"`);
  let found = false;
  for (let i = text.indexOf(want); i !== -1; i = text.indexOf(want, i + 1)) {
    found = true;
    if (isBounded(text, want, i)) return;
  }
  assert.fail(found
    ? `${where} carries "${sentence}" only unbounded (negated, qualified or spliced); it must state it as one exact sentence`
    : `${where} must state verbatim: "${sentence}"`);
}

// A pinned rule: a full sentence is matched bounded (assertSentence); a clause or phrase that is
// not a full sentence stays a plain verbatim substring.
export function assertRule(anchor, rule, where) {
  const want = oneLine(rule);
  if (FULL_SENTENCE.test(want)) return assertSentence(anchor, rule, where);
  assert.ok(oneLine(nonEmpty(anchor, where)).includes(want), `${where} must state verbatim: "${rule}"`);
}

// The literal must not appear in the anchor (old or contradicting wording).
export function assertAbsent(anchor, literal, where, why) {
  const text = oneLine(nonEmpty(anchor, where));
  assert.ok(!text.includes(oneLine(literal)), `${where} must not contain "${literal}" — ${why}`);
}

// Every .md under payload/, recursively, as payload-relative posix paths (e.g. `playbook/verify.md`).
function payloadMarkdown(dir = payloadDir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) payloadMarkdown(p, out);
    else if (ent.name.endsWith('.md')) out.push(p);
  }
  return out;
}

// Sorted payload-relative posix paths of every payload .md whose collapsed text includes the sentence.
export function payloadFilesWith(sentence) {
  const want = oneLine(sentence);
  return payloadMarkdown()
    .filter((f) => oneLine(fs.readFileSync(f, 'utf8')).includes(want))
    .map((f) => path.relative(payloadDir, f).split(path.sep).join('/'))
    .sort();
}

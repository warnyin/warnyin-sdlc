// Contract rows for anti-loop-rules: sdlc/changes/anti-loop-rules/contract/tests.md.
// Each rule is pinned as an EXACT sentence (RULES below), compared after whitespace is collapsed,
// inside the anchor that must carry it. No regex reads the meaning. Rows 3 and 8 pin where a
// sentence appears across every payload .md: the list must equal the list the contract names.
// Row 10 runs the guard test files that must stay green, as child processes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PKG_ROOT } from './helpers.mjs';
import { assertRule as pinRule } from './rule-pins.mjs';

const read = (...rel) => fs.readFileSync(path.join(...rel), 'utf8');
const payload = (...rel) => read(PKG_ROOT, 'payload', ...rel);
const oneLine = (s) => s.replace(/\s+/g, ' ');

// The rules, verbatim. One place to read what the payload promises; one place to change it.
const B_LEAD_IN = 'In a repeated panel, when you are briefed with the previous blockers and the fix diff, ';
const B_FRAGMENT = 'a blocker is raised only for a previous blocker not closed, a defect the fix diff causes, or a security, data-loss or contract defect wherever it is; anything else is an improvement';
const RULES = Object.freeze({
  A: 'A row that pins a rule written in prose asserts it as one exact sentence, whitespace collapsed, inside a non-empty anchor, and pins known contradicting wording absent as literal text; it never uses a regex over the rule\'s meaning.',
  B_FRAGMENT,
  B_AGENT: B_LEAD_IN + B_FRAGMENT + '.',
  C: 'A repeated panel never narrows what you check: a vulnerability in any code is a blocker.',
});

// A `## Heading` section runs to the next `## ` line or the end of the file.
function section(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`## ${heading}`));
  if (start === -1) return '';
  const rel = lines.slice(start + 1).findIndex((l) => l.startsWith('## '));
  return lines.slice(start, rel === -1 ? undefined : start + 1 + rel).join('\n');
}

// Every anchor is asserted non-empty before any rule is looked for in it.
function nonEmpty(s, what) {
  assert.ok(typeof s === 'string' && s.trim().length > 0, `anchor missing or empty: ${what}`);
  return s;
}

// Body of an agent file: everything after its leading `---` frontmatter block.
function body(text, what) {
  assert.match(text, /^---\r?\n[\s\S]*?\r?\n---\r?\n/, `${what} must open with frontmatter`);
  return nonEmpty(text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ''), `${what} body after frontmatter`);
}

// Each rule through the shared pin (tests/rule-pins.mjs): a full sentence bounded, a clause verbatim.
function assertRule(anchor, key, where) {
  pinRule(anchor, RULES[key], `${where} (RULES.${key})`);
}

// Runs an existing test file in a child `node --test` process; it must exit 0, unchanged.
function assertTestFilePasses(rel) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const res = spawnSync(process.execPath, ['--test', path.join(PKG_ROOT, rel)], {
    cwd: PKG_ROOT,
    encoding: 'utf8',
    env,
    timeout: 240000,
  });
  assert.ifError(res.error);
  assert.equal(res.status, 0, `${rel} must pass unchanged (exit ${res.status}):\n${`${res.stdout}${res.stderr}`.slice(-2000)}`);
}

// Every .md file under payload/, recursively.
function allPayloadMarkdown(dir = path.join(PKG_ROOT, 'payload'), out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) allPayloadMarkdown(p, out);
    else if (ent.name.endsWith('.md')) out.push(p);
  }
  return out;
}

// Payload-relative posix paths of every .md whose collapsed text includes the sentence, sorted.
function filesWith(sentence) {
  const want = oneLine(sentence);
  return allPayloadMarkdown()
    .filter((f) => oneLine(fs.readFileSync(f, 'utf8')).includes(want))
    .map((f) => path.relative(PKG_ROOT, f).split(path.sep).join('/'))
    .sort();
}

const contractor = () => body(payload('adapters', 'claude', 'agents', 'sdlc-contractor.md'), 'sdlc-contractor.md');
const reviewer = (name) => body(payload('adapters', 'claude', 'agents', name), name);
const contractTestsSection = () => nonEmpty(
  section(payload('adapters', 'claude', 'skills', 'contract-writing', 'SKILL.md'), 'contract/tests.md'),
  'contract-writing SKILL.md ## contract/tests.md',
);

test('row 1: sdlc-contractor body states rule A verbatim as one exact sentence', () => {
  assertRule(contractor(), 'A', 'sdlc-contractor.md body');
});

test('row 2: contract-writing SKILL ## contract/tests.md states rule A verbatim as one exact sentence', () => {
  assertRule(contractTestsSection(), 'A', 'contract-writing SKILL.md ## contract/tests.md');
});

test('row 3: rule A appears in exactly sdlc-contractor.md and contract-writing/SKILL.md', () => {
  const holders = filesWith(RULES.A);
  const expected = [
    'payload/adapters/claude/agents/sdlc-contractor.md',
    'payload/adapters/claude/skills/contract-writing/SKILL.md',
  ].sort();
  assert.deepEqual(holders, expected, `rule A must appear in exactly those two payload files, got ${JSON.stringify(holders)}`);
});

test('row 4: sdlc-architect body states the repeated-panel blocker scope (B agent) verbatim', () => {
  assertRule(reviewer('sdlc-architect.md'), 'B_AGENT', 'sdlc-architect.md body');
});

test('row 5: sdlc-security body states the repeated-panel blocker scope (B agent) verbatim', () => {
  assertRule(reviewer('sdlc-security.md'), 'B_AGENT', 'sdlc-security.md body');
});

test('row 6: sdlc-quality body states the repeated-panel blocker scope (B agent) verbatim', () => {
  assertRule(reviewer('sdlc-quality.md'), 'B_AGENT', 'sdlc-quality.md body');
});

test('row 7: sdlc-ops body states the repeated-panel blocker scope (B agent) verbatim', () => {
  assertRule(reviewer('sdlc-ops.md'), 'B_AGENT', 'sdlc-ops.md body');
});

test('row 8: the B fragment appears in exactly review.md, sdlc-architect, sdlc-security, sdlc-quality and sdlc-ops', () => {
  const holders = filesWith(RULES.B_FRAGMENT);
  const expected = [
    'payload/adapters/claude/agents/sdlc-architect.md',
    'payload/adapters/claude/agents/sdlc-ops.md',
    'payload/adapters/claude/agents/sdlc-quality.md',
    'payload/adapters/claude/agents/sdlc-security.md',
    'payload/playbook/review.md',
  ].sort();
  assert.deepEqual(holders, expected, `the B fragment must appear in exactly those five payload files, got ${JSON.stringify(holders)}`);
});

test('row 9: sdlc-security body states the never-narrows rule (C) verbatim', () => {
  assertRule(reviewer('sdlc-security.md'), 'C', 'sdlc-security.md body');
});

test('row 10: the guard test files named in the contract run unchanged and exit 0', () => {
  for (const rel of [
    'tests/contractor-assertion-rules.test.mjs',
    'tests/review-blocker-class.test.mjs',
    'tests/minimal-build.test.mjs',
    'tests/payload.test.mjs',
    'tests/playbook-budgets.test.mjs',
    'tests/gate-moving-target.test.mjs',
  ]) assertTestFilePasses(rel);
});

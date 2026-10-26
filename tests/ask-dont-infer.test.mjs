import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, runHook, writeChange, STANDARD_BODY } from './helpers.mjs';
import { oneLine, payload, nonEmpty, step, section, assertSentence } from './rule-pins.mjs';
import { ADAPTER_PATHS } from '../bin/detect.mjs';

// Contract: sdlc/changes/ask-dont-infer/contract/tests.md (rows 1-11).
const ARG = "A required command argument the human did not type is a question, never a guess from what the session was just doing; the only default is the `Active change:` pointer, and only for an sdlc command's change id.";
const CARVE = 'a missing command argument is asked, never assumed';
const HALT = `A project's edit-time hard stop (RBAC, auth, migrations…) is a constraint to carry, not a halt: grooming edits nothing, so record it in the Assumptions handed to \`/sdlc:new\` ("this change goes through <the project's workflow>") and let it fire when a stage that edits files outside \`sdlc/\` starts.`;
const HANDOFF = 'carrying the Why and the verified Assumptions, a project hard stop among them';

const ID = 'add-2fa';

function initProject(t) {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res.status, 0, res.stderr);
  return dir;
}

function inject(dir) {
  const res = runHook(dir, 'inject-context.mjs', { stdin: { hook_event_name: 'SessionStart' } });
  assert.equal(res.status, 0, res.stderr);
  return res.stdout.replace(/\r?\n$/, '').split(/\r?\n/);
}

const count = (lines) => lines.filter((l) => l.includes(ARG)).length;

test('row 1: with an active change, ARG is the first line, once, and the pointer follows', (t) => {
  const dir = initProject(t);
  writeChange(dir, ID, { body: STANDARD_BODY });
  const set = runHook(dir, 'journal.mjs', { args: ['set-active', ID] });
  assert.equal(set.status, 0, set.stderr);
  const lines = inject(dir);
  assertSentence(lines[0], ARG, 'SessionStart first line');
  assert.equal(count(lines), 1, 'ARG occurs once');
  assert.ok(lines.slice(1).some((l) => l.startsWith('Active change:')), `the pointer follows:\n${lines.join('\n')}`);
});

test('row 2: with no change folder at all, ARG is the first line, once, and no pointer', (t) => {
  const lines = inject(initProject(t));
  assertSentence(lines[0], ARG, 'SessionStart first line');
  assert.equal(count(lines), 1, 'ARG occurs once');
  assert.ok(!lines.some((l) => l.startsWith('Active change:')), 'no pointer without a change');
});

test('row 3: a constitution that overflows the budget never truncates ARG', (t) => {
  const dir = initProject(t);
  const big = '# Constitution\n' + Array.from({ length: 80 }, (_, i) => `- rule ${i}`).join('\n');
  fs.writeFileSync(path.join(dir, 'sdlc/context/constitution.md'), big);
  const lines = inject(dir);
  assert.equal(lines.length, 61, 'budget lines plus the warning');
  assertSentence(lines[0], ARG, 'SessionStart first line');
  assert.match(lines.at(-1), /truncated at/);
});

test('row 4: with no constitution and no change, the output is ARG alone', (t) => {
  const dir = initProject(t);
  fs.rmSync(path.join(dir, 'sdlc/context/constitution.md'));
  assert.deepEqual(inject(dir), [ARG]);
});

test('row 5: rules-card.md carries the ARG bullet', () => {
  const card = nonEmpty(payload('playbook', 'rules-card.md'), 'payload/playbook/rules-card.md');
  assert.ok(oneLine(card).includes(oneLine(`- ${ARG}`)), 'rules-card.md must carry "- " + ARG');
  assertSentence(card, ARG, 'payload/playbook/rules-card.md');
});

test('row 6: the rules-card ambiguity bullet carves out a missing command argument', () => {
  const card = payload('playbook', 'rules-card.md');
  const bullets = oneLine(card.replace(/\r?\n- /g, '\n\u0000')).split('\u0000');
  const ambiguity = nonEmpty(bullets.find((b) => b.startsWith('Ambiguity')), 'rules-card Ambiguity bullet');
  assert.ok(ambiguity.includes(CARVE), `the Ambiguity bullet must say "${CARVE}"; got: ${ambiguity}`);
});

test('row 7: new.md step 5 carves out a missing command argument', () => {
  const s5 = nonEmpty(step(payload('playbook', 'new.md'), 5), 'new.md step 5');
  assert.ok(oneLine(s5).includes(CARVE), `new.md step 5 must say "${CARVE}"`);
});

const NON_CLAUDE = ['agents-md', 'cursor', 'cline', 'copilot', 'gemini', 'kimi', 'windsurf'];

test('row 8: every non-Claude rules file carries ARG and the carve-out; all failures reported', (t) => {
  const dir = makeTempProject(t);
  const failures = [];
  for (const tool of NON_CLAUDE) {
    const res = runCli(dir, ['init', '--tool', tool]);
    if (res.status !== 0) { failures.push(`${tool}: init exited ${res.status}: ${res.stderr}`); continue; }
    const rel = ADAPTER_PATHS[tool];
    const file = path.join(dir, ...rel.split('/'));
    if (!fs.existsSync(file)) { failures.push(`${tool}: ${rel} was not installed`); continue; }
    const text = fs.readFileSync(file, 'utf8');
    try { assertSentence(text, ARG, rel); } catch (err) { failures.push(`${tool}: ${err.message}`); }
    if (!oneLine(text).includes(CARVE)) failures.push(`${tool}: ${rel} lacks the carve-out`);
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('row 9: context.md names the fixed line in its static list', () => {
  const statics = nonEmpty(section(payload('playbook', 'context.md'), 'Static'), 'context.md ## Static');
  assert.ok(oneLine(statics).includes('One fixed line from the hook itself, first: the missing-argument rule'));
});

test('row 10: groom.md states HALT before its first step', () => {
  const text = payload('playbook', 'groom.md');
  const lines = text.split(/\r?\n/);
  const first = lines.findIndex((l) => l.startsWith('1. '));
  assert.notEqual(first, -1, 'groom.md must have a step 1');
  assertSentence(nonEmpty(lines.slice(0, first).join('\n'), 'groom.md before step 1'), HALT, 'groom.md before step 1');
});

test('row 11: groom.md step 5 names a project hard stop among the Assumptions it carries', () => {
  const s5 = nonEmpty(step(payload('playbook', 'groom.md'), 5), 'groom.md step 5');
  assert.ok(oneLine(s5).includes(HANDOFF), `step 5 must say "${HANDOFF}"; got: ${oneLine(s5)}`);
});

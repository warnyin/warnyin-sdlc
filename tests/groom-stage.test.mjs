import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, PKG_ROOT } from './helpers.mjs';
import { countEffectiveLines } from '../lib/caps.mjs';
import { parseFrontmatter } from '../lib/frontmatter.mjs';

const pb = (rel) => fs.readFileSync(path.join(PKG_ROOT, 'payload/playbook', rel), 'utf8');
const oneLine = (s) => s.replace(/\s+/g, ' ');
const groom = () => oneLine(pb('groom.md'));

// row 1 — the questions are about the problem, and the proposed solution is not the scope
test('row 1: groom interrogates the problem, not the solution it was handed', () => {
  const g = groom();
  assert.match(g, /what breaks today|breaks today/i, 'asks what is wrong now');
  assert.match(g, /done looks like|what done means/i, 'asks what done looks like, observably');
  assert.match(g, /must not change|must NOT change/i, 'asks what is off limits');
  assert.match(g, /cheapest/i, 'asks for the cheapest acceptable outcome');
  assert.match(g, /solution[^]{0,160}(evidence|never the scope|not the scope)/i,
    "the human's proposed solution must be treated as evidence of the problem, not as scope");
});

// row 2 — what it learns must be run before it becomes an Assumption
test('row 2: findings bound for Assumptions are run first', () => {
  const g = groom();
  assert.match(g, /Assumptions/, 'it names where its findings land');
  assert.match(g, /(run|prove|verif)[^]{0,200}Assumptions|Assumptions[^]{0,200}(run|prove|verif)/i,
    'and requires them proven, not plausible');
});

// row 3 — options, cheapest first, and a kill is allowed
test('row 3: groom offers shapes cheapest-first and may conclude nothing should be built', () => {
  const g = groom();
  assert.match(g, /cheapest[^]{0,120}first|first[^]{0,120}cheapest/i, 'cheapest acceptable shape leads');
  assert.match(g, /recommend/i, 'one is marked recommended');
  assert.match(g, /(not worth building|do not build|nothing should be built)/i,
    'a kill has to be a legitimate ending, or the stage is a funnel');
});

// row 4 — it writes nothing
test('row 4: groom writes no artifact of its own', () => {
  const g = groom();
  assert.match(g, /writes no artifact|no artifact of its own/i);
  assert.match(g, /(Why|Assumptions)[^]{0,200}\/sdlc:new|\/sdlc:new[^]{0,200}(Why|Assumptions)/,
    'its result is what /sdlc:new opens with');
});

// row 5 — optional, and hands off
test('row 5: groom is optional and hands off to new', () => {
  const g = groom();
  assert.match(g, /skip/i, 'it says when NOT to run — a ceremonial grooming is garbage');
  assert.match(g, /\/sdlc:new/, 'it hands off');
});

// row 6 — the Claude stub matches every other stage stub
test('row 6: the groom command stub looks like every other stage stub', () => {
  const raw = fs.readFileSync(
    path.join(PKG_ROOT, 'payload/adapters/claude/commands/sdlc/groom.md'), 'utf8');
  const { data, body } = parseFrontmatter(raw);
  assert.ok(data.description && data.description.length > 0, 'stubs carry a description');
  assert.match(body, /sdlc\/\.playbook\/groom\.md/, 'and name their playbook');
  assert.ok(raw.split('\n').filter((l) => l.trim()).length <= 15, 'stubs stay thin');
});

// row 7 — the 0.16.0 single-source design proving itself on the first stage added since
test('row 7: kimi gets /skill:sdlc-groom with no kimi-specific work', (t) => {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'kimi']).status, 0);
  const skill = path.join(dir, '.kimi-code/skills/sdlc-groom/SKILL.md');
  assert.ok(fs.existsSync(skill), 'a stage added for Claude reaches Kimi by itself');
  const { data, body } = parseFrontmatter(fs.readFileSync(skill, 'utf8'));
  assert.equal(data.name, 'sdlc-groom');
  assert.match(body, /sdlc\/\.playbook\/groom\.md/);
});

// row 8 — it reaches a real claude project
test('row 8: a fresh claude install carries the stage and its command', (t) => {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'claude']).status, 0);
  assert.ok(fs.existsSync(path.join(dir, 'sdlc/.playbook/groom.md')));
  assert.ok(fs.existsSync(path.join(dir, '.claude/commands/sdlc/groom.md')));
});

// row 9 — discoverable: the table lists it, and next offers it
test('row 9: the playbook README lists grooming and next offers it', () => {
  assert.match(oneLine(pb('README.md')), /groom/i, 'the stage table lists it');
  assert.match(oneLine(pb('next.md')), /groom/i, 'next offers it when nothing is active');
});

// row 10 — always-loaded context did not grow
test('row 10: grooming costs no always-loaded budget', () => {
  assert.ok(countEffectiveLines(pb('rules-card.md')) <= 40, 'rules card within budget');
  const constitution = fs.readFileSync(
    path.join(PKG_ROOT, 'payload/templates/constitution.md'), 'utf8');
  assert.ok(countEffectiveLines(constitution) <= 30, 'constitution within cap');
  // Grooming precedes a change, so the lifecycle flow line must not have absorbed it.
  assert.doesNotMatch(oneLine(pb('rules-card.md')), /groom/i,
    'the always-loaded flow line describes a change\'s lifecycle, which grooming precedes');
});

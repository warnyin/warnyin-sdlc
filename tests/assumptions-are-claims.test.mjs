import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, PKG_ROOT } from './helpers.mjs';
import { countEffectiveLines } from '../lib/caps.mjs';

const pb = (rel) => fs.readFileSync(path.join(PKG_ROOT, 'payload', 'playbook', rel), 'utf8');
const tpl = (rel) => fs.readFileSync(path.join(PKG_ROOT, 'payload', 'templates', rel), 'utf8');
// Doctrine is prose: collapse it so a rule split across wrapped lines still matches.
const oneLine = (s) => s.replace(/\s+/g, ' ');

// row 1 — the rule exists where the assumption is written
test('row 1: new.md makes a work-removing assumption a claim to run, not a judgement', () => {
  const step5 = oneLine(pb('new.md'));
  assert.match(step5, /assumption[^]{0,240}(run|prove|verif)/i,
    'step 5 must require running/proving, not just explaining why it is safe');
  assert.match(step5, /UNVERIFIED/,
    'it must offer the explicit unverified marker as the alternative to proving it');
  // It must say WHICH assumptions it means, or the rule is unfollowable.
  assert.match(step5, /already covered|unchanged|harmless|pre-existing/i,
    'it must name the kind of claim it means');
});

// row 2 — the budget was raised deliberately, in both places that pin it
test('row 2: new.md is within its deliberately raised budget, and both pins moved together', () => {
  const lines = countEffectiveLines(pb('new.md'));
  assert.ok(lines <= 46, `new.md is ${lines} effective lines, raised budget is 46`);

  // The two tests that pin this file must assert the same raised number — a pin left at 43
  // would go red on the next edit for a reason nobody could explain.
  for (const f of ['question-options.test.mjs', 'clarification-rounds.test.mjs']) {
    const src = fs.readFileSync(path.join(PKG_ROOT, 'tests', f), 'utf8');
    const pins = [...src.matchAll(/new\.md is \$\{lines\} effective lines, budget is (\d+)/g)]
      .map((m) => Number(m[1]));
    assert.ok(pins.length > 0, `${f} should still pin new.md's budget`);
    for (const pin of pins) assert.equal(pin, 46, `${f} still pins the old budget`);
  }
});

// row 3 — the rule exists where the assumption is SPENT to drop a test
test('row 3: contract.md makes an out-of-scope line cite its proof or admit it is unverified', () => {
  const text = oneLine(pb('contract.md'));
  assert.match(text, /out of scope/i);
  // Tight window + the marker itself: a loose 320-char window matched the word "prove" from an
  // unrelated sentence about lens bars, so this row passed before the rule existed.
  assert.match(text, /UNVERIFIED/,
    'contract.md must name the marker an unproven out-of-scope claim has to carry');
  assert.match(text, /out of scope[^]{0,160}(cite|proved|prove|verif|UNVERIFIED)/i,
    'the demand for evidence must sit with the out-of-scope instruction, not elsewhere in the file');
});

// row 4 — the rule exists where the panel chooses what to attack
test('row 4: review.md points the panel at unverified scope-narrowing claims first', () => {
  const text = oneLine(pb('review.md'));
  assert.match(text, /UNVERIFIED/, 'review.md must name the marker it is meant to hunt');
  assert.match(text, /UNVERIFIED[^]{0,200}first|first[^]{0,200}UNVERIFIED/i,
    'the panel must be told to start there, not merely to notice it');
});

// row 5 — tools with no hooks get the same rule, within the card's budget
test('row 5: the rules card carries the rule and stays within 40 lines', () => {
  const card = pb('rules-card.md');
  assert.match(oneLine(card), /assum[^]{0,200}(run|prove|verif|UNVERIFIED)/i,
    'the card is the only enforcement a non-Claude tool gets — the rule has to be on it');
  const lines = countEffectiveLines(card);
  assert.ok(lines <= 40, `rules-card.md is ${lines} effective lines, budget is 40`);
});

// row 6 — the templates prompt for it at the moment of writing
test('row 6: every change template tells the author to verify or mark the assumption', () => {
  for (const name of ['change-vibe.md', 'change-standard.md', 'change-deep.md']) {
    const section = oneLine(tpl(name));
    assert.match(section, /## Assumptions[^]{0,400}(run|prove|verif|UNVERIFIED)/i,
      `${name}'s Assumptions placeholder must ask for proof, not just a reason`);
  }
});

// row 7 — it reaches a real project, not just payload/
test('row 7: a fresh claude install carries the rule into the project', (t) => {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'claude']).status, 0);

  const installed = oneLine(fs.readFileSync(path.join(dir, 'sdlc/.playbook/new.md'), 'utf8'));
  assert.match(installed, /UNVERIFIED/, 'the installed playbook carries the rule');

  const template = oneLine(fs.readFileSync(
    path.join(dir, 'sdlc/.playbook/templates/change-standard.md'), 'utf8'));
  assert.match(template, /## Assumptions[^]{0,400}(run|prove|verif|UNVERIFIED)/i,
    'the installed template prompts for it too');
});

// row 8 — a tool whose ONLY enforcement is the card
test('row 8: a fresh cursor install embeds the rule in its rules file', (t) => {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'cursor']).status, 0);
  const rendered = oneLine(fs.readFileSync(path.join(dir, '.cursor/rules/sdlc.mdc'), 'utf8'));
  assert.match(rendered, /assum[^]{0,200}(run|prove|verif|UNVERIFIED)/i);
});

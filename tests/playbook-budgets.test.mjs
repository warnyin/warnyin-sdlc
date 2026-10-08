// Contract rows 1–2 of new-md-budget-constant: payload line budgets live in lib/caps.mjs only,
// and no test pins one by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PKG_ROOT } from './helpers.mjs';
import { CAPS, countEffectiveLines } from '../lib/caps.mjs';

const pb = (f) => fs.readFileSync(path.join(PKG_ROOT, 'payload', 'playbook', f), 'utf8');

test('row 1: CAPS states every playbook budget and each file is within it', () => {
  assert.ok(Object.isFrozen(CAPS.playbook), 'CAPS.playbook must be frozen');
  assert.deepEqual(Object.keys(CAPS.playbook).sort(), ['auto', 'autopilot', 'new', 'rulesCard']);
  for (const v of [...Object.values(CAPS.playbook), CAPS.commandStub]) assert.ok(Number.isInteger(v) && v > 0);
  const files = { new: 'new.md', rulesCard: 'rules-card.md', auto: 'auto.md', autopilot: 'autopilot.md' };
  for (const [key, file] of Object.entries(files)) {
    const lines = countEffectiveLines(pb(file));
    assert.ok(lines <= CAPS.playbook[key], `${file} is ${lines} effective lines, budget is CAPS.playbook.${key}`);
  }
});

test('row 2: no test compares a line count to a number literal', () => {
  const dir = path.join(PKG_ROOT, 'tests');
  // `lines <= N`, `countEffectiveLines(…) <= N`, `….filter(…).length <= N`, `const grillCap = N`.
  // A string's `.length` (a character cap) is a different budget and does not match.
  const PIN_RE = /(\blines(\.length)?|\)(\.length)?)\s*<=\s*\d+|\bconst \w*[Cc]ap = \d+/;
  const hits = [];
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.mjs'))) {
    fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (PIN_RE.test(line)) hits.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(hits, [], 'line budgets must be read from CAPS');
});

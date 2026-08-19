// Guards against doc/validator drift: the cap numbers quoted in template
// HTML comments must equal lib/caps.mjs. If you change a cap, change it in
// BOTH places (caps.mjs is canonical).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CAPS } from '../lib/caps.mjs';
import { PKG_ROOT } from './helpers.mjs';

const TEMPLATE_CAPS = {
  'constitution.md': CAPS.constitution,
  'harness.md': CAPS.harness,
  'steering.md': CAPS.steeringFile,
  'spec.md': CAPS.spec,
  'change-vibe.md': CAPS.change.vibe,
  'change-standard.md': CAPS.change.standard,
  'change-deep.md': CAPS.change.deep,
  'contract-tests.md': CAPS.contractTests,
  'contract-evals.md': CAPS.contractEvals,
};

test('every template quotes exactly the canonical cap from lib/caps.mjs', () => {
  const dir = path.join(PKG_ROOT, 'payload', 'templates');
  for (const [file, expected] of Object.entries(TEMPLATE_CAPS)) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    const m = text.match(/cap:(\d+)/);
    assert.ok(m, `${file}: missing cap:<n> annotation`);
    assert.equal(Number(m[1]), expected, `${file}: cap annotation ${m[1]} != caps.mjs ${expected}`);
  }
});

test('constitution template also quotes the always-budget correctly', () => {
  const text = fs.readFileSync(path.join(PKG_ROOT, 'payload', 'templates', 'constitution.md'), 'utf8');
  const m = text.match(/always-budget \((\d+) lines\)/);
  assert.ok(m, 'constitution template should mention the always-budget');
  assert.equal(Number(m[1]), CAPS.alwaysBudget);
});

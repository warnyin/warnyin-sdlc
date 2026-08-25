import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { costUsd } from '../lib/usage.mjs';
import { PKG_ROOT } from './helpers.mjs';

const usage = (m) => ({ models: { 'claude-sonnet-5': m }, totals: m });
const session = { input: 1000, output: 2000, cacheRead: 50000, cacheWrite: 20000 };

// row 1
test('cost: a configured cache-write rate is charged', () => {
  const prices = { 'claude-sonnet-5': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 } };
  // 1000*3 + 2000*15 + 50000*0.3 + 20000*3.75 = 3000+30000+15000+75000 = 123000 / 1e6
  assert.equal(costUsd(usage(session), prices), 0.123);
});

// row 2
test('cost: a missing cache-write rate contributes nothing but still costs the rest', () => {
  const prices = { 'claude-sonnet-5': { input: 3, output: 15, cacheRead: 0.3 } };
  // same session without the cache-write term: 48000 / 1e6
  assert.equal(costUsd(usage(session), prices), 0.048);
});

// row 5
test('cost: an unpriced model still reports null', () => {
  assert.equal(costUsd(usage(session), { 'some-other-model': { input: 1 } }), null);
  assert.equal(costUsd(usage(session), null), null);
});

// row 4
test('cost: the documented price contract names cache-write', () => {
  const src = fs.readFileSync(path.join(PKG_ROOT, 'lib/usage.mjs'), 'utf8');
  const before = src.split('export function costUsd')[0].split('\n');
  const start = before.findLastIndex((l) => l.startsWith('// prices:'));
  assert.ok(start > -1, 'the price-table contract comment must exist');
  const header = before.slice(start).join('\n');
  assert.match(header, /cacheWrite/, 'the price-table comment must list cacheWrite');
});

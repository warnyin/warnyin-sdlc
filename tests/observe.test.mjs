import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, writeChange, writeContractTests, STANDARD_BODY } from './helpers.mjs';
import { buildReport } from '../lib/observe.mjs';

function journalLine(dir, event) {
  fs.appendFileSync(path.join(dir, 'journal.ndjson'), JSON.stringify(event) + '\n');
}

function initProject(t) {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  return dir;
}

test('buildReport: aggregates sessions, verify rounds, first-pass, lead time', (t) => {
  const dir = initProject(t);
  const changeDir = writeChange(dir, 'add-2fa', { status: 'verified', body: STANDARD_BODY });
  writeContractTests(changeDir);
  journalLine(changeDir, { ts: '2026-08-10T00:00:00Z', event: 'gate', gate: 'contract' });
  journalLine(changeDir, {
    ts: '2026-08-10T01:00:00Z', event: 'session', totals: { input: 1000, output: 500, cacheRead: 0, cacheWrite: 0 }, costUsd: 0.01,
  });
  journalLine(changeDir, { ts: '2026-08-10T02:00:00Z', event: 'verify', result: 'fail', round: '1' });
  journalLine(changeDir, { ts: '2026-08-10T03:00:00Z', event: 'verify', result: 'pass', round: '2' });

  runCli(dir, ['archive', 'add-2fa']);
  const report = buildReport(path.join(dir, 'sdlc'));

  assert.equal(report.summary.shipped, 1);
  assert.equal(report.summary.firstPassRate, 0);
  const c = report.changes.find((x) => x.id.endsWith('add-2fa'));
  assert.equal(c.sessions, 1);
  assert.equal(c.tokens.input, 1000);
  assert.equal(c.costUsd, 0.01);
  assert.equal(c.verify.rounds, 2);
  assert.ok(c.leadTimeMs > 0, 'lead time from first event to ship');
  assert.equal(c.digest, false);
  assert.ok(report.flags.some((f) => f.includes('without digest.md')));
});

test('buildReport: residency counts constitution + always steering; flags over-budget', (t) => {
  const dir = initProject(t);
  const sdlcRoot = path.join(dir, 'sdlc');
  fs.writeFileSync(path.join(sdlcRoot, 'context/constitution.md'),
    '# C\n' + Array.from({ length: 40 }, (_, i) => `- r${i}`).join('\n'));
  fs.writeFileSync(path.join(sdlcRoot, 'context/steering/db.md'),
    '---\nname: db\ninclusion: always\n---\n# S\n' + Array.from({ length: 25 }, (_, i) => `- c${i}`).join('\n'));
  const report = buildReport(sdlcRoot);
  assert.equal(report.residency.alwaysLines, 41 + 26);
  assert.ok(report.flags.some((f) => f.startsWith('residency:')));
});

test('buildReport: steering pointer hits come from journals; dead steering flagged after 2 ships', (t) => {
  const dir = initProject(t);
  const sdlcRoot = path.join(dir, 'sdlc');
  fs.writeFileSync(path.join(sdlcRoot, 'context/steering/api.md'),
    '---\nname: api\ninclusion: paths\npathMatch: ["src/api/**"]\n---\n# S\n- x\n');
  for (const id of ['one', 'two']) {
    const cd = writeChange(dir, id, { status: 'verified', body: STANDARD_BODY.replace('## Delta: auth', `## Delta: cap-${id}`) });
    writeContractTests(cd);
    runCli(dir, ['archive', id]);
  }
  const report = buildReport(sdlcRoot);
  assert.equal(report.steering[0].pointerHits, 0);
  assert.ok(report.flags.some((f) => f.includes('api.md') && f.includes('demote or delete')));
});

test('observe CLI: renders text and --json', (t) => {
  const dir = initProject(t);
  let res = runCli(dir, ['observe']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /changes: 0 active · 0 shipped/);
  assert.match(res.stdout, /residency: \d+\/60/);
  res = runCli(dir, ['observe', '--json']);
  const json = JSON.parse(res.stdout);
  assert.deepEqual(json.summary, { active: 0, shipped: 0, firstPassRate: null });
});

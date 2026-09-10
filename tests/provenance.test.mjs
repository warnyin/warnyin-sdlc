import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, writeChange, STANDARD_BODY, PKG_ROOT } from './helpers.mjs';
import { buildReport, renderReport } from '../lib/observe.mjs';

const pb = (name) => fs.readFileSync(path.join(PKG_ROOT, 'payload/playbook', name), 'utf8');

// Telemetry for an open change lives out of tree; derive that stream from the change
// folder so these fixtures exercise the real residency, not the legacy read shim.
function journalLine(changeDir, event) {
  const live = path.resolve(changeDir, '..', '..', '.state', 'journal', `${path.basename(changeDir)}.ndjson`);
  fs.mkdirSync(path.dirname(live), { recursive: true });
  fs.appendFileSync(live, JSON.stringify(event) + '\n');
}

function projectWithChange(t, events) {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const changeDir = writeChange(dir, 'add-2fa', { status: 'verified', body: STANDARD_BODY });
  for (const e of events) journalLine(changeDir, e);
  return { dir, report: buildReport(path.join(dir, 'sdlc')) };
}

const change = (report) => report.changes.find((c) => c.id.endsWith('add-2fa'));

// row 1
test('provenance: verify.md records how the judgment was produced', () => {
  const t = pb('verify.md');
  assert.match(t, /mode=/);
  assert.match(t, /mode=(solo|panel)/);
  assert.match(t, /solo/);
  assert.match(t, /panel/);
});

// row 2
test('provenance: review.md records the same field', () => {
  const t = pb('review.md');
  assert.match(t, /mode=(solo|panel)/);
});

// row 3
test('provenance: an unavailable panel is recorded, never a stop condition', () => {
  for (const name of ['verify.md', 'review.md']) {
    const t = pb(name);
    assert.match(t, /(cannot run|unavailable|not available|forbidden|disallowed)/i, `${name}: names the case`);
    assert.match(t, /(record|note|still|proceed|continue)/i, `${name}: proceeds anyway`);
  }
});

// row 4
test('provenance: a solo verify makes the change self-judged', (t) => {
  const { report } = projectWithChange(t, [
    { ts: '2026-08-10T02:00:00Z', event: 'verify', result: 'pass', round: '1', mode: 'solo' },
  ]);
  assert.equal(change(report).selfJudged, true);
});

// row 5
test('provenance: an all-panel change is not self-judged', (t) => {
  const { report } = projectWithChange(t, [
    { ts: '2026-08-10T02:00:00Z', event: 'verify', result: 'pass', round: '1', mode: 'panel' },
    { ts: '2026-08-10T03:00:00Z', event: 'review', blockers: '0', mode: 'panel' },
  ]);
  assert.equal(change(report).selfJudged, false);
});

// row 6
test('provenance: a journal predating this change reads as unknown, not as panel', (t) => {
  const { report } = projectWithChange(t, [
    { ts: '2026-08-10T02:00:00Z', event: 'verify', result: 'pass', round: '1' },
  ]);
  assert.equal(change(report).selfJudged, null);
});

// row 7
test('provenance: the rendered report tells the human a change judged itself', (t) => {
  const { report } = projectWithChange(t, [
    { ts: '2026-08-10T02:00:00Z', event: 'verify', result: 'pass', round: '1', mode: 'solo' },
  ]);
  assert.match(renderReport(report), /self-judged/);
});

// row 8
test('provenance: the digest must name self-produced outcomes', () => {
  assert.match(pb('ship.md'), /self-(produced|judged)/i);
});

// row 9 — mixed provenance: the weakest link decides
test('provenance: one solo outcome among panel ones still counts as self-judged', (t) => {
  const { report } = projectWithChange(t, [
    { ts: '2026-08-10T02:00:00Z', event: 'verify', result: 'pass', round: '1', mode: 'solo' },
    { ts: '2026-08-10T03:00:00Z', event: 'review', blockers: '0', mode: 'panel' },
  ]);
  assert.equal(change(report).selfJudged, true);
});

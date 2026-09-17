// Contract rows for final-gate-confirm-skip: sdlc/changes/final-gate-confirm-skip/contract/tests.md.
// Doctrine rows read what verify.md, auto.md, ship.md and the rules card REQUIRE; whether a run
// really asks is runtime judgement. Report rows drive lib/observe.mjs through buildReport.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, writeChange, STANDARD_BODY, PKG_ROOT } from './helpers.mjs';
import { buildReport } from '../lib/observe.mjs';
import { countEffectiveLines } from '../lib/caps.mjs';

const pb = (n) => fs.readFileSync(path.join(PKG_ROOT, 'payload/playbook', n), 'utf8');
const oneLine = (s) => s.replace(/\s+/g, ' ');

// The final gate step, up to the failure section that follows it.
function finalGate() {
  const text = pb('verify.md');
  const start = text.search(/^\d+\.\s+\**Final gate/m);
  assert.ok(start > -1, 'verify.md has no final gate step');
  const rest = text.slice(start);
  const end = rest.search(/^On failure/m);
  return oneLine(end > -1 ? rest.slice(0, end) : rest);
}

test('row 1: a vibe change skips the full run without asking', () => {
  const gate = finalGate();
  assert.match(gate, /vibe[^.]{0,120}skip[^.]{0,80}without asking/i);
  assert.match(gate, /result=skipped by=<?tier/);
});

test('row 2: other tiers ask run or skip first, run recommended; a skip is the human\'s', () => {
  const gate = finalGate();
  assert.match(gate, /ask[^.]{0,80}run or skip/i);
  assert.match(gate, /run[^.]{0,20}recommended/i);
  assert.match(gate, /by=<?(tier\|)?human/);
});

test('row 3: a reused fast-gate full run asks nothing', () => {
  assert.match(finalGate(), /reused=yes[^.]{0,120}(no question|ask nothing|without asking)|(no question|ask nothing|without asking)[^.]{0,120}reuse/i);
});

test('row 4: a skipped final gate still sets verified', () => {
  assert.match(finalGate(), /skip[^]{0,200}status: verified|status: verified[^]{0,200}skip/i);
});

test('row 5: the escalation table has a final-gate run-or-skip row', () => {
  const row = pb('auto.md').split(/\r?\n/).find((l) => /^\|[^|]*final gate/i.test(l)) ?? '';
  assert.match(row, /run[^|]{0,20}·[^|]{0,20}skip|skip[^|]{0,20}·[^|]{0,20}run/i);
});

test('row 6: ship bounces a build after a final pass or skip, and the digest names a skip', () => {
  const text = oneLine(pb('ship.md'));
  assert.match(text, /`build` note[^.]{0,60}after[^.]{0,40}final-gate pass or skip[^.]{0,90}\/sdlc:verify/i);
  const digest = oneLine(pb('ship.md').split(/^4\. /m)[1] ?? '');
  assert.match(digest, /result=skipped[^.]{0,120}full suite never ran[^.]{0,40}before ship/i);
});

test('row 7: the rules card says the full run is confirmed and vibe skips it', () => {
  const card = pb('rules-card.md');
  const line = oneLine(card.split(/^- Verify = /m)[1]?.split(/^- /m)[0] ?? '');
  assert.match(line, /confirm/i);
  assert.match(line, /vibe[^.]{0,40}skip/i);
  const lines = countEffectiveLines(card);
  assert.ok(lines <= 40, `rules-card.md is ${lines} effective lines, budget is 40`);
});

function reportFor(t, events) {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const changeDir = writeChange(dir, 'skipped', { status: 'verified', body: STANDARD_BODY });
  const live = path.resolve(changeDir, '..', '..', '.state', 'journal', `${path.basename(changeDir)}.ndjson`);
  fs.mkdirSync(path.dirname(live), { recursive: true });
  for (const e of events) fs.appendFileSync(live, JSON.stringify(e) + '\n');
  return buildReport(path.join(dir, 'sdlc')).changes.find((c) => c.id.endsWith('skipped')).verify;
}

const v = (h, result, gate, extra = {}) => ({ ts: `2026-09-18T0${h}:00:00Z`, event: 'verify', result, gate, mode: 'panel', ...extra });

test('row 8: a skipped final gate adds no round and keeps first-pass', (t) => {
  const verify = reportFor(t, [v(1, 'pass', 'fast'), v(2, 'skipped', 'final', { by: 'human' })]);
  assert.deepEqual(verify, { rounds: 1, firstPass: true });
});

test('row 9: a skipped final gate after a fast failure leaves first-pass false', (t) => {
  const verify = reportFor(t, [v(1, 'fail', 'fast'), v(2, 'pass', 'fast'), v(3, 'skipped', 'final', { by: 'tier' })]);
  assert.deepEqual(verify, { rounds: 2, firstPass: false });
});

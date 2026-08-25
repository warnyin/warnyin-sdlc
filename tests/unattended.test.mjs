import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, writeChange, STANDARD_BODY, PKG_ROOT } from './helpers.mjs';
import { buildReport, renderReport } from '../lib/observe.mjs';

const STAGES = ['new', 'design', 'contract', 'build', 'verify', 'review', 'ship'];
const pb = (n) => fs.readFileSync(path.join(PKG_ROOT, 'payload/playbook', n), 'utf8');
const stub = (n) => fs.readFileSync(
  path.join(PKG_ROOT, 'payload/adapters/claude/commands/sdlc', `${n}.md`), 'utf8');

function journalLine(dir, event) {
  fs.appendFileSync(path.join(dir, 'journal.ndjson'), JSON.stringify(event) + '\n');
}

function projectWithChange(t, events) {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const changeDir = writeChange(dir, 'add-2fa', { status: 'verified', body: STANDARD_BODY });
  for (const e of events) journalLine(changeDir, e);
  return buildReport(path.join(dir, 'sdlc'));
}
const change = (report) => report.changes.find((c) => c.id.endsWith('add-2fa'));

// row 1
test('unattended: every pipeline stage command advertises --auto', () => {
  for (const s of STAGES) {
    const fm = stub(s).split('---')[1] ?? '';
    assert.match(fm, /argument-hint:.*--auto/, `${s}: argument-hint must offer --auto`);
  }
});

// row 2
test('unattended: every stage playbook names --auto and hands off to auto.md', () => {
  for (const s of STAGES) {
    const t = pb(`${s}.md`);
    assert.match(t, /--auto/, `${s}.md: names the flag`);
    assert.match(t, /auto\.md/, `${s}.md: hands off rather than duplicating the pipeline`);
  }
});

// row 3
test('unattended: the entry stage comes from status, and an earlier stage is skipped aloud', () => {
  const t = pb('auto.md');
  assert.match(t, /next\.md/);
  assert.match(t, /(skip|skipped|announce)/i);
  assert.match(t, /never re-run|not re-run|never re-open|never rewrites/i);
});

// row 4
test('unattended: gather -> confirm -> run, with nothing written before consent', () => {
  const t = pb('auto.md');
  const iGather = t.search(/gather/i);
  const iConfirm = t.search(/confirm/i);
  const iRun = t.search(/\brun\b/i);
  assert.ok(iGather > -1 && iConfirm > -1 && iRun > -1, 'all three named');
  assert.ok(iGather < iConfirm, 'gather precedes confirm');
  assert.match(t, /nothing is written|no file is written|writes nothing/i);
  assert.match(t, /change\.md/);
  assert.match(t, /journal/i);
});

// row 5
test('unattended: the confirmation carries scope, tier, ambiguities and pre-approvals', () => {
  const t = pb('auto.md');
  for (const re of [/scope/i, /tier/i, /ambiguit/i, /escalation/i, /pre-approv|pre-authoriz/i]) {
    assert.match(t, re, `confirmation must carry ${re}`);
  }
});

// row 6
test('unattended: declining leaves the repository unchanged', () => {
  const t = pb('auto.md');
  assert.match(t, /declin|refus|says no/i);
  assert.match(t, /(unchanged|byte-identical|nothing has been written|leaves nothing)/i);
});

// row 7
test('unattended: pre-authorization is scoped to the run', () => {
  const t = pb('auto.md');
  assert.match(t, /this run only|that run only|for one run|per-run/i);
  assert.match(t, /(not persisted|never persisted|not written to config|not remembered)/i);
  assert.match(t, /resum/i);
});

// row 8
test('unattended: an unconfirmed condition still stops the run', () => {
  const t = pb('auto.md');
  assert.match(t, /(outside|not covered|nobody pre-approved|was not confirmed)/i);
  assert.match(t, /stop/i);
});

// rows 9-12
test('unattended: observe counts pre-authorized escalations from escalation events', (t) => {
  const preauth = change(projectWithChange(t, [
    { ts: '2026-08-10T02:00:00Z', event: 'escalation', condition: 'deep-tier-ship', preauth: 'yes' },
  ]));
  assert.equal(preauth.preauthorized, 1);

  const asked = change(projectWithChange(t, [
    { ts: '2026-08-10T02:00:00Z', event: 'escalation', condition: 'verify-rounds', preauth: 'no' },
  ]));
  assert.equal(asked.preauthorized, 0);

  const noneReport = projectWithChange(t, []);
  assert.equal(change(noneReport).preauthorized, 0);
  assert.doesNotMatch(renderReport(noneReport), /unattended/i,
    'a change that never escalated says nothing about pre-authorization');

  // row 12: an escalation from a stage with no note of its own still counts
  const stageless = change(projectWithChange(t, [
    { ts: '2026-08-10T02:00:00Z', event: 'escalation', condition: 'ambiguity', preauth: 'yes' },
    { ts: '2026-08-10T03:00:00Z', event: 'escalation', condition: 'deep-tier-ship', preauth: 'yes' },
  ]));
  assert.equal(stageless.preauthorized, 2);
});

// row 13
test('unattended: the rendered report tells the human how many escalations passed unattended', (t) => {
  const report = projectWithChange(t, [
    { ts: '2026-08-10T02:00:00Z', event: 'escalation', condition: 'deep-tier-ship', preauth: 'yes' },
  ]);
  assert.match(renderReport(report), /unattended×1|unattended x1|1 unattended/i);
});

// row 14
test('unattended: the digest must list pre-authorized escalations', () => {
  assert.match(pb('ship.md'), /pre-authoriz|pre-approv/i);
});

// row 15 — regression guard: green from the start, by design
test('unattended: --auto is doctrine, never a CLI flag', (t) => {
  const cli = fs.readFileSync(path.join(PKG_ROOT, 'bin/cli.mjs'), 'utf8');
  assert.doesNotMatch(cli, /'--auto'/, 'the installer must not parse --auto');
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const res = runCli(dir, ['status', '--auto']);
  assert.equal(res.status, 0, 'an unknown flag must not break the CLI');
});

// row 16
test('unattended: each pre-approvable escalation is listed by name', () => {
  const t = pb('auto.md');
  for (const re of [/ambiguit/i, /verify.*(round|fail)/i, /review.*blocker/i,
    /deep.*ship|ship.*deep|hard-floor/i, /token budget/i]) {
    assert.match(t, re, `confirmation must itemise ${re}`);
  }
});

// row 17
test('unattended: the flag never skips the stage it was passed to', () => {
  const t = pb('auto.md');
  assert.match(t, /(does its own work|completes that stage|runs that stage|the stage still)/i);
});

// row 18 — the stop rule must not contradict the mode it sits next to
test('unattended: stop-and-wait applies only to escalations nobody pre-approved', () => {
  const t = pb('auto.md');
  const stopRule = t.split('\n').find((l) => /stop at the exact step/i.test(l)) ?? '';
  assert.match(stopRule, /not pre-approved|NOT pre-approved|unapproved|not covered/i,
    'the unconditional stop rule would override the pre-approval it sits beside');
  assert.match(t, /(pre-approved|pre-authoriz).*(keep going|without asking|continue)/is);
});

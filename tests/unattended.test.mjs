import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, writeChange, STANDARD_BODY, PKG_ROOT } from './helpers.mjs';
import { buildReport, renderReport } from '../lib/observe.mjs';
import { countEffectiveLines } from '../lib/caps.mjs';

const STAGES = ['new', 'design', 'contract', 'build', 'verify', 'review', 'ship'];
const pb = (n) => fs.readFileSync(path.join(PKG_ROOT, 'payload/playbook', n), 'utf8');
const stub = (n) => fs.readFileSync(
  path.join(PKG_ROOT, 'payload/adapters/claude/commands/sdlc', `${n}.md`), 'utf8');

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

// ---- scope-evidence: the Confirm step must show how a scope was derived ----
// These assert what auto.md REQUIRES, never how it words it — the prior contract
// already ruled that pinning prose freezes it. What a run then does is the rubric's job.

// Confirm's own section, so a match elsewhere in the file cannot satisfy these. Both
// bounds must be found: a silently unbounded slice would run these assertions over the
// rest of the file and pass on text that has nothing to do with Confirm.
function confirmSection() {
  const t = pb('auto.md');
  const start = t.search(/\*\*Confirm\.\*\*/);
  assert.ok(start > -1, 'auto.md has no Confirm step');
  const rest = t.slice(start);
  const end = rest.search(/\n\d+\. \*\*/);
  assert.ok(end > -1, 'Confirm has no following numbered step — the section slice is unbounded');
  // Collapse wrapping: these rows test what the doctrine requires, and a requirement
  // does not change meaning because a sentence broke across two lines.
  return rest.slice(0, end).replace(/\s+/g, ' ');
}

// row 1
test('scope-evidence: Confirm requires the command that established the scope and its output', () => {
  const s = confirmSection();
  // The command AND what it returned, in one requirement — `command` alone appears in
  // plenty of sentences that ask for nothing.
  assert.match(s, /the command (you ran|whose output)/i);
  assert.match(s, /what it returned|its output/i);
});

// row 2
test('scope-evidence: evidence is required per scope item, not once for the whole scope', () => {
  const s = confirmSection();
  assert.match(s, /per item|per scope item|each scope item/i);
  assert.match(s, /one block|single yes|whole scope/i);
});

// row 3
test('scope-evidence: a scope resting on no command must be declared as such', () => {
  assert.match(confirmSection(), /did not derive|not derive[d]? from a command|no command/i);
});

// row 4
test('scope-evidence: a summary of what a search found does not satisfy the evidence rule', () => {
  assert.match(confirmSection(), /not your summary|summary of it|not the list it produced/i);
});

// row 5
test('scope-evidence: evidence searching a different term than the request is flagged', () => {
  const s = confirmSection();
  assert.match(s, /flag evidence that does not match|flag .* mismatch/i);
  // Both terms named, not just "there is a mismatch" — the point is that the reader
  // sees the gap without re-deriving it.
  assert.match(s, /term the request used/i);
  assert.match(s, /term you actually searched/i);
});

// row 6
test('scope-evidence: an unrequested narrowing is its own refusable item', () => {
  const s = confirmSection();
  assert.match(s, /folder pattern|naming convention/i);
  assert.match(s, /refusable|refuse/i);
});

// row 7
test('scope-evidence: an exclusion on an empty result names the pattern searched', () => {
  const s = confirmSection();
  assert.match(s, /empty result/i);
  assert.match(s, /names the pattern|pattern searched/i);
});

// row 8
test('scope-evidence: an empty result is written as a claim, never as an established absence', () => {
  assert.match(confirmSection(), /claim about your pattern|not a fact about/i);
});

// row 9 — regression guard, green before implementation by design. It guards the
// escalation rows' refusability, which predates this change; the evidence rules' own
// per-item requirement is row 2's job, not this one's.
test('scope-evidence: per-item refusability of the escalation rows still stands', () => {
  const s = confirmSection();
  assert.match(s, /refusable on its own/);
  assert.match(s, /hard-floor surface/);
});

// row 10 — playbooks carry no cap in lib/caps.mjs and the validator does not check them,
// so this number is the only thing standing between auto.md and unbounded growth. It is
// deliberately pinned just above the current count: auto.md is already 2-3x its sibling
// playbooks (21-31 lines), and the point is that the next addition has to be a decision
// somebody makes on purpose, not a drift nobody notices. Raising it is allowed; raising
// it silently is not.
test('scope-evidence: auto.md stays within its stated line budget', () => {
  const lines = countEffectiveLines(pb('auto.md'));
  assert.ok(lines <= 75, `auto.md is ${lines} effective lines, budget is 75 — raise it deliberately or trim`);
});

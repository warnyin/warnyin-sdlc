// Contract rows for smaller-review-stage-tokens: sdlc/changes/smaller-review-stage-tokens/contract/tests.md.
// Rows 1-6 and 16 pin payload prose verbatim through tests/rule-pins.mjs. Rows 7-19 drive
// lib/observe.mjs and the observe CLI with journal fixtures in mkdtemp projects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, writeChange, writeContractTests, STANDARD_BODY, PKG_ROOT } from './helpers.mjs';
import { oneLine, payload, nonEmpty, body, step, section, assertAbsent, assertRule } from './rule-pins.mjs';
import { buildReport, renderReport } from '../lib/observe.mjs';

// Exact sentences from contract/tests.md.
const P1 = "A repeated panel — one after a review that recorded blockers — runs `sdlc-security`, every lens reviewer, and every other reviewer that raised a blocker last round or whose domain the fix diff touches; when unsure whether one did, it runs, and a deep change's repeated panel runs all four.";
const P2 = "A first panel on tier standard runs `sdlc-security` and `sdlc-quality`, adds `sdlc-architect` when change.md holds more than one `## Delta:` section or the diff changes more than 10 files, and adds `sdlc-ops` when the diff touches or may touch config, migrations or deploy files or the change has a `runbook.md`; tier deep runs all four.";
const P3 = "Run it as a read-only subagent when possible; every reviewer this step calls still runs.";
const P4 = "`mode=panel` only when every reviewer that ran — core, and each lens — was an independent agent;";
const P6 = "reviewed its own work through the lenses of the reviewers this step calls instead.";
const P5 = "per stage (`contract`, `build`, `verify`, `review`, `ship`): input and output tokens grown since the previous stage event, from `stages`, printed under the change's line.";

// Row 6: the existing sdlc-security sentence, read from its agent file.
const SEC = 'A repeated panel never narrows what you check: a vulnerability in any code is a blocker.';

// Retired wording that must not survive anywhere under payload/ (row 5).
const RETIRED = ['four core reviewers still run', 'the four and each lens', 'through those four lenses'];

// The sentence occurs exactly once in the collapsed anchor.
function pinOnce(anchor, sentence, where) {
  const text = oneLine(nonEmpty(anchor, where));
  const want = oneLine(sentence);
  const first = text.indexOf(want);
  assert.notEqual(first, -1, `${where} must state verbatim: "${sentence}"`);
  assert.equal(text.lastIndexOf(want), first, `${where} states "${sentence}" more than once`);
}

// Exactly once, and bounded where it stands (rule-pins decides the bounds).
function pin(anchor, sentence, where) {
  pinOnce(anchor, sentence, where);
  assertRule(anchor, sentence, where);
}

// Every file under a directory, recursively, as absolute paths.
function filesUnder(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) filesUnder(p, out);
    else out.push(p);
  }
  return out;
}

// The Cost bullet of observe.md: from its "- **Cost**" line up to the next bullet line.
function costBullet(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.includes('- **Cost**'));
  if (start === -1) return '';
  const rel = lines.slice(start + 1).findIndex((l) => /^\s*- \*\*/.test(l));
  return lines.slice(start, rel === -1 ? undefined : start + 1 + rel).join('\n');
}

test('row 1: review.md step 1 states P1 once', () => {
  pin(step(payload('playbook/review.md'), 1), P1, 'review.md step 1');
});

test('row 2: review.md step 1 states P2 once', () => {
  pin(step(payload('playbook/review.md'), 1), P2, 'review.md step 1');
});

test('row 3: review.md states P3 once, and "the four core reviewers still run" is gone', () => {
  const review = payload('playbook/review.md');
  pin(review, P3, 'review.md');
  assertAbsent(review, 'the four core reviewers still run', 'review.md',
    'a repeated or first panel names every reviewer that ran, not four');
});

test('row 4: review.md step 4 states P4 and P6 once each', () => {
  const anchor = step(payload('playbook/review.md'), 4);
  pin(anchor, P4, 'review.md step 4');
  // P6 sits mid-sentence after "the main loop", so no clause start bounds it: it is pinned verbatim,
  // the way scoped-test-commands pins its parenthetical sentence.
  pinOnce(anchor, P6, 'review.md step 4');
});

test('row 5: payload/** holds none of the three retired phrases; the expert-lenses Delta drops "keeps its four core reviewers"', () => {
  const root = path.join(PKG_ROOT, 'payload');
  const files = filesUnder(root);
  assert.ok(files.length > 0, 'payload/ holds no files to sweep');
  const hits = [];
  for (const f of files) {
    const text = oneLine(fs.readFileSync(f, 'utf8'));
    for (const lit of RETIRED) {
      if (text.includes(oneLine(lit))) hits.push(`${path.relative(root, f).split(path.sep).join('/')}: "${lit}"`);
    }
  }
  assert.deepEqual(hits, [], 'payload/ still carries retired review-panel wording');

  // Until ship the living spec still carries the phrase, so the open change's Delta is read; once the
  // change is archived (its folder moves) the merged living spec is read. Either way the phrase is gone.
  const open = path.join(PKG_ROOT, 'sdlc', 'changes', 'smaller-review-stage-tokens', 'change.md');
  if (fs.existsSync(open)) {
    const delta = nonEmpty(section(fs.readFileSync(open, 'utf8'), 'Delta: expert-lenses'), 'change.md ## Delta: expert-lenses');
    assertAbsent(delta, 'keeps its four core reviewers', 'change.md ## Delta: expert-lenses',
      'the expert-lenses Delta must not keep the four core reviewers');
  } else {
    const spec = fs.readFileSync(path.join(PKG_ROOT, 'sdlc', 'specs', 'expert-lenses', 'spec.md'), 'utf8');
    assertAbsent(spec, 'keeps its four core reviewers', 'sdlc/specs/expert-lenses/spec.md',
      'the merged spec must not keep the four core reviewers');
  }
});

test('row 6: sdlc-security.md body still states its never-narrows sentence once', () => {
  const agent = body(payload('adapters/claude/agents/sdlc-security.md'), 'sdlc-security.md');
  pin(agent, SEC, 'sdlc-security.md body');
});

// ---- rows 7-19: lib/observe.mjs over journal fixtures ----

function initProject(t) {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res.status, 0, res.stderr);
  return dir;
}

// The live journal of the open change add-2fa, where observe reads an open change's telemetry.
function journal(dir, events) {
  const live = path.join(dir, 'sdlc', '.state', 'journal', 'add-2fa.ndjson');
  fs.mkdirSync(path.dirname(live), { recursive: true });
  fs.writeFileSync(live, events.map((e) => JSON.stringify(e) + '\n').join(''));
}

const at = (hm) => `2026-08-10T${hm}:00Z`;
const rec = (hm, session, input, output, cacheRead = 0, cacheWrite = 0) => ({
  ts: at(hm), event: 'session', session, totals: { input, output, cacheRead, cacheWrite },
});
const mark = (hm, event) => ({ ts: at(hm), event });
const verifyAt = (hm, result, round) => ({ ts: at(hm), event: 'verify', result, round });

function reportFor(t, events) {
  const dir = initProject(t);
  writeChange(dir, 'add-2fa', { status: 'new', body: STANDARD_BODY });
  journal(dir, events);
  return { dir, report: buildReport(path.join(dir, 'sdlc')) };
}

function changeOf(report) {
  const c = report.changes.find((x) => x.id === 'add-2fa');
  assert.ok(c, 'the open change add-2fa is missing from the report');
  return c;
}

function stagesOf(c) {
  assert.ok(Array.isArray(c.stages), `change ${c.id} carries no stages array`);
  return c.stages;
}

const shape = (stages) => stages.map(({ stage, input, output }) => ({ stage, input, output }));

const stageLinesOf = (text) => text.split('\n').filter((l) => /^ {4}· /.test(l));

test('row 7: stages give contract and build their growth since the previous stage event', (t) => {
  const { report } = reportFor(t, [
    rec('00:00', 's1', 100, 10),
    rec('01:00', 's1', 300, 40),
    mark('01:00', 'contract'),
    mark('02:00', 'build'),
    rec('02:00', 's1', 500, 90),
  ]);
  assert.deepEqual(shape(stagesOf(changeOf(report))), [
    { stage: 'contract', input: 200, output: 30 },
    { stage: 'build', input: 200, output: 50 },
  ]);
});

test('row 8: all six stage events appear in time order, each with its own growth', (t) => {
  const { report } = reportFor(t, [
    rec('00:00', 's1', 100, 10),
    rec('01:00', 's1', 200, 30),
    mark('01:00', 'contract'),
    rec('02:00', 's1', 260, 45),
    mark('02:00', 'build'),
    rec('03:00', 's1', 300, 50),
    { ts: at('03:00'), event: 'review', blockers: '0', mode: 'panel', base: 'tree1' },
    rec('04:00', 's1', 360, 60),
    verifyAt('04:00', 'fail', '1'),
    rec('05:00', 's1', 400, 75),
    verifyAt('05:00', 'pass', '2'),
    rec('06:00', 's1', 460, 90),
    mark('06:00', 'ship'),
  ]);
  assert.deepEqual(shape(stagesOf(changeOf(report))), [
    { stage: 'contract', input: 100, output: 20 },
    { stage: 'build', input: 60, output: 15 },
    { stage: 'review', input: 40, output: 5 },
    { stage: 'verify', input: 60, output: 10 },
    { stage: 'verify', input: 40, output: 15 },
    { stage: 'ship', input: 60, output: 15 },
  ]);
});

test('row 9: no stage event (only gate/compact/inject, or a review skip note) gives empty stages and no stage line', (t) => {
  const noStageEvent = reportFor(t, [
    rec('00:00', 's1', 100, 10),
    { ts: at('00:10'), event: 'gate', gate: 'fast' },
    { ts: at('00:20'), event: 'compact' },
    { ts: at('00:30'), event: 'inject' },
    rec('01:00', 's1', 300, 40),
  ]);
  assert.deepEqual(stagesOf(changeOf(noStageEvent.report)), []);
  assert.deepEqual(stageLinesOf(renderReport(noStageEvent.report)), []);

  const skipNote = reportFor(t, [
    rec('00:00', 's1', 100, 10),
    { ts: at('00:10'), event: 'review', blockers: '0', skipped: 'no-signal' },
    rec('01:00', 's1', 300, 40),
  ]);
  assert.deepEqual(stagesOf(changeOf(skipNote.report)), []);
  assert.deepEqual(stageLinesOf(renderReport(skipNote.report)), []);
});

test('row 10: two sessions are each counted once: A growth plus B whole total at the event', (t) => {
  const { report } = reportFor(t, [
    rec('00:00', 'a', 100, 10),
    rec('00:30', 'a', 150, 20),
    mark('01:00', 'contract'),
    rec('02:00', 'a', 300, 40),
    rec('02:30', 'b', 50, 5),
    mark('03:00', 'build'),
  ]);
  assert.deepEqual(shape(stagesOf(changeOf(report))), [
    { stage: 'contract', input: 50, output: 10 },
    { stage: 'build', input: 200, output: 25 },
  ]);
});

test('row 11: a class that falls has growth 0, never negative, for one session and for a sum that falls', (t) => {
  const oneSession = reportFor(t, [
    rec('00:00', 's1', 300, 40),
    rec('00:30', 's1', 200, 50),
    mark('01:00', 'contract'),
  ]);
  assert.deepEqual(shape(stagesOf(changeOf(oneSession.report))), [
    { stage: 'contract', input: 0, output: 10 },
  ]);

  // Session a drops from 300/40 to 100/50 while b holds 200/20: the sum falls on input, rises on output.
  const sumFalls = reportFor(t, [
    rec('00:00', 'a', 300, 40),
    rec('00:10', 'b', 200, 20),
    rec('00:30', 'a', 100, 50),
    mark('01:00', 'contract'),
  ]);
  assert.deepEqual(shape(stagesOf(changeOf(sumFalls.report))), [
    { stage: 'contract', input: 0, output: 30 },
  ]);
});

test('row 12: a record after the last stage event is in no stage; tokens still sum the latest records', (t) => {
  const { report } = reportFor(t, [
    rec('00:00', 's1', 100, 10),
    rec('00:30', 's1', 200, 30),
    mark('01:00', 'contract'),
    rec('02:00', 's1', 300, 40),
  ]);
  const c = changeOf(report);
  assert.deepEqual(shape(stagesOf(c)), [{ stage: 'contract', input: 100, output: 20 }]);
  assert.equal(c.tokens.input, 300);
  assert.equal(c.tokens.output, 40);
});

test('row 13: each stage entry carries input, output, cacheRead and cacheWrite', (t) => {
  const { report } = reportFor(t, [
    rec('00:00', 's1', 100, 10, 1000, 200),
    rec('00:30', 's1', 200, 30, 3000, 500),
    mark('01:00', 'contract'),
  ]);
  assert.deepEqual(stagesOf(changeOf(report)), [
    { stage: 'contract', input: 100, output: 20, cacheRead: 2000, cacheWrite: 300 },
  ]);
});

test('row 14: renderReport prints each stage under the change line, in order, as "· <stage> in/out"', (t) => {
  const { report } = reportFor(t, [
    rec('00:00', 's1', 1000, 500),
    rec('00:30', 's1', 3000, 900),
    mark('01:00', 'contract'),
    rec('01:30', 's1', 4500, 1400),
    mark('02:00', 'build'),
  ]);
  const lines = renderReport(report).split('\n');
  const head = lines.findIndex((l) => l.startsWith('  · add-2fa'));
  assert.notEqual(head, -1, 'renderReport has no change line for add-2fa');
  const stageLines = stageLinesOf(renderReport(report));
  assert.deepEqual(stageLines, ['    · contract 2.0kin/400out', '    · build 1.5kin/500out']);
  assert.ok(lines.indexOf(stageLines[0]) > head, 'the stage lines sit under the change line');
});

test('row 15: observe --json holds a stages array on each change', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'add-2fa', { status: 'new', body: STANDARD_BODY });
  journal(dir, [rec('00:00', 's1', 100, 10), rec('00:30', 's1', 200, 30), mark('01:00', 'contract')]);
  const res = runCli(dir, ['observe', '--json']);
  assert.equal(res.status, 0, res.stderr);
  const json = JSON.parse(res.stdout);
  const c = json.changes.find((x) => x.id === 'add-2fa');
  assert.ok(c, 'observe --json has no change add-2fa');
  assert.deepEqual(shape(stagesOf(c)), [{ stage: 'contract', input: 100, output: 20 }]);
});

test('row 16: observe.md Cost bullet states P5 once', () => {
  pin(costBullet(payload('playbook/observe.md')), P5, 'observe.md Cost bullet');
});

test('row 17: a stage event before any session record grows 0; the build after it grows the record total', (t) => {
  const { report } = reportFor(t, [
    mark('00:00', 'contract'),
    rec('00:30', 's1', 100, 10),
    mark('01:00', 'build'),
  ]);
  assert.deepEqual(shape(stagesOf(changeOf(report))), [
    { stage: 'contract', input: 0, output: 0 },
    { stage: 'build', input: 100, output: 10 },
  ]);
});

test('row 18: an archived journal reports the same stages, plus the ship event archive itself writes', (t) => {
  const dir = initProject(t);
  const changeDir = writeChange(dir, 'add-2fa', { status: 'verified', body: STANDARD_BODY });
  writeContractTests(changeDir);
  journal(dir, [
    rec('00:00', 's1', 100, 10),
    mark('00:30', 'contract'),
    rec('01:00', 's1', 200, 30),
    mark('01:30', 'build'),
    rec('02:00', 's1', 260, 45),
    verifyAt('02:30', 'pass', '1'),
    rec('03:00', 's1', 300, 60),
  ]);
  const before = shape(stagesOf(changeOf(buildReport(path.join(dir, 'sdlc')))));
  const res = runCli(dir, ['archive', 'add-2fa']);
  assert.equal(res.status, 0, res.stderr);
  const archived = buildReport(path.join(dir, 'sdlc')).changes.find((c) => c.archived && c.id.endsWith('add-2fa'));
  assert.ok(archived, 'the archived add-2fa is missing from the report');
  // archive appends its own `ship` event (bin/cli.mjs), which is a stage like any other: the 03:00 record
  // since the verify event (260/45 -> 300/60) is its growth.
  assert.deepEqual(shape(stagesOf(archived)), [...before, { stage: 'ship', input: 40, output: 15 }]);
});

test('row 19: a build with source=review keeps source on its entry; a build without source has no source key', (t) => {
  const { report } = reportFor(t, [
    rec('00:00', 's1', 100, 10),
    rec('00:10', 's1', 150, 20),
    { ts: at('00:30'), event: 'build', source: 'review' },
    rec('01:00', 's1', 200, 30),
    mark('01:30', 'build'),
  ]);
  const stages = stagesOf(changeOf(report));
  assert.deepEqual(shape(stages), [
    { stage: 'build', input: 50, output: 10 },
    { stage: 'build', input: 50, output: 10 },
  ]);
  assert.equal(stages[0].source, 'review');
  assert.equal(Object.hasOwn(stages[1], 'source'), false, 'a build without source must have no source key');
});

// Contract rows for verify-fast-final-gates: sdlc/changes/verify-fast-final-gates/contract/tests.md.
// Doctrine rows read what verify.md, review.md, next.md and ship.md REQUIRE, whitespace folded,
// with bounded proximity regexes; whether a run follows the gates is scored by contract/evals.md.
// Report rows drive lib/observe.mjs through buildReport.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, writeChange, STANDARD_BODY, PKG_ROOT } from './helpers.mjs';
import { buildReport } from '../lib/observe.mjs';
import { countEffectiveLines } from '../lib/caps.mjs';

const read = (rel) => fs.readFileSync(path.join(PKG_ROOT, 'payload', rel), 'utf8');
const pb = (n) => read(`playbook/${n}`);
const oneLine = (s) => s.replace(/\s+/g, ' ');

// A gate section starts at a numbered step or heading whose label is the gate's name.
const GATE_START = (name) => new RegExp(`^(?:\\d+\\.\\s+|#+\\s+)\\**${name} gate`, 'im');

// list = the gate-choice rules before the gates; fast and final = each gate's step.
function gates(text = pb('verify.md')) {
  const fast = text.search(GATE_START('Fast'));
  const final = text.search(GATE_START('Final'));
  assert.ok(fast > -1, 'verify.md has no fast gate step');
  assert.ok(final > fast, 'verify.md has no final gate step after the fast gate');
  return {
    list: oneLine(text.slice(0, fast)),
    fast: oneLine(text.slice(fast, final)),
    final: oneLine(text.slice(final)),
  };
}

// The flow line: a verify comes after [review] and before ship.
const FINAL_AFTER_REVIEW = /\[review\]\s*→\s*verify[^→]{0,20}→\s*ship/;

function flowLine(text, file) {
  const line = oneLine(text).match(/new → [^.]*?→ ship/);
  assert.ok(line, `${file} has no flow line`);
  return line[0];
}

test('row 1: verify.md names a fast gate and a final gate', () => {
  const { fast, final } = gates();
  assert.ok(fast.length > 0 && final.length > 0);
});

test('row 2: the fast gate runs the harness fast test command when one is named', () => {
  assert.match(gates().fast, /`?fast test command`?[^.]{0,80}harness/i);
});

test('row 3: without a fast command it derives the tests, falling back to the full command', () => {
  const { fast } = gates();
  assert.match(fast, /contract[^.]{0,40}rows?[^.]{0,60}touched paths/i);
  assert.match(fast, /full test command[^.]{0,40}no (such )?subset/i);
});

test('row 4: the fast gate exercises a runnable surface live and names what counts', () => {
  const { fast } = gates();
  assert.match(fast, /runnable surface/i);
  assert.match(fast, /CLI[^.]{0,20}server[^.]{0,20}UI/);
  assert.match(fast, /\b(exercise|live|smoke)\b/i);
});

test('row 5: the fast gate scores evals and lens bars and never requires the full test command', () => {
  const { fast } = gates();
  assert.match(fast, /evals?/i);
  assert.match(fast, /lens bars?/i);
  assert.doesNotMatch(fast, /\brun the full test command\b/i);
});

test('row 6: the gate list routes a fast pass with review signals and no review blockers=0 note to review, unverified', () => {
  const { list, fast } = gates();
  assert.match(list, /review signals[^.]{0,120}no `review blockers=0`[^.]{0,80}\/sdlc:review/i);
  assert.match(list, /stays `building`/);
  assert.doesNotMatch(fast, /status: verified/);
});

test('row 7: the final gate runs the full test command after review, and only it sets verified', () => {
  const { final } = gates();
  assert.match(final, /full test command/i);
  assert.match(final, /review blockers=0/);
  assert.match(final, /status: verified/);
});

test('row 8: with no review signal the final gate follows in the same verify', () => {
  assert.match(oneLine(pb('verify.md')), /no review signal[^.]{0,120}final gate[^.]{0,60}same verify/i);
});

test('row 9: a final-gate failure shares the budget, reruns the fast gate first, and skips a repeat review', () => {
  const failure = oneLine(pb('verify.md').split(/^On failure/m)[1] ?? '');
  assert.ok(failure, 'verify.md has an On failure section');
  assert.match(failure, /fix tasks/i);
  assert.match(failure, /3 rounds/i);
  assert.match(failure, /fast gate[^.]{0,60}before[^.]{0,20}final gate/i);
  assert.match(failure, /review blockers=0[^.]{0,80}(not re-?run|no repeat review|without another review)/i);
});

test('row 10: reuse is decided from a recorded scope=full and no build note after it', () => {
  const { fast, final } = gates();
  assert.match(fast, /scope=<full\|scoped>/);
  assert.match(final, /scope=full[^.]{0,80}no `build` note[^.]{0,80}without re-?running/i);
  assert.match(final, /reused=yes/);
});

test('row 11: review.md passes to the final gate of /sdlc:verify, not to ship', () => {
  const text = pb('review.md');
  const at = text.search(/^Pass condition/m);
  assert.ok(at > -1, 'review.md has a Pass condition');
  const para = oneLine(text.slice(at).split(/\n\s*\n/)[0]);
  assert.match(para, /\/sdlc:verify/);
  assert.match(para, /final gate/i);
  assert.doesNotMatch(para, /\/sdlc:ship/);
});

test('row 12: next.md maps building to verify or a waiting review, verified to ship; ship names the final gate', () => {
  const lines = pb('next.md').split(/\r?\n/);
  const start = lines.findIndex((l) => /`building`/.test(l));
  assert.ok(start > -1, 'next.md has a building line');
  // the bullet plus its wrapped continuation lines, up to the next bullet
  const after = lines.slice(start + 1);
  const end = after.findIndex((l) => !/^\s+\S/.test(l) || /^\s*-\s/.test(l));
  const building = [lines[start], ...after.slice(0, end < 0 ? after.length : end)].join(' ');
  assert.match(building, /all tasks[^\n]{0,40}\/sdlc:verify/i);
  assert.match(building, /\/sdlc:review[^]{0,120}gate=fast|gate=fast[^]{0,120}\/sdlc:review/,
    'a fast pass awaiting review goes straight to review');
  const verified = lines.find((l) => /`verified`/.test(l)) ?? '';
  assert.match(verified, /\/sdlc:ship/);
  assert.doesNotMatch(verified, /\/sdlc:review/);
  const precondition = pb('ship.md').split(/\r?\n/).find((l) => /^Precondition/.test(l)) ?? '';
  assert.match(precondition, /final gate/i);
});

test('row 13: verify notes carry gate=fast, gate=final and mode=', () => {
  const text = pb('verify.md');
  assert.match(text, /gate=fast/);
  assert.match(text, /gate=final/);
  assert.match(text, /mode=<panel\|solo>/);
});

function reportFor(t, events) {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const changeDir = writeChange(dir, 'gated', { status: 'building', body: STANDARD_BODY });
  // Open-change telemetry lives out of tree, as tests/provenance.test.mjs does.
  const live = path.resolve(changeDir, '..', '..', '.state', 'journal', `${path.basename(changeDir)}.ndjson`);
  fs.mkdirSync(path.dirname(live), { recursive: true });
  for (const e of events) fs.appendFileSync(live, JSON.stringify(e) + '\n');
  return buildReport(path.join(dir, 'sdlc')).changes.find((c) => c.id.endsWith('gated')).verify;
}

const v = (ts, result, round, gate) => ({ ts: `2026-09-17T0${ts}:00:00Z`, event: 'verify', result, round, mode: 'panel', ...(gate ? { gate } : {}) });

test('row 14: a fast pass then a final pass is one round, first-pass', (t) => {
  const verify = reportFor(t, [v(1, 'pass', '1', 'fast'), v(2, 'pass', '1', 'final')]);
  assert.deepEqual(verify, { rounds: 1, firstPass: true });
});

test('row 15: fast fail, fast pass, final pass is two rounds, not first-pass', (t) => {
  const verify = reportFor(t, [v(1, 'fail', '1', 'fast'), v(2, 'pass', '2', 'fast'), v(3, 'pass', '2', 'final')]);
  assert.deepEqual(verify, { rounds: 2, firstPass: false });
});

test('row 16: a final-gate failure is a round and clears first-pass', (t) => {
  const verify = reportFor(t, [v(1, 'pass', '1', 'fast'), v(2, 'fail', '1', 'final')]);
  assert.deepEqual(verify, { rounds: 2, firstPass: false });
});

// Regression guard: green before implementation by design.
test('row 17: verify notes without a gate field still count as rounds', (t) => {
  const verify = reportFor(t, [v(1, 'fail', '1'), v(2, 'pass', '2')]);
  assert.deepEqual(verify, { rounds: 2, firstPass: false });
});

test('row 18: the harness seed names an optional fast test command, and init seeds it', (t) => {
  const seed = read('templates/harness.md');
  assert.match(seed, /^- test command:/m);
  assert.match(seed, /^- fast test command:[^\n]*optional/im);
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'claude']).status, 0);
  assert.match(fs.readFileSync(path.join(dir, 'sdlc/harness.md'), 'utf8'), /^- fast test command:/m);
});

test('row 19: flow lines put a final verify after [review]; the card stays within 40 lines', () => {
  for (const f of ['rules-card.md', 'README.md', 'auto.md']) {
    assert.match(flowLine(pb(f), f), FINAL_AFTER_REVIEW, `${f} flow line`);
  }
  const lines = countEffectiveLines(pb('rules-card.md'));
  assert.ok(lines <= 40, `rules-card.md is ${lines} effective lines, budget is 40`);
});

test('row 20: the verify command description no longer promises full tests every round', () => {
  const desc = read('adapters/claude/commands/sdlc/verify.md').match(/^description:(.*)$/m)?.[1] ?? '';
  assert.match(desc, /fast gate/i);
  assert.match(desc, /(full suite|full tests|final gate)[^;]{0,30}once/i);
});

test('row 21: a fresh claude install carries both gates', (t) => {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'claude']).status, 0);
  gates(fs.readFileSync(path.join(dir, 'sdlc/.playbook/verify.md'), 'utf8'));
});

test('row 22: a fresh cursor install embeds the flow with a final verify after review', (t) => {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'cursor']).status, 0);
  const rules = fs.readFileSync(path.join(dir, '.cursor/rules/sdlc.mdc'), 'utf8');
  assert.match(flowLine(rules, 'sdlc.mdc'), FINAL_AFTER_REVIEW);
});

test('row 23: a skipped review records blockers=0; verify and ship defer to review.md for signals', () => {
  const review = oneLine(pb('review.md'));
  assert.match(review, /skip[^]{0,200}note review blockers=0 skipped=no-signal/i);
  for (const f of ['verify.md', 'ship.md']) {
    const text = oneLine(pb(f));
    assert.match(text, /review signals[^.]{0,40}`review\.md`/i, `${f} points to review.md for the signals`);
    assert.doesNotMatch(text, /security-touching/, `${f} keeps no signal list of its own`);
  }
});

test('row 24: a fix review applies itself is recorded as a build', () => {
  assert.match(pb('review.md'), /note build tasks=<n> source=review/);
});

test('row 25: a passing verify note with no gate counts as a fast pass that ran the full suite', () => {
  assert.match(gates().list, /no `gate`[^.]{0,80}fast pass[^.]{0,40}scope=full/i);
});

test('row 26: the digest names a reused final gate', () => {
  const digest = oneLine(pb('ship.md').split(/^4\. /m)[1] ?? '');
  assert.match(digest, /reused=yes/);
});

test('row 27: gate values are normalized, and an unknown one still counts', (t) => {
  const verify = reportFor(t, [v(1, 'pass', '1', 'Fast'), v(2, 'pass', '1', 'fase'), v(3, 'pass', '1', ' FINAL ')]);
  assert.deepEqual(verify, { rounds: 2, firstPass: true });
});

test('row 28: verify evaluates the signals itself; a skipped review never counts as one', () => {
  const { list } = gates();
  assert.match(list, /evaluat[^.]{0,40}signals[^.]{0,40}(yourself|itself)/i);
  assert.match(list, /skipped=no-signal[^.]{0,60}never count/i);
  for (const f of ['next.md', 'ship.md']) {
    assert.match(oneLine(pb(f)), /not `skipped=`|never `skipped=`|skipped=no-signal[^.]{0,40}never/i, `${f} excludes skip notes`);
  }
});

test('row 29: a build after the last final-gate pass sends a verified change back to verify', () => {
  const precondition = oneLine(pb('ship.md').split(/^1\. /m)[0]);
  assert.match(precondition, /`build` note[^.]{0,60}after[^.]{0,40}final-gate pass[^.]{0,90}\/sdlc:verify/i);
});

test('row 30: a fast failure after a fast pass clears first-pass', (t) => {
  const verify = reportFor(t, [v(1, 'pass', '1', 'fast'), v(2, 'fail', '2', 'fast'), v(3, 'pass', '2', 'final')]);
  assert.deepEqual(verify, { rounds: 2, firstPass: false });
});

test('row 31: once the journal shows a fast pass or verified, review never skips, whoever called it', () => {
  const runWhen = oneLine(pb('review.md').split(/^1\. /m)[0]);
  assert.match(runWhen, /fast pass[^.]{0,80}since the last `build` note[^.]{0,120}never skip/i);
  assert.match(runWhen, /`status: verified`/);
  assert.match(runWhen, /journal, not[^.]{0,40}(who|caller|invoked)/i);
});

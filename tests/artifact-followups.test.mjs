// Contract rows 1-12 (with 4b, 4c, 5b, 8b) of sdlc/changes/artifact-followups/contract/tests.md: escaped change ids in
// every artifact/park line, a paste-safe stale hint, the change.md cap on a stamp, an honest
// "cannot be checked" refusal, and a basis read in any case. Rows 13-14 edit
// tests/change-artifacts.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, runHook, writeChange, STANDARD_BODY, PKG_ROOT } from './helpers.mjs';
import { resolveChangeFile } from '../lib/change-file.mjs';
import { escapeEntry } from '../lib/relations.mjs';
import { artifactWarnings, hintId } from '../lib/artifacts.mjs';
import { countEffectiveLines } from '../lib/caps.mjs';
import { cmdArtifact } from '../bin/cli.mjs';

// C1 CSI, right-to-left override, zero-width space, left-to-right isolate: each reaches a terminal raw
// today, and NTFS accepts all four in a name.
const BAD = 'x' + String.fromCodePoint(0x9b, 0x202e, 0x200b, 0x2066) + 'y';
const HAZARDS = ['9b', '202e', '200b', '2066'];
const BODY = STANDARD_BODY.replace('## Delta: auth', '## Design\n- decision: sms-free OTP\n\n## Delta: auth');
const LINK_SKIP = new Set(['EPERM', 'EACCES', 'ENOSYS']);

function project(t) {
  const root = makeTempProject(t);
  assert.equal(runCli(root, ['init', '--tool', 'claude']).status, 0);
  return root;
}

function writeArtifact(dir, name = 'plan.html') {
  fs.mkdirSync(path.join(dir, 'artifact'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'artifact', name), '<!doctype html><p>plan</p>\n');
}

function linkOrSkip(t, target, linkPath, type) {
  try {
    fs.symlinkSync(target, linkPath, type);
    return true;
  } catch (err) {
    if (!LINK_SKIP.has(err.code)) throw err;
    t.skip(`symlinks unavailable here (${err.code})`);
    return false;
  }
}

function assertEscaped(text, where) {
  for (const h of HAZARDS) assert.ok(text.includes(`\\u{${h}}`), `${where} shows U+${h} escaped: ${JSON.stringify(text)}`);
  assert.ok(!/[\p{Cc}\p{Cf}]/u.test(text.replace(/\r?\n/g, '')), `${where} carries no raw control or format character: ${JSON.stringify(text)}`);
}

test('row 1: escapeEntry escapes every Cc and Cf code point and leaves the rest', () => {
  const missed = [];
  for (let cp = 0; cp <= 0x10ffff; cp++) {
    if (cp >= 0xd800 && cp <= 0xdfff) continue;
    const ch = String.fromCodePoint(cp);
    const hazard = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(ch);
    const want = hazard ? `\\u{${cp.toString(16)}}` : ch;
    if (escapeEntry(ch) !== want) missed.push(cp.toString(16));
  }
  assert.deepEqual(missed, [], 'every Cc/Cf (and line/paragraph separator) code point comes back escaped, every other one unchanged');
});

test('row 2: every resolveChangeFile refusal shows the id escaped', async (t) => {
  const root = project(t);
  const sdlcRoot = path.join(root, 'sdlc');
  const dir = path.join(sdlcRoot, 'changes', BAD);
  const outside = fs.mkdtempSync(path.join(path.dirname(root), 'af-out-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outside, 'change.md'), '---\nid: x\n---\n');

  assertEscaped(resolveChangeFile(sdlcRoot, BAD, 'stamp').error, 'no folder');
  fs.mkdirSync(dir);
  assertEscaped(resolveChangeFile(sdlcRoot, BAD, 'stamp').error, 'no change.md');
  await t.test('change.md linked out', (st) => {
    if (!linkOrSkip(st, path.join(outside, 'change.md'), path.join(dir, 'change.md'), 'file')) return;
    assertEscaped(resolveChangeFile(sdlcRoot, BAD, 'stamp').error, 'linked change.md');
  });
  fs.rmSync(dir, { recursive: true, force: true });
  await t.test('folder linked out', (st) => {
    if (!linkOrSkip(st, outside, dir, 'junction')) return;
    assertEscaped(resolveChangeFile(sdlcRoot, BAD, 'stamp').error, 'linked folder');
  });
});

test('row 3: artifact refusals show the id escaped', (t) => {
  const root = project(t);
  const none = runCli(root, ['artifact', BAD, 'plan.html']);
  assert.notEqual(none.status, 0);
  assertEscaped(none.stderr, 'no such change');
  const dir = writeChange(root, BAD, { body: BODY });
  const noFolder = runCli(root, ['artifact', BAD, 'plan.html']);
  assert.notEqual(noFolder.status, 0);
  assertEscaped(noFolder.stderr, 'no artifact/ folder');
  fs.mkdirSync(path.join(dir, 'artifact'));
  const noFile = runCli(root, ['artifact', BAD, 'plan.html']);
  assert.notEqual(noFile.status, 0);
  assert.match(noFile.stderr, /is missing/);
  assertEscaped(noFile.stderr, 'no artifact file');
  writeArtifact(dir);
  const stamped = runCli(root, ['artifact', BAD, 'plan.html']);
  assert.equal(stamped.status, 0, stamped.stderr);
  assert.match(stamped.stdout, /^stamped: /);
  assertEscaped(stamped.stdout, 'stamp success line');
  const capRoot = project(t);
  const file = padded(capRoot, BAD, { lines: 100 });
  const before = fs.readFileSync(file);
  const refused = runCli(capRoot, ['artifact', BAD, 'plan.html']);
  assert.match(refused.stderr, /cap of 100 lines/);
  assertEscaped(refused.stderr, 'cap refusal');
  assert.ok(fs.readFileSync(file).equals(before));
});

test('row 4: park and unpark show the id escaped in refusals and success lines', (t) => {
  const root = project(t);
  const park = () => runHook(root, 'journal.mjs', { args: ['park', BAD], stdin: { reason: 'shelved' } });
  const unpark = () => runHook(root, 'journal.mjs', { args: ['unpark', BAD] });
  const out = (r) => `${r.stdout}${r.stderr}`;
  assertEscaped(out(park()), 'park, no such change');
  writeChange(root, BAD, { body: BODY });
  const parked = park();
  assert.equal(parked.status, 0, parked.stderr);
  assertEscaped(out(parked), 'park success');
  assertEscaped(out(park()), 'park again');
  const unparked = unpark();
  assert.equal(unparked.status, 0, unparked.stderr);
  assertEscaped(out(unparked), 'unpark success');
  assertEscaped(out(unpark()), 'unpark again');
});

// The park refusal branches past resolve, each in its own project so one state never masks another.
test('row 4b: every park/unpark refusal branch shows the ids escaped', async (t) => {
  const out = (r) => `${r.stdout}${r.stderr}`;
  const run = (root, args, stdin) => out(runHook(root, 'journal.mjs', { args, ...(stdin ? { stdin } : {}) }));
  await t.test('an empty reason', (st) => {
    const root = project(st);
    writeChange(root, BAD, { body: BODY });
    assertEscaped(run(root, ['park', BAD], { reason: '' }), 'empty reason');
  });
  await t.test('a waiter whose own id is hostile', (st) => {
    const root = project(st);
    writeChange(root, 'victim', { body: BODY });
    const dir = path.join(root, 'sdlc', 'changes', BAD);
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'change.md'), `---\nid: w\ntier: standard\nstatus: new\nblocked-by: [victim]\n---\n${BODY}`);
    const text = run(root, ['park', 'victim'], { reason: 'shelved' });
    assert.match(text, /waiting on it/);
    assertEscaped(text, 'waiter list');
  });
  await t.test('change.md cannot be read', (st) => {
    const root = project(st);
    fs.mkdirSync(path.join(root, 'sdlc', 'changes', BAD, 'change.md'), { recursive: true });
    assertEscaped(run(root, ['park', BAD], { reason: 'shelved' }), 'park read failure');
    assertEscaped(run(root, ['unpark', BAD]), 'unpark read failure');
  });
  await t.test('no frontmatter', (st) => {
    const root = project(st);
    const dir = path.join(root, 'sdlc', 'changes', BAD);
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'change.md'), BODY);
    assertEscaped(run(root, ['park', BAD], { reason: 'shelved' }), 'no frontmatter');
  });
  await t.test('a duplicated parked key', (st) => {
    const root = project(st);
    const dir = path.join(root, 'sdlc', 'changes', BAD);
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'change.md'), `---\nid: x\ntier: standard\nstatus: new\nparked: "a"\nparked: "b"\n---\n${BODY}`);
    assertEscaped(run(root, ['unpark', BAD]), 'still parked');
  });
});

// Branches no fixture reaches without a race (the write failing after resolve) or a frontmatter
// round-trip defect are pinned by source: no id is interpolated raw in park, change-file or cmdArtifact.
test('row 4c: no change id is interpolated raw in lib/park.mjs, lib/change-file.mjs or cmdArtifact', () => {
  const src = (rel) => fs.readFileSync(path.join(PKG_ROOT, rel), 'utf8');
  const cli = src('bin/cli.mjs');
  const start = cli.indexOf('export function cmdArtifact');
  const cmd = cli.slice(start, cli.indexOf('\n}\n', start));
  const raw = [];
  for (const [where, text] of [['lib/park.mjs', src('lib/park.mjs')], ['lib/change-file.mjs', src('lib/change-file.mjs')], ['cmdArtifact', cmd]]) {
    if (/\$\{changeId\}/.test(text)) raw.push(`${where}: \${changeId}`);
    if (/\$\{waiters\.join/.test(text)) raw.push(`${where}: \${waiters.join(...)}`);
  }
  assert.ok(start >= 0, 'cmdArtifact is in bin/cli.mjs');
  assert.deepEqual(raw, []);
});

function staleLine(root, id) {
  const dir = writeChange(root, id, { body: `${BODY}\n## Artifacts\n- artifact/plan.html\n` });
  writeArtifact(dir);
  const stamp = runCli(root, ['artifact', id, 'plan.html']);
  assert.equal(stamp.status, 0, stamp.stderr);
  const file = path.join(dir, 'change.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('second factor', 'second factor always'));
  const res = runCli(root, ['validate', id]);
  const line = `${res.stdout}${res.stderr}`.split(/\r?\n/).find((l) => l.includes('is stale'));
  assert.ok(line, `a stale warning for ${JSON.stringify(id)}:\n${res.stdout}${res.stderr}`);
  return line;
}

test('row 5: an id outside [A-Za-z0-9._-] gets a placeholder in the stale hint', (t) => {
  const root = project(t);
  for (const id of ['a;b', 'a$b', 'a b', '-x']) {
    assert.ok(staleLine(root, id).endsWith('(re-run: warnyin-sdlc artifact <change-id> plan.html)'),
      `${JSON.stringify(id)}: the hint names a placeholder`);
  }
});

// The class itself, swept over every code point rather than sampled: first position, then the rest.
test('row 5b: the hint keeps an id only when its first char is [A-Za-z0-9_] and the rest [A-Za-z0-9._-]', () => {
  const wrong = [];
  for (let cp = 0; cp <= 0x10ffff; cp++) {
    if (cp >= 0xd800 && cp <= 0xdfff) continue;
    const c = String.fromCodePoint(cp);
    const first = /[A-Za-z0-9_]/.test(c);
    const rest = /[A-Za-z0-9._-]/.test(c);
    if ((hintId(`${c}x`) === `${c}x`) !== first) wrong.push(`first ${JSON.stringify(c)}`);
    if ((hintId(`a${c}b`) === `a${c}b`) !== rest) wrong.push(`inner ${JSON.stringify(c)}`);
  }
  assert.deepEqual(wrong, [], 'every other character yields the placeholder');
  assert.equal(hintId('a&b'), '<change-id>');
});

test('row 6: a plain id is named in full in the stale hint, however long', (t) => {
  const root = project(t);
  for (const id of ['plain-id-1.x_y', 'a'.repeat(85)]) {
    const line = staleLine(root, id);
    assert.ok(line.endsWith(`(re-run: warnyin-sdlc artifact ${id} plan.html)`), line);
  }
});

// A change.md padded to exactly `lines` effective lines.
function padded(root, id, { tier = 'standard', lines, artifacts = '- artifact/other.md\n', crlf = false }) {
  const base = artifacts === null ? `${BODY}` : `${BODY}\n## Artifacts\n${artifacts}`;
  const head = `---\nid: ${id}\ntier: ${tier}\nstatus: new\n---\n`;
  const missing = lines - countEffectiveLines(head + base) - 1; // `## Assumptions` is one more line
  assert.ok(missing > 0, `the ${id} fixture starts under ${lines}`);
  const pad = Array.from({ length: missing }, (_, i) => `- filler ${i}`).join('\n');
  let text = head + base.replace('## Design', `## Assumptions\n${pad}\n\n## Design`);
  if (crlf) text = text.replace(/\n/g, '\r\n');
  const dir = path.join(root, 'sdlc', 'changes', id);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'change.md');
  fs.writeFileSync(file, text);
  assert.equal(countEffectiveLines(fs.readFileSync(file, 'utf8')), lines, `${id} padded to exactly ${lines}`);
  writeArtifact(dir);
  return file;
}

function assertRefusedAtCap(root, id, file, cap) {
  const before = fs.readFileSync(file);
  const res = runCli(root, ['artifact', id, 'plan.html']);
  assert.notEqual(res.status, 0, `${id}: refused`);
  assert.match(res.stderr, new RegExp(`cap of ${cap} lines`), `${id}: names its cap`);
  assert.match(res.stderr, /nothing was written/);
  assert.ok(fs.readFileSync(file).equals(before), `${id}: change.md is byte-identical`);
}

test('row 7: a stamp that would add a line past the standard cap is refused and writes nothing', (t) => {
  const root = project(t);
  assertRefusedAtCap(root, 'full', padded(root, 'full', { lines: 100 }), 100);
});

test('row 8: the cap holds for a new section, vibe, an unknown tier and CRLF', (t) => {
  const root = project(t);
  assertRefusedAtCap(root, 'no-section', padded(root, 'no-section', { lines: 99, artifacts: null }), 100);
  assertRefusedAtCap(root, 'vibe-full', padded(root, 'vibe-full', { tier: 'vibe', lines: 40 }), 40);
  assertRefusedAtCap(root, 'odd-tier', padded(root, 'odd-tier', { tier: 'constructor', lines: 100 }), 100);
  assertRefusedAtCap(root, 'crlf-full', padded(root, 'crlf-full', { lines: 100, crlf: true }), 100);
});

test('row 8b: a stamp that adds a line and lands exactly on the cap is allowed', (t) => {
  const root = project(t);
  const file = padded(root, 'one-short', { lines: 99 });
  const res = runCli(root, ['artifact', 'one-short', 'plan.html']);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(countEffectiveLines(fs.readFileSync(file, 'utf8')), 100);
});

test('row 9: a re-stamp that adds no line is allowed at and over the cap', (t) => {
  const root = project(t);
  for (const lines of [100, 101]) {
    const id = `listed-${lines}`;
    padded(root, id, { lines, artifacts: '- artifact/plan.html\n' });
    const res = runCli(root, ['artifact', id, 'plan.html']);
    assert.equal(res.status, 0, `${id}: ${res.stderr}`);
  }
});

function mockLstat(t, suffix) {
  const real = fs.lstatSync;
  t.mock.method(fs, 'lstatSync', function (p, ...rest) {
    if (String(p).replace(/\\/g, '/').endsWith(suffix)) throw Object.assign(new Error('denied'), { code: 'EACCES' });
    return real.call(this, p, ...rest);
  });
}

function listedChange(root) {
  const dir = writeChange(root, 'x', { body: `${BODY}\n## Artifacts\n- artifact/plan.html\n` });
  writeArtifact(dir);
  return dir;
}

test('row 10: an artifact file that cannot be lstat-ed is "cannot be checked", not "is missing"', (t) => {
  const root = project(t);
  const file = path.join(listedChange(root), 'change.md');
  const before = fs.readFileSync(file);
  mockLstat(t, '/artifact/plan.html');
  assert.throws(() => cmdArtifact(root, ['x', 'plan.html']), (err) => {
    assert.match(err.message, /cannot be checked \(EACCES\)/);
    assert.doesNotMatch(err.message, /is missing/);
    return true;
  });
  t.mock.restoreAll();
  assert.ok(fs.readFileSync(file).equals(before), 'change.md is byte-identical');
});

test('row 11: an artifact/ folder that cannot be lstat-ed is "cannot be checked" in the stamp and in validate', (t) => {
  const root = project(t);
  const dir = listedChange(root);
  const text = fs.readFileSync(path.join(dir, 'change.md'), 'utf8');
  mockLstat(t, '/artifact');
  assert.throws(() => cmdArtifact(root, ['x', 'plan.html']), (err) => {
    assert.match(err.message, /cannot be checked \(EACCES\)/);
    assert.doesNotMatch(err.message, /not a real directory/);
    return true;
  });
  const warnings = artifactWarnings(dir, text);
  t.mock.restoreAll();
  assert.ok(warnings.some((w) => /artifact\/plan\.html cannot be checked \(EACCES\)/.test(w)), JSON.stringify(warnings));
});

test('row 12: an upper- or mixed-case basis is read, so a later Delta edit reports the artifact stale', (t) => {
  const root = project(t);
  const dir = listedChange(root);
  assert.equal(runCli(root, ['artifact', 'x', 'plan.html']).status, 0);
  const file = path.join(dir, 'change.md');
  const recase = (fn) => fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/basis: ([0-9a-fA-F]{12})/, (_, h) => `basis: ${fn(h)}`));
  const quiet = () => {
    const res = runCli(root, ['validate', 'x']);
    assert.ok(!/artifact\/plan\.html/.test(res.stdout + res.stderr), `no artifact warning:\n${res.stdout}`);
  };
  recase((h) => h.toUpperCase());
  quiet();
  recase((h) => [...h.toLowerCase()].map((c, i) => (i % 2 ? c.toUpperCase() : c)).join(''));
  quiet();
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('second factor', 'second factor always'));
  const res = runCli(root, ['validate', 'x']);
  assert.match(res.stdout + res.stderr, /artifact\/plan\.html is stale/);
});

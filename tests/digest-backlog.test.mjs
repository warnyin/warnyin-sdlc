// Contract rows 1-12 of sdlc/changes/digest-backlog/contract/tests.md: four learner rules in the
// playbooks, an atomic contained write, every import form in the install order, and the Delta
// template placeholder named as such.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeTempProject, runCli, runHook, writeChange, writeContractTests, STANDARD_BODY } from './helpers.mjs';
import { payload, step, assertSentence } from './rule-pins.mjs';
import { writeFileContained } from '../lib/safe-path.mjs';
import * as cli from '../bin/cli.mjs';

const LINK_SKIP = new Set(['EPERM', 'EACCES', 'ENOSYS']);

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

function outside(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsdlc-out-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const bullet = (text, marker) => {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`- ${marker}`));
  if (start === -1) return '';
  const rel = lines.slice(start + 1).findIndex((l) => !/^\s{2,}\S/.test(l));
  return lines.slice(start, rel === -1 ? undefined : start + 1 + rel).join('\n');
};

// ---------- playbook rules ----------

test('row 1: contract.md step 1 sweeps every member of a class, range or closed set', () => {
  assertSentence(step(payload('playbook', 'contract.md'), 1),
    'A row that pins a character class, a range or a closed set sweeps every member, never a sample.', 'contract.md step 1');
});

test('row 2: contract.md step 1 gives a formula or mapping one row per input class', () => {
  assertSentence(step(payload('playbook', 'contract.md'), 1),
    'A formula or status mapping in a Delta gets one row per input class, the fallback class and the rounding rule included.', 'contract.md step 1');
});

test('row 3: review.md step 3 lists a deferral unfiltered and counts a later find as a miss', () => {
  assertSentence(step(payload('playbook', 'review.md'), 3),
    "A class deferred to a later change is recorded with its sweep's hits unfiltered — no name or variable filter — and an instance found later is recorded as a miss of that deferral.",
    'review.md step 3');
});

test('row 4: build.md lets an attended conductor take tasks that would collide', () => {
  const build = payload('playbook', 'build.md');
  const conductor = bullet(build, '**Conductor**');
  assertSentence(conductor,
    'In an attended run it may also take more tasks when they edit the same file, where builders would collide, or are each a short prose or config edit; journal `mode=conductor reason=<why>`.',
    'build.md Conductor bullet');
  assert.match(conductor.split(/\r?\n/)[0], /\battended runs only\b/, 'the Conductor line still limits it to attended runs');
  // A base count is allowed only when it names the exception; a bare cap would contradict it.
  assertSentence(conductor, 'It takes any change of one or two tasks, and more only as the next sentence allows.', 'build.md Conductor bullet');
  const counts = conductor.match(/(?:≤|<=|up to|at most|no more than|one or two|two or fewer|limited to|fewer than|max(?:imum)?)\s*(?:\w+\s+)?(?:2|two)?\s*tasks?\b/gi) ?? [];
  assert.deepEqual(counts.map((c) => c.toLowerCase()), ['one or two tasks'], `the only count is the base one tied to the exception: ${counts.join(' | ')}`);
  const builder = payload('adapters', 'claude', 'agents', 'sdlc-builder.md').split(/\r?\n/).find((l) => l.startsWith('description:'));
  assert.doesNotMatch(builder, /(?:>|more than|over)\s*(?:2|two)\b/i, 'sdlc-builder no longer claims it runs only for >2 tasks');
  assert.match(builder, /orchestrator waves/);
  assert.match(bullet(build, '**Orchestrator**'), /unless conductor/i, 'the Orchestrator bullet names the exception');
  assert.match(bullet(build, '**Unattended**'), /every task goes to its own `sdlc-builder`/, 'unattended runs still delegate every task');
});

// ---------- atomic contained write ----------

function folder(t) {
  const root = makeTempProject(t);
  const dir = path.join(root, 'd');
  fs.mkdirSync(dir);
  return { root, dir, file: path.join(dir, 'f.txt') };
}

test('row 5: a write that throws part way leaves the old content and no temp file', (t) => {
  const { root, dir, file } = folder(t);
  fs.writeFileSync(file, 'old');
  const realWrite = fs.writeFileSync;
  const realWriteSync = fs.writeSync;
  const partial = (fd) => { realWriteSync.call(fs, fd, 'new'.slice(0, 1)); throw Object.assign(new Error('disk gone'), { code: 'EIO' }); };
  t.mock.method(fs, 'writeFileSync', function (target, ...rest) {
    if (typeof target === 'number' || target === file) {
      if (typeof target === 'number') return partial(target);
      realWrite.call(fs, target, 'n');
      throw Object.assign(new Error('disk gone'), { code: 'EIO' });
    }
    return realWrite.call(this, target, ...rest);
  });
  t.mock.method(fs, 'writeSync', function (fd, ...rest) { return partial(fd); });
  assert.throws(() => writeFileContained(root, file, 'new content'), /disk gone/);
  t.mock.restoreAll();
  assert.equal(fs.readFileSync(file, 'utf8'), 'old', 'the previous content is whole');
  assert.deepEqual(fs.readdirSync(dir), ['f.txt'], 'no temporary file left behind');
});

test('row 6: a write lands whole, leaves only the file, and keeps an existing mode', (t) => {
  const { root, dir, file } = folder(t);
  assert.equal(writeFileContained(root, file, 'first'), true);
  assert.equal(fs.readFileSync(file, 'utf8'), 'first');
  assert.equal(writeFileContained(root, file, 'second'), true);
  assert.equal(fs.readFileSync(file, 'utf8'), 'second');
  assert.deepEqual(fs.readdirSync(dir), ['f.txt']);
  // Runs on every platform: the mode handed to fchmod is the existing file's own.
  const before = fs.statSync(file).mode & 0o7777;
  const real = fs.fchmodSync;
  const modes = [];
  t.mock.method(fs, 'fchmodSync', function (fd, mode) { modes.push(mode); return real.call(fs, fd, mode); });
  assert.equal(writeFileContained(root, file, 'again'), true);
  t.mock.restoreAll();
  assert.deepEqual(modes, [before], 'the temp gets exactly the existing mode');
  if (process.platform === 'win32') return;
  fs.chmodSync(file, 0o755);
  assert.equal(writeFileContained(root, file, 'third'), true);
  assert.equal(fs.statSync(file).mode & 0o777, 0o755, 'an executable keeps its mode');
});

test('row 7: a refused rename falls back on EPERM and fails cleanly otherwise', (t) => {
  {
    const { root, dir, file } = folder(t);
    fs.writeFileSync(file, 'old');
    const real = fs.renameSync;
    let calls = 0;
    t.mock.method(fs, 'renameSync', function (...args) {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error('held open'), { code: 'EPERM' });
      return real.apply(this, args);
    });
    assert.equal(writeFileContained(root, file, 'new'), true);
    t.mock.restoreAll();
    assert.ok(calls >= 1, 'a rename was attempted');
    assert.equal(fs.readFileSync(file, 'utf8'), 'new');
    assert.deepEqual(fs.readdirSync(dir), ['f.txt']);
  }
  {
    // The fallback re-checks containment: the folder became a link to OUT while the rename failed.
    const { root, dir, file } = folder(t);
    fs.writeFileSync(file, 'old');
    const out = outside(t);
    const realRename = fs.renameSync;
    let swapped = true;
    t.mock.method(fs, 'renameSync', function () {
      realRename.call(fs, dir, `${dir}-real`);
      try { fs.symlinkSync(out, dir, 'junction'); } catch (err) { if (!LINK_SKIP.has(err.code)) throw err; swapped = false; }
      throw Object.assign(new Error('held open'), { code: 'EPERM' });
    });
    if (!swapped) { t.mock.restoreAll(); t.skip('junctions unavailable'); return; }
    assert.throws(() => writeFileContained(root, file, 'new'), /held open/);
    t.mock.restoreAll();
    assert.deepEqual(fs.readdirSync(out), [], 'nothing written through the swapped link');
    // The temp was made in the folder that was moved aside; cleanup now resolves through the link
    // and cannot reach it. A swap mid-write is an attack, and it gains nothing: OUT stays empty.
    assert.equal(fs.readFileSync(path.join(`${dir}-real`, 'f.txt'), 'utf8'), 'old');
  }
  {
    const { root, dir, file } = folder(t);
    fs.writeFileSync(file, 'old');
    t.mock.method(fs, 'renameSync', () => { throw Object.assign(new Error('no space'), { code: 'ENOSPC' }); });
    assert.throws(() => writeFileContained(root, file, 'new'), /no space/);
    t.mock.restoreAll();
    assert.equal(fs.readFileSync(file, 'utf8'), 'old');
    assert.deepEqual(fs.readdirSync(dir), ['f.txt']);
  }
});

test('row 7b: a taken temp name is never removed, and a failing chmod or close leaves no temp', (t) => {
  {
    const { root, dir, file } = folder(t);
    fs.writeFileSync(file, 'old');
    const realOpen = fs.openSync;
    let taken = null;
    t.mock.method(fs, 'openSync', function (p, ...rest) {
      if (typeof p === 'string' && p !== file && taken === null) {
        taken = p;
        fs.writeFileSync(p, 'precious');
        throw Object.assign(new Error('exists'), { code: 'EEXIST' });
      }
      return realOpen.call(this, p, ...rest);
    });
    assert.throws(() => writeFileContained(root, file, 'new'), /exists/);
    t.mock.restoreAll();
    assert.ok(taken, 'a temp path was asked for');
    assert.equal(fs.readFileSync(taken, 'utf8'), 'precious', 'someone else\'s file at the temp name survives');
    assert.equal(fs.readFileSync(file, 'utf8'), 'old');
  }
  for (const method of ['fchmodSync', 'closeSync']) {
    const { root, dir, file } = folder(t);
    fs.writeFileSync(file, 'old');
    const real = fs[method];
    let thrown = false;
    t.mock.method(fs, method, function (...args) {
      if (!thrown) { thrown = true; if (method === 'closeSync') real.apply(fs, args); throw Object.assign(new Error(`${method} failed`), { code: 'EIO' }); }
      return real.apply(this, args);
    });
    assert.throws(() => writeFileContained(root, file, 'new'), new RegExp(`${method} failed`));
    t.mock.restoreAll();
    assert.equal(fs.readFileSync(file, 'utf8'), 'old', `${method}: target kept`);
    assert.deepEqual(fs.readdirSync(dir), ['f.txt'], `${method}: no temp left`);
  }
});

test('row 8 (green guard): a linked target or folder is refused and nothing lands anywhere', (t) => {
  {
    // A link inside the project is refused too (the containment rule), never replaced or followed.
    const { root, dir, file } = folder(t);
    fs.writeFileSync(path.join(dir, 'real.txt'), 'inside');
    if (!linkOrSkip(t, path.join(dir, 'real.txt'), file, 'file')) return;
    assert.equal(writeFileContained(root, file, 'mine'), false);
    assert.equal(fs.readFileSync(path.join(dir, 'real.txt'), 'utf8'), 'inside');
    assert.ok(fs.lstatSync(file).isSymbolicLink(), 'the link is left as it was');
    assert.deepEqual(fs.readdirSync(dir).sort(), ['f.txt', 'real.txt']);
  }
  {
    const { root, dir, file } = folder(t);
    const out = outside(t);
    if (!linkOrSkip(t, path.join(out, 'missing'), file, 'file')) return;
    assert.equal(writeFileContained(root, file, 'mine'), false, 'a dangling link is refused');
    assert.deepEqual(fs.readdirSync(out), []);
    assert.deepEqual(fs.readdirSync(dir), ['f.txt']);
  }
  {
    const { root, dir, file } = folder(t);
    const out = outside(t);
    fs.writeFileSync(path.join(out, 'x'), 'theirs');
    if (!linkOrSkip(t, path.join(out, 'x'), file, 'file')) return;
    assert.equal(writeFileContained(root, file, 'mine'), false);
    assert.equal(fs.readFileSync(path.join(out, 'x'), 'utf8'), 'theirs');
    assert.deepEqual(fs.readdirSync(dir), ['f.txt']);
    assert.deepEqual(fs.readdirSync(out), ['x']);
  }
  {
    const root = makeTempProject(t);
    const out = outside(t);
    if (!linkOrSkip(t, out, path.join(root, 'd'), 'junction')) return;
    assert.equal(writeFileContained(root, path.join(root, 'd', 'f.txt'), 'mine'), false);
    assert.deepEqual(fs.readdirSync(out), []);
  }
});

function tmpFiles(dir) {
  // Any leftover a temp-then-rename write could leave: a `.tmp`/`.part` suffix, or a hidden copy
  // named after a sibling (`.f.txt.<anything>`). Rows 5, 7 and 7b list folders exactly.
  return fs.readdirSync(dir, { recursive: true }).map(String).filter((p) => {
    const base = path.basename(p);
    return /\.(tmp|part)$/.test(base) || /\.(tmp|part)[.-]/.test(base)
      || (base.startsWith('.') && fs.existsSync(path.join(dir, path.dirname(p), base.slice(1).split('.').slice(0, 2).join('.'))));
  });
}

test('row 9 (green guard): init, update, park, unpark and a stamp leave no temp file', (t) => {
  const root = makeTempProject(t);
  assert.equal(runCli(root, ['init', '--tool', 'claude']).status, 0);
  assert.equal(runCli(root, ['update']).status, 0);
  const dir = writeChange(root, 'x', { body: STANDARD_BODY.replace('## Delta: auth', '## Design\n- decision: otp\n\n## Delta: auth') });
  fs.mkdirSync(path.join(dir, 'artifact'));
  fs.writeFileSync(path.join(dir, 'artifact', 'plan.html'), '<p>plan</p>\n');
  assert.equal(runCli(root, ['artifact', 'x', 'plan.html']).status, 0);
  assert.equal(runHook(root, 'journal.mjs', { args: ['park', 'x'], stdin: { reason: 'shelved' } }).status, 0);
  assert.equal(runHook(root, 'journal.mjs', { args: ['unpark', 'x'] }).status, 0);
  assert.deepEqual(tmpFiles(root), []);
});

// ---------- install order ----------

test('row 10: installOrder reads side-effect, dynamic and re-export imports', (t) => {
  const fx = makeTempProject(t);
  fs.writeFileSync(path.join(fx, 'a.mjs'), "import './b.mjs';\n");
  fs.writeFileSync(path.join(fx, 'b.mjs'), 'export const b = 1;\n');
  fs.writeFileSync(path.join(fx, 'c.mjs'), "const m = await import('./d.mjs');\n");
  fs.writeFileSync(path.join(fx, 'd.mjs'), 'export const d = 1;\n');
  fs.writeFileSync(path.join(fx, 'e.mjs'), "export { x } from './f.mjs';\n");
  fs.writeFileSync(path.join(fx, 'f.mjs'), 'export const x = 1;\n');
  const order = cli.installOrder(fx);
  for (const [importer, target] of [['a.mjs', 'b.mjs'], ['c.mjs', 'd.mjs'], ['e.mjs', 'f.mjs']]) {
    assert.ok(order.indexOf(target) < order.indexOf(importer), `${target} before ${importer}: ${order.join(', ')}`);
  }
});

// ---------- the Delta placeholder ----------

function staged(t, cap) {
  const root = makeTempProject(t);
  assert.equal(runCli(root, ['init', '--tool', 'claude']).status, 0);
  const dir = writeChange(root, 'x', { status: 'verified', body: STANDARD_BODY.replace('## Delta: auth', `## Delta: ${cap}`) });
  writeContractTests(dir);
  return root;
}

test('row 11: an unedited template placeholder is named as such by validate and archive', (t) => {
  const root = staged(t, '<capability>');
  const val = runCli(root, ['validate', 'x']);
  assert.notEqual(val.status, 0);
  assert.match(val.stdout + val.stderr, /template placeholder/);
  assert.match(val.stdout + val.stderr, /capability's name/);
  const res = runCli(root, ['archive', 'x']);
  assert.notEqual(res.status, 0);
  assert.match(res.stdout + res.stderr, /template placeholder/);
  assert.deepEqual(fs.readdirSync(path.join(root, 'sdlc', 'specs')).filter((n) => n !== '.gitkeep'), []);
});

test('row 11b: any `<…>` capability is the placeholder, and none is ever accepted', (t) => {
  for (const cap of ['<name>', '<a b>', '<>', '<../x>']) {
    const root = staged(t, cap);
    const val = runCli(root, ['validate', 'x']);
    assert.notEqual(val.status, 0, `${cap}: refused`);
    assert.match(val.stdout + val.stderr, /template placeholder/, cap);
  }
});

test('row 12 (green guard): a path capability still gets the generic refusal', (t) => {
  const root = staged(t, '../x');
  const val = runCli(root, ['validate', 'x']);
  assert.match(val.stdout + val.stderr, /not a capability name/);
  assert.doesNotMatch(val.stdout + val.stderr, /template placeholder/);
});

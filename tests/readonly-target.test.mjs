// Contract rows of sdlc/changes/readonly-target/contract/tests.md (row 3 is security-regressions
// "change-artifacts row 10"): a contained write never replaces a file the process may not write —
// on POSIX a rename would, since it needs only the folder's permission — and `update` keeps such a
// file with a warning instead of aborting part way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli } from './helpers.mjs';
import { writeFileContained } from '../lib/safe-path.mjs';

// Root may write any file on POSIX, before this change and after it: out of scope (contract).
const isRoot = () => process.getuid?.() === 0;

// Permissions are restored inside the test body: the temp project's own cleanup runs first and
// would fail on a read-only entry.
function withReadonly(target, folderMode, body) {
  try {
    return body();
  } finally {
    fs.chmodSync(target, folderMode);
  }
}

test('row 1: a read-only file is refused before any temp is made, and stays as it was', (t) => {
  if (isRoot()) { t.skip('root may write a read-only file'); return; }
  const root = makeTempProject(t);
  const dir = path.join(root, 'd');
  fs.mkdirSync(dir);
  const file = path.join(dir, 'f.txt');
  fs.writeFileSync(file, 'old');
  fs.chmodSync(file, 0o444);
  withReadonly(file, 0o644, () => {
    const opened = [];
    const renamed = [];
    const realOpen = fs.openSync;
    const realRename = fs.renameSync;
    t.mock.method(fs, 'openSync', function (p, ...rest) { opened.push(p); return realOpen.call(this, p, ...rest); });
    t.mock.method(fs, 'renameSync', function (...args) { renamed.push(args); return realRename.apply(this, args); });
    assert.throws(() => writeFileContained(root, file, 'new'), (err) => ['EACCES', 'EPERM'].includes(err.code));
    t.mock.restoreAll();
    // Platform-independent: on Windows a reverted fix still ends refused (rename EPERM, then the
    // in-place open EACCES), so the end state alone proves nothing there. No temp, no rename.
    assert.deepEqual(opened, [], 'nothing was opened — no temp file was made');
    assert.deepEqual(renamed, [], 'no rename was attempted');
    assert.equal(fs.readFileSync(file, 'utf8'), 'old');
    assert.throws(() => fs.accessSync(file, fs.constants.W_OK), 'still read-only');
    assert.deepEqual(fs.readdirSync(dir), ['f.txt']);
  });
});

test('row 2: the same file made writable again is written (control)', (t) => {
  const root = makeTempProject(t);
  const file = path.join(root, 'f.txt');
  fs.writeFileSync(file, 'old');
  fs.chmodSync(file, 0o444);
  fs.chmodSync(file, 0o644);
  assert.equal(writeFileContained(root, file, 'new'), true);
  assert.equal(fs.readFileSync(file, 'utf8'), 'new');
});

test('row 4: a new path is written — the check applies only to an existing target', (t) => {
  const root = makeTempProject(t);
  const file = path.join(root, 'fresh.txt');
  assert.equal(writeFileContained(root, file, 'x'), true);
  assert.equal(fs.readFileSync(file, 'utf8'), 'x');
});

test('row 5: a writable file in a folder the process may not write is still written, in place', (t) => {
  if (process.platform === 'win32') { t.skip('a folder mode does not restrict creating files on Windows'); return; }
  if (isRoot()) { t.skip('root may create files in any folder'); return; }
  const root = makeTempProject(t);
  const dir = path.join(root, 'locked');
  fs.mkdirSync(dir);
  const file = path.join(dir, 'f.txt');
  fs.writeFileSync(file, 'old');
  fs.chmodSync(dir, 0o555);
  withReadonly(dir, 0o755, () => {
    assert.equal(writeFileContained(root, file, 'new'), true);
    assert.equal(fs.readFileSync(file, 'utf8'), 'new');
    assert.deepEqual(fs.readdirSync(dir), ['f.txt']);
    // A new file there cannot be written either way: it still fails.
    assert.throws(() => writeFileContained(root, path.join(dir, 'g.txt'), 'x'), (err) => ['EACCES', 'EPERM'].includes(err.code));
  });
});

test('row 6: update keeps a read-only file it would refresh, warns once, and still writes the manifest', (t) => {
  if (isRoot()) { t.skip('root may write a read-only file'); return; }
  const root = makeTempProject(t);
  assert.equal(runCli(root, ['init', '--tool', 'claude']).status, 0);
  const rel = 'sdlc/.playbook/next.md';
  const file = path.join(root, rel);
  const manifestPath = path.join(root, 'sdlc/.state/manifest');
  // An older payload, recorded as ours: update's refresh branch would rewrite it.
  const old = '# old next\n';
  const oldHash = crypto.createHash('sha256').update(old).digest('hex');
  fs.writeFileSync(file, old);
  const manifest = fs.readFileSync(manifestPath, 'utf8').split('\n')
    .map((l) => (l.endsWith(`  ${rel}`) ? `${oldHash}  ${rel}` : l)).join('\n');
  fs.writeFileSync(manifestPath, manifest);
  // Another file, also older and ours, that update must still refresh after the refused one.
  const other = 'sdlc/.playbook/verify.md';
  const otherOld = '# old verify\n';
  fs.writeFileSync(path.join(root, other), otherOld);
  const otherHash = crypto.createHash('sha256').update(otherOld).digest('hex');
  fs.writeFileSync(manifestPath, fs.readFileSync(manifestPath, 'utf8').split('\n')
    .map((l) => (l.endsWith(`  ${other}`) ? `${otherHash}  ${other}` : l)).join('\n'));
  fs.chmodSync(file, 0o444);
  withReadonly(file, 0o644, () => {
    const res = runCli(root, ['update']);
    assert.equal(res.status, 0, res.stderr + res.stdout);
    assert.match(res.stdout + res.stderr, /kept \(not writable, not written\): sdlc\/\.playbook\/next\.md/);
    assert.equal(fs.readFileSync(file, 'utf8'), old, 'the read-only file is untouched');
    assert.notEqual(fs.readFileSync(path.join(root, other), 'utf8'), otherOld, 'the run went on and refreshed the next file');
    const after = fs.readFileSync(manifestPath, 'utf8');
    assert.ok(after.includes(`${oldHash}  ${rel}`), 'its recorded ownership is kept');
    assert.ok(!after.includes(`${otherHash}  ${other}`), 'the manifest was written with the refreshed hash');
  });
});

// Every other write update makes — .gitignore, settings.json, version.json, config.yaml (--tool),
// a stale file prune would remove — kept with one warning each, and the run still finishes with
// the manifest written. Then the manifest itself read-only: said plainly, exit still 0.
test('row 7: every update write site keeps a read-only target, warns, and the run finishes', (t) => {
  if (isRoot()) { t.skip('root may write a read-only file'); return; }
  const root = makeTempProject(t);
  assert.equal(runCli(root, ['init', '--tool', 'claude']).status, 0);
  const at = (rel) => path.join(root, rel);
  const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
  const manifestPath = at('sdlc/.state/manifest');

  // .gitignore without the entry, so update must append it.
  fs.writeFileSync(at('.gitignore'), 'node_modules/\n');
  // version.json from an older version, so update must rewrite it.
  fs.writeFileSync(at('sdlc/.hooks/version.json'), '{"version":"0.0.1"}\n');
  // settings.json without our hooks, so the merge must rewrite it.
  fs.writeFileSync(at('.claude/settings.json'), '{}\n');
  // A stale file prune would remove: recorded as ours, matching on disk, gone from the payload.
  // POSIX lets anyone unlink a read-only file in a writable folder, so there its folder is locked.
  const staleDir = at('sdlc/.playbook/gone');
  fs.mkdirSync(staleDir);
  fs.writeFileSync(path.join(staleDir, 'old.md'), 'stale\n');
  fs.appendFileSync(manifestPath, `${sha('stale\n')}  sdlc/.playbook/gone/old.md\n`);

  const locks = [
    [at('.gitignore'), 0o444, 0o644],
    [at('sdlc/.hooks/version.json'), 0o444, 0o644],
    [at('.claude/settings.json'), 0o444, 0o644],
    [at('sdlc/config.yaml'), 0o444, 0o644],
  ];
  // The prune leg runs on POSIX only: Node's unlink on Windows clears the read-only attribute and
  // removes the file anyway, so no refusal can be staged there.
  const pruneLeg = process.platform !== 'win32';
  if (pruneLeg) locks.push([staleDir, 0o555, 0o755]);
  for (const [p, mode] of locks) fs.chmodSync(p, mode);
  let res;
  try {
    res = runCli(root, ['update', '--tool', 'claude']);
  } finally {
    for (const [p, , back] of locks) fs.chmodSync(p, back);
  }
  const out = res.stdout + res.stderr;
  assert.equal(res.status, 0, out);
  for (const rel of ['.gitignore', 'sdlc/.hooks/version.json', '.claude/settings.json', 'sdlc/config.yaml']) {
    assert.ok(out.includes(`kept (not writable, not written): ${rel}`), `${rel} reported: ${out}`);
  }
  assert.equal(fs.readFileSync(at('.gitignore'), 'utf8'), 'node_modules/\n', '.gitignore untouched');
  if (pruneLeg) {
    assert.match(out, /prune kept \(not writable\): sdlc\/\.playbook\/gone\/old\.md/);
    assert.ok(fs.existsSync(path.join(staleDir, 'old.md')), 'the stale file is still there');
    assert.match(fs.readFileSync(manifestPath, 'utf8'), /  sdlc\/\.playbook\/gone\/old\.md/, 'its record is kept for a later prune');
  }

  // The manifest itself read-only: the run still ends 0 and says the record was not saved.
  fs.chmodSync(manifestPath, 0o444);
  try {
    res = runCli(root, ['update']);
  } finally {
    fs.chmodSync(manifestPath, 0o644);
  }
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout + res.stderr, /manifest NOT saved \(not writable\): sdlc\/\.state\/manifest/);
});

test('row 8: a scaffold folder that cannot be created is kept with a warning, and update finishes', (t) => {
  if (process.platform === 'win32') { t.skip('a folder mode does not restrict creating folders on Windows'); return; }
  if (isRoot()) { t.skip('root may create folders anywhere'); return; }
  const root = makeTempProject(t);
  assert.equal(runCli(root, ['init', '--tool', 'claude']).status, 0);
  const sdlc = path.join(root, 'sdlc');
  fs.rmSync(path.join(sdlc, 'evals'), { recursive: true, force: true });
  fs.chmodSync(sdlc, 0o555);
  let res;
  try {
    res = runCli(root, ['update']);
  } finally {
    fs.chmodSync(sdlc, 0o755);
  }
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout + res.stderr, /kept \(not writable, not written\): sdlc\/evals/);
  assert.ok(!fs.existsSync(path.join(sdlc, 'evals')));
});

test('row 9: init keeps a read-only file it would write, warns, and finishes with a manifest', (t) => {
  if (isRoot()) { t.skip('root may write a read-only file'); return; }
  const root = makeTempProject(t);
  const gi = path.join(root, '.gitignore');
  fs.writeFileSync(gi, 'node_modules/\n');
  fs.chmodSync(gi, 0o444);
  let res;
  try {
    res = runCli(root, ['init', '--tool', 'claude']);
  } finally {
    fs.chmodSync(gi, 0o644);
  }
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout + res.stderr, /kept \(not writable, not written\): \.gitignore/);
  assert.equal(fs.readFileSync(gi, 'utf8'), 'node_modules/\n');
  assert.ok(fs.existsSync(path.join(root, 'sdlc/.state/manifest')), 'init still wrote its manifest');
});

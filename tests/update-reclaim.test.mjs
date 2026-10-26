import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { makeTempProject, runCli, PKG_ROOT } from './helpers.mjs';
import { parseManifest } from '../lib/manifest.mjs';


// Contract: sdlc/changes/update-reclaim/contract/tests.md (rows 1-17, 13b and 21; rows 18-20 live in security-regressions).
const P = 'sdlc/.hooks/journal.mjs';
const Q = 'sdlc/.playbook/new.md';
const X = 'console.log("journal from an older release");\n';
const Y = 'console.log("journal edited by the user");\n';
const RECLAIM_PREFIX = 'reclaimed (unmodified, shipped by an older version)';
const RECLAIM = `${RECLAIM_PREFIX}: ${P}`;
const KEPT = `kept (user-modified): ${P}`;

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const lf = (s) => s.replace(/\r\n/g, '\n');

function initProject(t) {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res.status, 0, res.stderr);
  return dir;
}

// What a fresh `init --tool claude` installs at P.
function freshJournal(t) {
  return fs.readFileSync(path.join(initProject(t), P), 'utf8');
}

function writeLedger(t, paths) {
  const dir = makeTempProject(t);
  const file = path.join(dir, 'ledger.json');
  fs.writeFileSync(file, JSON.stringify({ versions: ['0.19.0'], paths }));
  return { WARNYIN_SDLC_SHIPPED_HASHES: file, NO_UPDATE_NOTIFIER: '1' };
}

function readManifest(dir) {
  return parseManifest(fs.readFileSync(path.join(dir, 'sdlc/.state/manifest'), 'utf8'));
}

function editManifest(dir, edit) {
  const manifest = readManifest(dir);
  edit(manifest);
  fs.writeFileSync(
    path.join(dir, 'sdlc/.state/manifest'),
    [...manifest.entries()].map(([p, h]) => `${h}  ${p}`).join('\n') + '\n',
  );
}

function readP(dir) {
  return fs.readFileSync(path.join(dir, P), 'utf8');
}

test('row 1: update reclaims an untouched journal.mjs that an older release shipped', (t) => {
  const fresh = freshJournal(t);
  const dir = initProject(t);
  const env = writeLedger(t, { [P]: [sha(X)] });
  fs.writeFileSync(path.join(dir, P), X);
  editManifest(dir, (m) => m.delete(P));

  const res = runCli(dir, ['update'], { env });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(readP(dir), fresh, 'P equals what a fresh init installs at P');
  assert.ok(res.stderr.includes(RECLAIM), `stderr has the reclaim line:\n${res.stderr}`);
  assert.equal(readManifest(dir).get(P), sha(lf(fresh)), 'manifest records P with the current hash');
});

test('row 2: update reclaims a CRLF copy of an older release journal.mjs', (t) => {
  const fresh = freshJournal(t);
  const dir = initProject(t);
  const env = writeLedger(t, { [P]: [sha(X)] });
  fs.writeFileSync(path.join(dir, P), X.replace(/\n/g, '\r\n'));
  editManifest(dir, (m) => m.delete(P));

  const res = runCli(dir, ['update'], { env });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(readP(dir), fresh, 'P equals what a fresh init installs at P');
  assert.ok(!readP(dir).includes('\r\n'), 'the reclaimed file is written with LF');
  assert.ok(res.stderr.includes(RECLAIM), `stderr has the reclaim line:\n${res.stderr}`);
});

test('row 3: update keeps a user-edited journal.mjs that no release shipped', (t) => {
  // Y matches nothing; X without its trailing newline differs from X by one byte.
  for (const edited of [Y, X.slice(0, -1)]) {
    const dir = initProject(t);
    const env = writeLedger(t, { [P]: [sha(X)] });
    fs.writeFileSync(path.join(dir, P), edited);
    editManifest(dir, (m) => m.delete(P));

    const res = runCli(dir, ['update'], { env });
    assert.equal(res.status, 0, res.stderr);
    assert.equal(readP(dir), edited, 'P is byte-for-byte unchanged');
    assert.ok(res.stderr.includes(KEPT), `stderr has the kept line:\n${res.stderr}`);
    assert.ok(!res.stderr.includes(RECLAIM_PREFIX), 'no reclaim line');
    assert.equal(readManifest(dir).has(P), false, 'manifest has no P');
  }
});

test('row 4: a second update after the reclaim reports nothing for journal.mjs', (t) => {
  const dir = initProject(t);
  const env = writeLedger(t, { [P]: [sha(X)] });
  fs.writeFileSync(path.join(dir, P), X);
  editManifest(dir, (m) => m.delete(P));

  const first = runCli(dir, ['update'], { env });
  assert.equal(first.status, 0, first.stderr);

  const second = runCli(dir, ['update'], { env });
  assert.equal(second.status, 0, second.stderr);
  assert.ok(!second.stderr.includes(RECLAIM), 'no reclaim line on the second update');
  assert.ok(!second.stderr.includes(KEPT), 'no kept line for P on the second update');
  assert.equal(readManifest(dir).get(P), sha(lf(readP(dir))), 'the manifest owns P with its current hash');

  // Owned again in full: a later user edit is the user's, as for any owned file.
  fs.writeFileSync(path.join(dir, P), Y);
  const third = runCli(dir, ['update'], { env });
  assert.equal(third.status, 0, third.stderr);
  assert.equal(readP(dir), Y, 'a user edit after the reclaim is kept');
  assert.ok(third.stderr.includes(KEPT), `the edit reads as user-modified:\n${third.stderr}`);
});

test('row 5: a hash listed only under another path does not reclaim P', (t) => {
  const dir = initProject(t);
  const env = writeLedger(t, { [Q]: [sha(X)] });
  fs.writeFileSync(path.join(dir, P), X);
  editManifest(dir, (m) => m.delete(P));

  const res = runCli(dir, ['update'], { env });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(readP(dir), X, 'P is left as it was');
  assert.ok(res.stderr.includes(KEPT), `stderr has the kept line:\n${res.stderr}`);
  assert.ok(!res.stderr.includes(RECLAIM_PREFIX), 'no reclaim line');
});

test('row 6: a manifest-tracked P with a matching hash is refreshed, not reclaimed', (t) => {
  const fresh = freshJournal(t);
  const dir = initProject(t);
  const env = writeLedger(t, { [P]: [sha(X)] });
  fs.writeFileSync(path.join(dir, P), X);
  editManifest(dir, (m) => m.set(P, sha(X)));

  const res = runCli(dir, ['update'], { env });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(readP(dir), fresh, 'P refreshed to what a fresh init installs');
  assert.ok(!res.stderr.includes(RECLAIM_PREFIX), 'no reclaim line');

  // The manifest records some other hash W, and P holds a shipped version: reclaimed.
  const other = initProject(t);
  fs.writeFileSync(path.join(other, P), X);
  editManifest(other, (m) => m.set(P, sha('content W the manifest remembers\n')));
  const res2 = runCli(other, ['update'], { env });
  assert.equal(res2.status, 0, res2.stderr);
  assert.equal(readP(other), fresh, 'P reclaimed despite a stale manifest hash');
  assert.ok(res2.stderr.includes(RECLAIM), `stderr has the reclaim line:\n${res2.stderr}`);
});

test('row 7: bin/shipped-hashes.json has the ledger shape and lists this version and every released one', () => {
  const ledger = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'bin', 'shipped-hashes.json'), 'utf8'));
  assert.ok(ledger && typeof ledger === 'object' && !Array.isArray(ledger), 'ledger is an object');
  assert.ok(Array.isArray(ledger.versions) && ledger.versions.every((v) => typeof v === 'string'), 'versions is a string array');
  assert.ok(ledger.paths && typeof ledger.paths === 'object' && !Array.isArray(ledger.paths), 'paths is an object');
  for (const [rel, hashes] of Object.entries(ledger.paths)) {
    assert.ok(
      Array.isArray(hashes) && hashes.every((h) => /^[0-9a-f]{64}$/.test(h)),
      `paths[${rel}] is a list of sha256 hex strings`,
    );
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'));
  assert.ok(ledger.versions.includes(pkg.version), `versions includes ${pkg.version}`);
  // CI has no tags, so the release headings stand in for "every released version".
  const released = fs.readFileSync(path.join(PKG_ROOT, 'CHANGELOG.md'), 'utf8')
    .split(/\r?\n/).map((l) => l.match(/^## (\d+\.\d+\.\d+) \(/)?.[1]).filter(Boolean);
  assert.ok(released.length > 0, 'CHANGELOG has release headings');
  for (const v of released) assert.ok(ledger.versions.includes(v), `versions includes released ${v}`);
});

test('row 8: the ledger keeps real history for journal.mjs (0.19.0 and at least 2 hashes)', () => {
  const ledger = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'bin', 'shipped-hashes.json'), 'utf8'));
  assert.ok(ledger.versions.includes('0.19.0'), 'versions includes 0.19.0');
  assert.ok(new Set(ledger.paths[P] ?? []).size >= 2, `${P} lists at least 2 distinct hashes`);
  // Seeds are the user's from birth: a ledger entry for one would let update overwrite it.
  for (const seed of ['sdlc/config.yaml', 'sdlc/context/constitution.md', 'sdlc/harness.md']) {
    assert.ok(!Object.hasOwn(ledger.paths, seed), `the ledger never lists the seed ${seed}`);
  }
});

test('row 9: package.json wires the shipped-hashes script and ships bin', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'));
  assert.ok(
    typeof pkg.scripts?.['shipped-hashes'] === 'string' &&
      pkg.scripts['shipped-hashes'].includes('.github/scripts/shipped-hashes.mjs'),
    'scripts["shipped-hashes"] runs .github/scripts/shipped-hashes.mjs',
  );
  assert.ok(Array.isArray(pkg.files) && pkg.files.includes('bin'), 'files includes bin');
});

test('row 10: README ## Releasing names npm run shipped-hashes', () => {
  const lines = fs.readFileSync(path.join(PKG_ROOT, 'README.md'), 'utf8').split(/\r?\n/);
  const start = lines.findIndex((l) => l.trimEnd() === '## Releasing');
  assert.notEqual(start, -1, 'README has a ## Releasing heading');
  let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  if (end === -1) end = lines.length;
  const section = lines.slice(start, end).join('\n');
  assert.ok(section.includes('npm run shipped-hashes'), 'the Releasing section names npm run shipped-hashes');
});

test('row 11: CHANGELOG entry for update reclaims names reclaimed and #11', () => {
  const lines = fs.readFileSync(path.join(PKG_ROOT, 'CHANGELOG.md'), 'utf8').split(/\r?\n/);
  const marker = '**update reclaims payload files it lost track of**';
  const at = lines.findIndex((l) => l.includes(marker));
  assert.notEqual(at, -1, 'CHANGELOG has the entry');
  const heading = lines.slice(0, at).findLastIndex((l) => l.startsWith('## '));
  assert.notEqual(heading, -1, 'the entry sits under a ## section');
  let stop = at + 1;
  while (stop < lines.length && /^\s+\S/.test(lines[stop])) stop++;
  const entry = lines.slice(at, stop).join('\n');
  assert.ok(entry.includes('reclaimed'), 'entry contains reclaimed');
  assert.ok(entry.includes('#11'), 'entry contains #11');
});

test('row 12: a missing or malformed ledger reclaims nothing, warns, and update still finishes', (t) => {
  const base = makeTempProject(t);
  const bad = {
    absent: path.join(base, 'no-such-ledger.json'),
    notJson: path.join(base, 'not-json.json'),
    badShape: path.join(base, 'bad-shape.json'),
  };
  fs.writeFileSync(bad.notJson, '{ this is not json');
  fs.writeFileSync(bad.badShape, JSON.stringify({ versions: ['0.19.0'], paths: [sha(X)] }));
  bad.badEntry = path.join(base, 'bad-entry.json');
  fs.writeFileSync(bad.badEntry, JSON.stringify({ versions: ['0.19.0'], paths: { [P]: [sha(X), 'not-a-hash'] } }));
  for (const [kind, file] of Object.entries(bad)) {
    const dir = initProject(t);
    fs.writeFileSync(path.join(dir, P), X);
    editManifest(dir, (m) => m.delete(P));
    fs.rmSync(path.join(dir, 'sdlc/.state/manifest'), { force: true });
    const res = runCli(dir, ['update'], { env: { WARNYIN_SDLC_SHIPPED_HASHES: file, NO_UPDATE_NOTIFIER: '1' } });
    assert.equal(res.status, 0, `${kind}: ${res.stderr}`);
    assert.equal(readP(dir), X, `${kind}: P is kept`);
    assert.ok(res.stderr.includes('reclaim skipped:'), `${kind}: stderr warns:\n${res.stderr}`);
    assert.ok(!res.stderr.includes(RECLAIM_PREFIX), `${kind}: no reclaim line`);
    assert.ok(fs.existsSync(path.join(dir, 'sdlc/.state/manifest')), `${kind}: the manifest is written`);
  }
});

test('row 13: a symlinked P is never reclaimed and its target is untouched', (t) => {
  const dir = initProject(t);
  const env = writeLedger(t, { [P]: [sha(X)] });
  const target = path.join(dir, 'outside-target.mjs');
  fs.writeFileSync(target, X);
  fs.rmSync(path.join(dir, P));
  try {
    fs.symlinkSync(target, path.join(dir, P), 'file');
  } catch (err) {
    t.skip(`symlinks unavailable here (${err.code})`);
    return;
  }
  editManifest(dir, (m) => m.delete(P));
  const res = runCli(dir, ['update'], { env });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(fs.readFileSync(target, 'utf8'), X, 'the symlink target still holds X');
  assert.ok(!res.stderr.includes(RECLAIM_PREFIX), 'no reclaim line');
});

test('row 13b: a P under a linked sdlc/.hooks folder is never reclaimed and the outside file is untouched', (t) => {
  const dir = initProject(t);
  const env = writeLedger(t, { [P]: [sha(X)] });
  const outside = makeTempProject(t);
  fs.writeFileSync(path.join(outside, 'journal.mjs'), X);
  fs.rmSync(path.join(dir, 'sdlc/.hooks'), { recursive: true, force: true });
  try {
    fs.symlinkSync(outside, path.join(dir, 'sdlc/.hooks'), 'junction');
  } catch (err) {
    t.skip(`symlinks unavailable here (${err.code})`);
    return;
  }
  editManifest(dir, (m) => m.delete(P));
  const res = runCli(dir, ['update'], { env });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(fs.readFileSync(path.join(outside, 'journal.mjs'), 'utf8'), X, 'the outside file still holds X');
  assert.ok(!res.stderr.includes(RECLAIM_PREFIX), 'no reclaim line');
});

test('row 14: a ledger path the current payload does not ship is left alone', (t) => {
  const dir = initProject(t);
  const gone = 'sdlc/.playbook/retired-stage.md';
  fs.writeFileSync(path.join(dir, gone), X);
  const env = writeLedger(t, { [gone]: [sha(X)] });
  const res = runCli(dir, ['update'], { env });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(fs.readFileSync(path.join(dir, gone), 'utf8'), X, 'untouched');
  assert.ok(!res.stderr.includes(RECLAIM_PREFIX), 'no reclaim line');
});

test('row 15: init never reclaims', (t) => {
  const dir = initProject(t);
  const env = writeLedger(t, { [P]: [sha(X)] });
  fs.writeFileSync(path.join(dir, P), X);
  editManifest(dir, (m) => m.delete(P));
  const res = runCli(dir, ['init', '--tool', 'claude'], { env });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(readP(dir), X, 'P unchanged by init');
  assert.ok(!res.stderr.includes(RECLAIM_PREFIX), 'no reclaim line');
});

test('row 16: the issue workaround still works — a deleted P is written back, not reclaimed', (t) => {
  const fresh = freshJournal(t);
  const dir = initProject(t);
  const env = writeLedger(t, { [P]: [sha(X)] });
  fs.rmSync(path.join(dir, P));
  editManifest(dir, (m) => m.delete(P));
  const res = runCli(dir, ['update'], { env });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(readP(dir), fresh, 'P written back');
  assert.ok(!res.stderr.includes(RECLAIM_PREFIX), 'no reclaim line');
});

test('row 17: pack-verify names the ledger, and update counts reclaimed files in its summary', (t) => {
  const ci = fs.readFileSync(path.join(PKG_ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
  assert.ok(ci.includes('"bin/shipped-hashes.json"'), 'ci.yml pack-verify names bin/shipped-hashes.json');
  const dir = initProject(t);
  const env = writeLedger(t, { [P]: [sha(X)] });
  fs.writeFileSync(path.join(dir, P), X);
  editManifest(dir, (m) => m.delete(P));
  const res = runCli(dir, ['update'], { env });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout + res.stderr, /\b1 reclaimed\b/, 'the summary counts the reclaimed file');
});

// The ledger must cover what this version installs. CI cannot check that on every push (payload
// changes between releases), so the release job does, before publish, with the generator's --check.
test('row 21: the release job checks the ledger covers this version before publish, and --check fails on a gap', (t) => {
  const release = fs.readFileSync(path.join(PKG_ROOT, '.github', 'workflows', 'release.yml'), 'utf8');
  const check = release.indexOf('node .github/scripts/shipped-hashes.mjs --check');
  const publish = release.indexOf('npm publish --provenance');
  assert.ok(check > -1, 'release.yml runs the ledger check');
  assert.ok(check < publish, 'the ledger check runs before publish');

  const gap = writeLedger(t, { [P]: [sha(X)] });
  const res = spawnSync(process.execPath, [path.join(PKG_ROOT, '.github', 'scripts', 'shipped-hashes.mjs'), '--check'], {
    cwd: PKG_ROOT, encoding: 'utf8', env: { ...process.env, ...gap },
  });
  assert.equal(res.status, 1, `--check must fail on a ledger missing this version's files:\n${res.stdout}${res.stderr}`);
  assert.match(res.stderr, /not in the ledger/, 'it names what is missing');
});

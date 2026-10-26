// Contract rows of sdlc/changes/followups-finish/contract/tests.md: archive reads and writes only
// inside the project, install order follows the payload's own imports, release-check names the
// CHANGELOG section, change ids and change-file text are printed escaped, and the tier cap guards
// itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  makeTempProject, runCli, runHook, writeChange, writeContractTests, writeTranscript, STANDARD_BODY, PKG_ROOT,
} from './helpers.mjs';
import { formatIssues } from '../lib/validate.mjs';
import { capForChange, CAPS } from '../lib/caps.mjs';
import * as cli from '../bin/cli.mjs';

const BS = String.fromCharCode(92);
// C1 CSI and right-to-left override: both reach a terminal raw today, and NTFS accepts both in a name.
const BAD = 'x' + String.fromCodePoint(0x9b, 0x202e) + 'y';
const HAZARDS = ['9b', '202e'];
const LINK_SKIP = new Set(['EPERM', 'EACCES', 'ENOSYS']);
const CHECK = path.join(PKG_ROOT, '.github/scripts/release-check.mjs');

function project(t) {
  const root = makeTempProject(t);
  assert.equal(runCli(root, ['init', '--tool', 'claude']).status, 0);
  return root;
}

function outside(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsdlc-out-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
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

// Replaces a project folder with a junction to `target`, carrying what was in it.
function relink(t, root, rel, target) {
  const p = path.join(root, rel);
  if (fs.existsSync(p)) {
    fs.cpSync(p, target, { recursive: true });
    fs.rmSync(p, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  return linkOrSkip(t, target, p, 'junction');
}

function staged(t, { evals = false, body = STANDARD_BODY } = {}) {
  const root = project(t);
  const changeDir = writeChange(root, 'add-2fa', { status: 'verified', body });
  writeContractTests(changeDir);
  if (evals) fs.writeFileSync(path.join(changeDir, 'contract', 'evals.md'), '# Eval contract — x\n\n## Rubric\n- q: ok?\n');
  return { root, changeDir };
}

// Files with their text and folders as `<dir>`: a refused ship must create neither.
function tree(dir) {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    const p = path.join(e.parentPath ?? e.path, e.name);
    out[path.relative(dir, p)] = e.isFile() ? fs.readFileSync(p, 'utf8') : '<dir>';
  }
  return out;
}

function assertEscaped(text, where) {
  for (const h of HAZARDS) assert.ok(text.includes(`${BS}u{${h}}`), `${where} shows U+${h} escaped: ${JSON.stringify(text)}`);
  assert.ok(!/[\p{Cc}\p{Cf}]/u.test(text.replace(/\r?\n/g, '')), `${where} carries no raw control or format character: ${JSON.stringify(text)}`);
}

// A refused ship: non-zero, names the path, nothing merged or moved, nothing new outside.
function assertRefused(res, named, { root, changeDir, out, outBefore, specsBefore }) {
  assert.notEqual(res.status, 0, res.stdout);
  assert.ok(res.stderr.includes(named), `names ${named}: ${res.stderr}`);
  assert.match(res.stderr, /nothing was merged/);
  if (out) assert.deepEqual(tree(out), outBefore ?? {}, 'nothing written outside the project');
  assert.match(fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8'), /status: verified/, 'change folder in place, unstamped');
  if (specsBefore) assert.deepEqual(tree(path.join(root, 'sdlc/specs')), specsBefore, 'specs unchanged');
}

// ---------- archive ----------

test('row 1: a linked sdlc/specs refuses the ship and writes nothing outside', (t) => {
  const { root, changeDir } = staged(t);
  const out = outside(t);
  if (!relink(t, root, 'sdlc/specs', out)) return;
  assertRefused(runCli(root, ['archive', 'add-2fa']), 'sdlc/specs', { root, changeDir, out, outBefore: tree(out) });
});

test('row 1b: a linked capability folder, and a dangling spec.md, refuse the ship', (t) => {
  {
    const { root, changeDir } = staged(t);
    const out = outside(t);
    if (!linkOrSkip(t, out, path.join(root, 'sdlc/specs/auth'), 'junction')) return;
    assertRefused(runCli(root, ['archive', 'add-2fa']), 'sdlc/specs/auth', { root, changeDir, out });
  }
  {
    const { root, changeDir } = staged(t);
    const out = outside(t);
    fs.mkdirSync(path.join(root, 'sdlc/specs/auth'), { recursive: true });
    if (!linkOrSkip(t, path.join(out, 'missing.md'), path.join(root, 'sdlc/specs/auth/spec.md'), 'file')) return;
    assertRefused(runCli(root, ['archive', 'add-2fa']), 'sdlc/specs/auth/spec.md', { root, changeDir, out });
  }
});

test('row 1c: a Delta capability that is not one plain segment is refused by validate and archive', (t) => {
  for (const cap of ['../../x', 'a/b', 'a' + BS + 'b', '..', '.hidden', 'C:x', 'a b']) {
    const body = STANDARD_BODY.replace('## Delta: auth', `## Delta: ${cap}`);
    const { root, changeDir } = staged(t, { body });
    const before = tree(root);
    const val = runCli(root, ['validate', 'add-2fa']);
    assert.notEqual(val.status, 0, `${cap}: validate refuses`);
    assert.match(val.stdout + val.stderr, /not a capability name/, cap);
    const res = runCli(root, ['archive', 'add-2fa']);
    assert.notEqual(res.status, 0, `${cap}: archive refuses`);
    assert.match(fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8'), /status: verified/);
    assert.deepEqual(Object.keys(tree(root)).sort(), Object.keys(before).sort(), `${cap}: nothing created anywhere in the project`);
  }
});

test('row 2: a linked changes/archive refuses before any spec is merged', (t) => {
  const { root, changeDir } = staged(t);
  const out = outside(t);
  const specsBefore = tree(path.join(root, 'sdlc/specs'));
  if (!relink(t, root, 'sdlc/changes/archive', out)) return;
  assertRefused(runCli(root, ['archive', 'add-2fa']), 'sdlc/changes/archive', { root, changeDir, out, outBefore: tree(out), specsBefore });
});

test('row 2b: a dangling changes/archive link creates nothing at its target', (t) => {
  const { root, changeDir } = staged(t);
  const out = outside(t);
  fs.rmSync(path.join(root, 'sdlc/changes/archive'), { recursive: true, force: true });
  if (!linkOrSkip(t, path.join(out, 'gone'), path.join(root, 'sdlc/changes/archive'), 'junction')) return;
  assertRefused(runCli(root, ['archive', 'add-2fa']), 'sdlc/changes/archive', { root, changeDir, out });
  assert.deepEqual(fs.readdirSync(out), [], 'no folder created in OUT');
});

test('row 3: a linked sdlc/evals, and a dangling rubric.md, refuse when the change has evals.md', (t) => {
  {
    const { root, changeDir } = staged(t, { evals: true });
    const out = outside(t);
    const specsBefore = tree(path.join(root, 'sdlc/specs'));
    if (!relink(t, root, 'sdlc/evals', out)) return;
    assertRefused(runCli(root, ['archive', 'add-2fa']), 'sdlc/evals', { root, changeDir, out, outBefore: tree(out), specsBefore });
  }
  {
    const { root, changeDir } = staged(t, { evals: true });
    const out = outside(t);
    fs.mkdirSync(path.join(root, 'sdlc/evals/auth'), { recursive: true });
    if (!linkOrSkip(t, path.join(out, 'r.md'), path.join(root, 'sdlc/evals/auth/rubric.md'), 'file')) return;
    assertRefused(runCli(root, ['archive', 'add-2fa']), 'sdlc/evals/auth/rubric.md', { root, changeDir, out });
  }
});

test('row 4: a linked journal folder, or a linked live journal file, refuses the ship and the append', (t) => {
  {
    const { root, changeDir } = staged(t);
    const out = outside(t);
    const specsBefore = tree(path.join(root, 'sdlc/specs'));
    if (!relink(t, root, 'sdlc/.state/journal', out)) return;
    assertRefused(runCli(root, ['archive', 'add-2fa']), 'sdlc/.state/journal', { root, changeDir, out, outBefore: tree(out), specsBefore });
  }
  {
    const { root, changeDir } = staged(t);
    const out = outside(t);
    const target = path.join(out, 'x.ndjson');
    fs.writeFileSync(target, 'theirs\n');
    fs.mkdirSync(path.join(root, 'sdlc/.state/journal'), { recursive: true });
    fs.rmSync(path.join(root, 'sdlc/.state/journal/add-2fa.ndjson'), { force: true });
    if (!linkOrSkip(t, target, path.join(root, 'sdlc/.state/journal/add-2fa.ndjson'), 'file')) return;
    assertRefused(runCli(root, ['archive', 'add-2fa']), 'sdlc/.state/journal/add-2fa.ndjson', { root, changeDir, out, outBefore: { 'x.ndjson': 'theirs\n' } });
    assert.equal(cli.appendJournal(path.join(root, 'sdlc'), 'add-2fa', { event: 'x' }), false, 'appendJournal refuses the link');
    assert.equal(fs.readFileSync(target, 'utf8'), 'theirs\n');
  }
});

test('row 5: change.md, journal.ndjson or contract/evals.md linked outside are never read into or written', (t) => {
  for (const rel of ['change.md', 'journal.ndjson', 'contract/evals.md']) {
    const { root, changeDir } = staged(t);
    const out = outside(t);
    const specsBefore = tree(path.join(root, 'sdlc/specs'));
    const target = path.join(out, 'secret');
    const own = path.join(changeDir, rel);
    const text = fs.existsSync(own) ? fs.readFileSync(own, 'utf8') : '# Eval contract — SECRET\n';
    fs.writeFileSync(target, text);
    fs.rmSync(own, { force: true });
    if (!linkOrSkip(t, target, own, 'file')) return;
    const res = runCli(root, ['archive', 'add-2fa']);
    assert.notEqual(res.status, 0, `${rel}: ${res.stdout}`);
    assert.ok(res.stderr.includes(`add-2fa/${rel}`), `${rel}: named: ${res.stderr}`);
    assert.match(res.stderr, /nothing was merged/, rel);
    assert.equal(fs.readFileSync(target, 'utf8'), text, `${rel}: the outside file is byte-identical`);
    assert.deepEqual(tree(path.join(root, 'sdlc/specs')), specsBefore, `${rel}: specs unchanged`);
    assert.ok(!fs.existsSync(path.join(root, 'sdlc/evals/auth')), `${rel}: no rubric promoted`);
    assert.ok(fs.existsSync(changeDir), `${rel}: the change folder stays in changes/`);
  }
});

test('row 6: a sdlc/specs link that stays inside the project is refused too — the installer rule', (t) => {
  const { root, changeDir } = staged(t);
  const inside = path.join(root, 'kept-specs');
  fs.mkdirSync(inside);
  if (!relink(t, root, 'sdlc/specs', inside)) return;
  const before = tree(inside);
  assertRefused(runCli(root, ['archive', 'add-2fa']), 'sdlc/specs', { root, changeDir });
  assert.deepEqual(tree(inside), before, 'the linked folder is unchanged');
});

// ---------- install order ----------

function importsOf(file) {
  return [...fs.readFileSync(file, 'utf8').matchAll(/from\s+['"]\.\/([^'"/]+\.mjs)['"]/g)].map((m) => m[1]);
}

function assertImportsFirst(dir, order) {
  const files = order.filter((n) => n.endsWith('.mjs'));
  for (const [i, name] of files.entries()) {
    for (const dep of importsOf(path.join(dir, name))) {
      if (!fs.existsSync(path.join(dir, dep))) continue;
      const at = files.indexOf(dep);
      assert.ok(at !== -1 && at < i, `${name} imports ${dep}, which must come first: ${files.join(', ')}`);
    }
  }
}

test('row 7: installOrder is a permutation that puts every module before the siblings that import it', (t) => {
  assert.equal(typeof cli.installOrder, 'function', 'installOrder is exported from bin/cli.mjs');
  for (const rel of ['lib', 'payload/hooks', 'payload/playbook']) {
    const dir = path.join(PKG_ROOT, rel);
    const order = cli.installOrder(dir);
    assert.deepEqual([...order].sort(), fs.readdirSync(dir).sort(), `${rel}: every entry, once`);
    assertImportsFirst(dir, order);
  }
  const fx = makeTempProject(t);
  fs.writeFileSync(path.join(fx, 'a.mjs'), "import { b } from './b.mjs';\nimport { z } from './gone.mjs';\n");
  fs.writeFileSync(path.join(fx, 'b.mjs'), "import { c } from './c.mjs';\nexport const b = 1;\n");
  fs.writeFileSync(path.join(fx, 'c.mjs'), 'export const c = 1;\n');
  fs.mkdirSync(path.join(fx, 'sub'));
  fs.writeFileSync(path.join(fx, 'notes.md'), '# x\n');
  assert.deepEqual(cli.installOrder(fx), ['c.mjs', 'b.mjs', 'a.mjs', 'notes.md', 'sub'], 'an import of a missing file drops nothing');
  const cy = makeTempProject(t);
  fs.writeFileSync(path.join(cy, 'y.mjs'), "import { x } from './x.mjs';\nexport const y = 1;\n");
  fs.writeFileSync(path.join(cy, 'x.mjs'), "import { y } from './y.mjs';\nexport const x = 1;\n");
  assert.deepEqual(cli.installOrder(cy), ['y.mjs', 'x.mjs'], 'a cycle installs both, deterministically, without throwing');
});

test('row 8: init writes lib before the hooks, each module after its imports; an unchanged update keeps the manifest', async (t) => {
  const root = makeTempProject(t);
  const seen = [];
  const record = (p) => {
    if (typeof p !== 'string') return;
    const rel = path.relative(root, p).split(path.sep).join('/');
    if (rel.startsWith('sdlc/.hooks/') && rel.endsWith('.mjs') && !seen.includes(rel)) seen.push(rel);
  };
  const realOpen = fs.openSync;
  const realWrite = fs.writeFileSync;
  t.mock.method(fs, 'openSync', function (p, ...rest) { record(p); return realOpen.call(this, p, ...rest); });
  t.mock.method(fs, 'writeFileSync', function (p, ...rest) { record(p); return realWrite.call(this, p, ...rest); });
  // A contained write lands by renaming a temp file onto the path (digest-backlog).
  const realRename = fs.renameSync;
  t.mock.method(fs, 'renameSync', function (from, to) { record(to); return realRename.call(this, from, to); });
  t.mock.method(console, 'log', () => {});
  await cli.main(['init', '--tool', 'claude'], root);
  t.mock.restoreAll();
  const isLib = (r) => r.startsWith('sdlc/.hooks/lib/');
  const firstLib = seen.findIndex(isLib);
  const firstHook = seen.findIndex((r) => !isLib(r));
  assert.ok(firstLib !== -1 && firstHook !== -1, `both trees written: ${seen.join(', ')}`);
  assert.ok(firstLib < firstHook, `lib before hooks: ${seen.join(', ')}`);
  assertImportsFirst(path.join(PKG_ROOT, 'lib'), seen.filter(isLib).map((r) => r.slice('sdlc/.hooks/lib/'.length)));
  assertImportsFirst(path.join(PKG_ROOT, 'payload/hooks'), seen.filter((r) => !isLib(r)).map((r) => r.slice('sdlc/.hooks/'.length)));

  const manifest = path.join(root, 'sdlc/.state/manifest');
  const before = fs.readFileSync(manifest, 'utf8');
  const res = runCli(root, ['update']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /pruned: 0\b/);
  assert.match(res.stdout, /written: 0\b/);
  assert.equal(fs.readFileSync(manifest, 'utf8'), before, 'an unchanged update leaves the manifest byte-identical');
});

// ---------- release-check ----------

function runCheck(t, changelog, { version = '1.2.3' } = {}) {
  const dir = makeTempProject(t);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '@warnyin/sdlc', version }));
  if (changelog !== null) fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), changelog);
  const res = spawnSync(process.execPath, [CHECK], {
    cwd: dir, env: { ...process.env, GITHUB_REF_NAME: `v${version}` }, input: '11.5.1', encoding: 'utf8',
  });
  if (res.error) throw res.error;
  return res;
}

test('row 9: release-check needs CHANGELOG.md to open with the version heading', (t) => {
  const unreleased = runCheck(t, '# Changelog\n\n## Unreleased\n\n- x\n\n## 1.2.2 (2026-01-01)\n');
  assert.notEqual(unreleased.status, 0);
  assert.ok(unreleased.stderr.includes('## Unreleased'), unreleased.stderr);
  assert.ok(unreleased.stderr.includes('1.2.3'), unreleased.stderr);
  for (const [label, text] of [
    ['missing', null],
    ['older version', '# Changelog\n\n## 1.2.2 (2026-01-01)\n'],
    ['no date', '# Changelog\n\n## 1.2.3\n'],
    ['no sections', '# Changelog\n'],
    ['a longer version', '# Changelog\n\n## 1.2.30 (2026-01-01)\n'],
  ]) {
    const res = runCheck(t, text);
    assert.notEqual(res.status, 0, `${label}: ${res.stdout}`);
    assert.match(res.stderr, /^release-check: .*CHANGELOG/m, `${label}: refused by the CHANGELOG check, not a crash`);
  }
  const ok = runCheck(t, '# Changelog\r\n\r\n## 1.2.3 (2026-10-26)\r\n\r\n- x\r\n');
  assert.equal(ok.status, 0, ok.stderr);
});

// ---------- escaped ids ----------

const HOSTILE_TIER = 'de' + String.fromCodePoint(0x9b) + 'ep';

function badChange(root, { id = BAD, status = 'new', extra = '', title = 'Bad ' + String.fromCodePoint(0x202e) + ' title', tier = 'standard' } = {}) {
  const dir = path.join(root, 'sdlc', 'changes', id);
  fs.mkdirSync(dir, { recursive: true });
  const body = STANDARD_BODY.replace('# Change: Add two-factor auth', `# Change: ${title}`).replace(/auth/g, 'cap-bad');
  fs.writeFileSync(path.join(dir, 'change.md'), `---\nid: ${id}\ntier: ${tier}\nstatus: ${status}\n${extra}---\n${body}`);
  return dir;
}

function waiter(root, id, on) {
  return badChange(root, { id, extra: `blocked-by: [${on.join(', ')}]\n`, title: 'waiter' });
}

test('row 11: status prints ids, titles, tiers and waits escaped; --json keeps the raw id', (t) => {
  const root = project(t);
  badChange(root, { tier: HOSTILE_TIER, extra: 'blocked-by: [w]\n' });
  writeChange(root, 'w', { body: STANDARD_BODY.replace(/auth/g, 'cap-w') });
  for (const args of [['status'], ['status', '--all']]) {
    const res = runCli(root, args);
    assert.equal(res.status, 0, res.stderr);
    assertEscaped(res.stdout, args.join(' '));
  }
  const json = JSON.parse(runCli(root, ['status', '--json']).stdout);
  assert.ok(json.changes.some((c) => c.id === BAD), 'JSON keeps the raw id');
});

test('row 12: validate and formatIssues print the id escaped', (t) => {
  const root = project(t);
  const dir = badChange(root);
  const text = fs.readFileSync(path.join(dir, 'change.md'), 'utf8').replace(`id: ${BAD}`, 'id: other');
  fs.writeFileSync(path.join(dir, 'change.md'), text);
  const res = runCli(root, ['validate']);
  assertEscaped(res.stdout + res.stderr, 'validate');
  assertEscaped(formatIssues([{ level: 'error', where: BAD, msg: `frontmatter id "${BAD}"` }]), 'formatIssues');
});

// A relation entry must match [A-Za-z0-9._-] (lib/relations.mjs ENTRY_RE), so a hostile id is never
// waited on and never a cycle member: only the waiting change's own folder name can carry one.
test('row 13 (green guard): a hostile id cannot enter a relation; the refusal is escaped', (t) => {
  const root = project(t);
  badChange(root, { extra: 'blocked-by: [w]\n' });
  waiter(root, 'w', [BAD]);
  const res = runCli(root, ['validate']);
  assert.match(res.stdout + res.stderr, /is not a change id/);
  assert.doesNotMatch(res.stdout + res.stderr, /waiting cycle/);
  assertEscaped(res.stdout + res.stderr, 'validate');
});

function shippedChange(root, name, id, { digest = false } = {}) {
  const dir = path.join(root, 'sdlc', 'changes', 'archive', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'change.md'), `---\nid: ${id}\ntier: standard\nstatus: shipped\n---\n${STANDARD_BODY}`);
  fs.writeFileSync(path.join(dir, 'journal.ndjson'), JSON.stringify({ ts: '2026-01-01T00:00:00Z', event: 'ship', change: id }) + '\n');
  if (digest) fs.writeFileSync(path.join(dir, 'digest.md'), '# Digest\n');
}

test('row 14: observe flags and listing print ids and tiers escaped', (t) => {
  const root = project(t);
  shippedChange(root, `2026-01-01-${BAD}`, BAD);
  shippedChange(root, '2026-01-02-old', 'old', { digest: true });
  badChange(root, { tier: HOSTILE_TIER, extra: 'blocked-by: [old]\n' });
  const events = [
    { event: 'compact' },
    ...[1, 2, 3, 4].map((round) => ({ event: 'verify', result: 'fail', round: String(round), gate: 'fast' })),
    { event: 'review', blockers: '0', closed: 'human' },
  ];
  fs.mkdirSync(path.join(root, 'sdlc/.state/journal'), { recursive: true });
  fs.writeFileSync(path.join(root, 'sdlc/.state/journal', `${BAD}.ndjson`),
    events.map((e) => JSON.stringify({ ts: '2025-12-01T00:00:00Z', ...e })).join('\n') + '\n');
  const steering = path.join(root, 'sdlc/context/steering');
  fs.mkdirSync(steering, { recursive: true });
  fs.writeFileSync(path.join(steering, `${BAD}.md`), '---\nname: api\ninclusion: paths\npathMatch: ["src/**"]\n---\n# Steering: api\n- x\n');
  const res = runCli(root, ['observe']);
  assert.equal(res.status, 0, res.stderr);
  for (const flag of [/archived without digest/, /compact event/, /verify rounds/, /closed by a human has no reason/, /freed but not resumed/, /zero pointer hits/]) {
    assert.match(res.stdout, flag);
  }
  assertEscaped(res.stdout, 'observe');
  assert.ok(res.stdout.includes(`de${BS}u{9b}ep`), 'the hostile tier is escaped in the listing');
  const json = JSON.parse(runCli(root, ['observe', '--json']).stdout);
  assert.ok(json.changes.some((c) => c.id === BAD), 'observe --json keeps the raw id');
  assert.ok(json.changes.some((c) => c.tier === HOSTILE_TIER), 'observe --json keeps the raw tier');
});

test('row 15: archive prints refusals, the shipped id and the folder escaped', (t) => {
  const root = project(t);
  const dir = badChange(root, { status: 'verified' });
  writeContractTests(dir);
  for (const id of [BAD + 'z', BAD + '/..']) {
    const res = runCli(root, ['archive', id]);
    assert.notEqual(res.status, 0);
    assertEscaped(res.stderr, `archive ${JSON.stringify(id)}`);
  }
  writeChange(root, 'third', { body: STANDARD_BODY.replace(/auth/g, 'third') });
  const file = path.join(dir, 'change.md');
  const text = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, text.replace('status: verified\n', 'status: verified\nblocked-by: [third]\n'));
  const waiting = runCli(root, ['archive', BAD]);
  assert.notEqual(waiting.status, 0);
  assertEscaped(waiting.stderr, 'archive of a waiting change');
  fs.writeFileSync(file, text);
  assert.equal(runHook(root, 'journal.mjs', { args: ['park', BAD], stdin: { reason: 'shelved' } }).status, 0);
  const parked = runCli(root, ['archive', BAD]);
  assert.notEqual(parked.status, 0);
  assertEscaped(parked.stderr, 'archive of a parked change');
  fs.writeFileSync(file, text);
  const today = new Date().toISOString().slice(0, 10);
  const taken = path.join(root, 'sdlc', 'changes', 'archive', `${today}-${BAD}`);
  fs.mkdirSync(taken, { recursive: true });
  const exists = runCli(root, ['archive', BAD]);
  assert.notEqual(exists.status, 0);
  assert.match(exists.stderr, /already exists/);
  assertEscaped(exists.stderr, 'archive target already exists');
  fs.rmSync(taken, { recursive: true });
  const res = runCli(root, ['archive', BAD]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /shipped:/);
  assertEscaped(res.stdout, 'archive success');
});

test('row 15b: the ship impact and an unreadable neighbour print the waiting ids escaped', (t) => {
  const root = project(t);
  const dep = writeChange(root, 'dep', { status: 'verified', body: STANDARD_BODY });
  writeContractTests(dep);
  writeChange(root, 'third', { body: STANDARD_BODY.replace(/auth/g, 'third') });
  waiter(root, BAD, ['dep']);
  waiter(root, BAD + '2', ['dep', 'third']);
  waiter(root, BAD + '3', ['dep']);
  assert.equal(runHook(root, 'journal.mjs', { args: ['park', BAD + '3'], stdin: { reason: 'shelved' } }).status, 0);
  const unreadable = path.join(root, 'sdlc', 'changes', BAD + '4');
  fs.mkdirSync(path.join(unreadable, 'change.md'), { recursive: true });
  const res = runCli(root, ['archive', 'dep']);
  assert.equal(res.status, 0, res.stderr);
  for (const line of [/is free to resume/, /waits on:/, /no longer waiting, but parked/]) assert.match(res.stdout, line);
  assert.match(res.stderr, /cannot be read/);
  assertEscaped(res.stdout, 'ship impact');
  assertEscaped(res.stderr, 'unreadable neighbour');
});

test('row 16: the journal hook prints the id escaped on every path', (t) => {
  const root = project(t);
  const gate = runHook(root, 'journal.mjs', { args: ['open-ship', BAD] });
  assertEscaped(gate.stdout + gate.stderr, 'open-ship');
  runHook(root, 'journal.mjs', { args: ['close'] });
  const missing = runHook(root, 'journal.mjs', { args: ['set-active', BAD] });
  assert.notEqual(missing.status, 0);
  assertEscaped(missing.stderr, 'set-active on a missing change');
  badChange(root);
  const ok = runHook(root, 'journal.mjs', { args: ['set-active', BAD] });
  assert.equal(ok.status, 0, ok.stderr);
  assertEscaped(ok.stdout + ok.stderr, 'set-active');
  assert.equal(runHook(root, 'journal.mjs', { args: ['park', BAD], stdin: { reason: 'shelved' } }).status, 0);
  const parked = runHook(root, 'journal.mjs', { args: ['set-active', BAD] });
  assert.notEqual(parked.status, 0);
  assertEscaped(parked.stderr, 'set-active on a parked change');
});

test('row 16b: a refused pointer write prints the id escaped and writes nothing outside', (t) => {
  const root = project(t);
  badChange(root);
  const out = outside(t);
  if (!relink(t, root, 'sdlc/.state', out)) return;
  const before = tree(out);
  const res = runHook(root, 'journal.mjs', { args: ['set-active', BAD] });
  assert.match(res.stderr, /not recorded/);
  assertEscaped(res.stderr, 'refused set-active');
  assert.deepEqual(tree(out), before, 'nothing written outside the project');
});

test('row 17: the session summary, the Active change line and a steering pointer print escaped', (t) => {
  const root = project(t);
  badChange(root);
  assert.equal(runHook(root, 'journal.mjs', { args: ['set-active', BAD] }).status, 0);
  const summary = runHook(root, 'session-summary.mjs', {
    stdin: { hook_event_name: 'Stop', transcript_path: writeTranscript(root) },
  });
  assert.equal(summary.status, 0, summary.stderr);
  assert.match(summary.stdout, /· change /);
  assertEscaped(summary.stdout, 'session summary');
  const ctx = runHook(root, 'inject-context.mjs', { stdin: { hook_event_name: 'SessionStart' } });
  assert.match(ctx.stdout, /Active change:/);
  assertEscaped(ctx.stdout.split(/\r?\n/).find((l) => l.startsWith('Active change:')), 'Active change line');

  const steering = path.join(root, 'sdlc/context/steering');
  fs.mkdirSync(steering, { recursive: true });
  fs.writeFileSync(path.join(steering, `${BAD}.md`), '---\nname: api\ninclusion: paths\npathMatch: ["src/**"]\n---\n# Steering: api\n- x\n');
  const pointer = runHook(root, 'validate-artifact.mjs', {
    stdin: { session_id: 's1', tool_name: 'Write', tool_input: { file_path: path.join(root, 'src/a.js') } },
  });
  const context = JSON.parse(pointer.stdout).hookSpecificOutput.additionalContext;
  assert.match(context, /Steering applies/);
  assertEscaped(context, 'steering pointer');
});

// ---------- tier cap ----------

test('row 18: capForChange guards the tier itself; callers keep no copy of the guard', (t) => {
  for (const tier of ['toString', 'constructor', '__proto__', 'hasOwnProperty', undefined, '']) {
    assert.equal(capForChange(tier), CAPS.change.standard, `tier ${String(tier)} reads the standard cap`);
  }
  for (const tier of ['vibe', 'standard', 'deep']) assert.equal(capForChange(tier), CAPS.change[tier]);
  for (const rel of ['bin/cli.mjs', 'lib/validate.mjs']) {
    const src = fs.readFileSync(path.join(PKG_ROOT, rel), 'utf8');
    assert.ok(!/TIERS\.includes\(data\.tier\)\s*\?/.test(src), `${rel} holds no copy of the tier guard`);
  }
  const root = project(t);
  const padding = Array.from({ length: 110 }, (_, i) => `- note ${i}`).join('\n');
  writeChange(root, 'odd', { tier: 'toString', body: `${STANDARD_BODY}\n## Notes\n${padding}\n` });
  const res = runCli(root, ['validate', 'odd']);
  assert.match(res.stdout, /tier must be one of/);
  assert.match(res.stdout, /cap for standard: 100/);
  assert.doesNotMatch(res.stdout, /function/);
});

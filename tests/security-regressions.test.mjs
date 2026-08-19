// Regression coverage for the review findings: symlink-driven prune deletion,
// symlink write-lock bypass, non-atomic archive, duplicate Delta blocks,
// update --tool config drift, session-id path traversal, __proto__ keys.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { makeTempProject, runCli, writeChange, writeContractTests, STANDARD_BODY } from './helpers.mjs';
import { parseDelta, mergeDelta } from '../lib/delta.mjs';
import { parseFrontmatter } from '../lib/frontmatter.mjs';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function runHook(projectRoot, script, stdinObj) {
  return spawnSync(process.execPath, [path.join(projectRoot, 'sdlc/.hooks', script)], {
    cwd: projectRoot, input: JSON.stringify(stdinObj), encoding: 'utf8',
  });
}

test('prune: symlinked ancestor inside a prunable prefix cannot redirect deletion', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);

  fs.writeFileSync(path.join(dir, 'VICTIM.txt'), 'IMPORTANT USER FILE\n');
  fs.symlinkSync(dir, path.join(dir, 'sdlc/.playbook/x')); // sdlc/.playbook/x → project root
  fs.appendFileSync(path.join(dir, 'sdlc/.state/manifest'),
    `${sha('IMPORTANT USER FILE\n')}  sdlc/.playbook/x/VICTIM.txt\n`);

  const res = runCli(dir, ['update']);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'VICTIM.txt')), 'victim file must survive');
  assert.match(res.stderr, /symlink in path/);
});

test('guard-writes: replacing sdlc/specs with a symlink DENIES instead of silently allowing', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const outside = fs.mkdtempSync(path.join(dir, '..', 'outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));

  fs.rmSync(path.join(dir, 'sdlc/specs'), { recursive: true });
  fs.symlinkSync(outside, path.join(dir, 'sdlc/specs'));

  const res = runHook(dir, 'guard-writes.mjs', {
    tool_name: 'Edit',
    tool_input: { file_path: path.join(dir, 'sdlc/specs/auth/spec.md') },
  });
  assert.match(res.stdout, /"permissionDecision":"deny"/, 'symlink must not disable the lock');
  assert.match(res.stdout, /symlink/);
});

test('guard-writes: normal (non-symlink) paths still behave — deny locked, allow gated', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  let res = runHook(dir, 'guard-writes.mjs', {
    tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'sdlc/specs/auth/spec.md') },
  });
  assert.match(res.stdout, /write-locked outside ship/);
  res = runHook(dir, 'guard-writes.mjs', {
    tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'src/app.js') },
  });
  assert.equal(res.stdout.trim(), '');
});

test('archive: same-day id collision fails BEFORE any write — spec and change untouched', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  let changeDir = writeChange(dir, 'dup-ship', { status: 'verified', body: STANDARD_BODY });
  writeContractTests(changeDir);
  assert.equal(runCli(dir, ['archive', 'dup-ship']).status, 0);
  const specBefore = fs.readFileSync(path.join(dir, 'sdlc/specs/auth/spec.md'), 'utf8');

  // Same id reappears the same day with a different, mergeable delta.
  changeDir = writeChange(dir, 'dup-ship', {
    status: 'verified',
    body: STANDARD_BODY.replace('Two-factor login', 'Session revocation'),
  });
  writeContractTests(changeDir);
  const res = runCli(dir, ['archive', 'dup-ship']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /already exists/);

  assert.equal(fs.readFileSync(path.join(dir, 'sdlc/specs/auth/spec.md'), 'utf8'), specBefore,
    'living spec must be untouched on failure');
  const change = fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8');
  assert.match(change, /^status: verified$/m, 'status must not be stamped shipped');
  assert.ok(fs.existsSync(changeDir), 'change stays active');
});

test('parseDelta: repeated Delta blocks for one capability merge; duplicate names error', () => {
  const twoBlocks = [
    '## Delta: auth',
    '### ADDED Requirement: Login',
    'The system SHALL log in.',
    '## Delta: auth',
    '### ADDED Requirement: Logout',
    'The system SHALL log out.',
  ].join('\n');
  const { deltas, errors } = parseDelta(twoBlocks);
  assert.deepEqual(errors, []);
  assert.equal(deltas.length, 1);
  assert.deepEqual(deltas[0].ops.map((o) => o.name), ['Login', 'Logout']);
  const merged = mergeDelta(null, deltas[0].ops, 'auth');
  assert.match(merged.content, /Login/);
  assert.match(merged.content, /Logout/);

  const dupNames = twoBlocks.replace('Requirement: Logout', 'Requirement: Login');
  assert.ok(parseDelta(dupNames).errors.some((e) => e.includes('Duplicate requirement')));
});

test('update --tool subset: persists the new tool set into config.yaml', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude,cursor']);
  const res = runCli(dir, ['update', '--tool', 'cursor']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(fs.readFileSync(path.join(dir, 'sdlc/config.yaml'), 'utf8'), /tools: \[cursor\]/);
});

test('validate-artifact: hostile session_id cannot escape .state/', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  fs.writeFileSync(path.join(dir, 'sdlc/context/steering/db.md'),
    '---\nname: db\ninclusion: paths\npathMatch: ["src/**"]\n---\n# S\n- x\n');
  const res = runHook(dir, 'validate-artifact.mjs', {
    tool_name: 'Edit',
    tool_input: { file_path: path.join(dir, 'src/a.js') },
    session_id: '../../../evil',
  });
  assert.equal(res.status, 0);
  const stateFiles = fs.readdirSync(path.join(dir, 'sdlc/.state')).filter((f) => f.startsWith('pointers-'));
  assert.equal(stateFiles.length, 1);
  assert.match(stateFiles[0], /^pointers-evil\.json$/);
  assert.ok(!fs.existsSync(path.join(dir, '..', 'evil')), 'no traversal outside .state');
});

test('frontmatter: __proto__/constructor keys are ignored', () => {
  const { data } = parseFrontmatter('---\n__proto__: [1, 2]\nconstructor: x\nid: ok\n---\n');
  assert.equal(Object.prototype.hasOwnProperty.call(data, '__proto__'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(data, 'constructor'), false);
  assert.equal(data.id, 'ok');
  assert.equal(typeof data.map, 'undefined');
});

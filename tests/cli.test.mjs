import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  makeTempProject, runCli, writeChange, writeContractTests, STANDARD_BODY,
} from './helpers.mjs';

test('init: scaffolds sdlc/, records tools, appends .gitignore, writes manifest', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res.status, 0, res.stderr);

  for (const rel of [
    'sdlc/config.yaml',
    'sdlc/context/constitution.md',
    'sdlc/harness.md',
    'sdlc/context/steering',
    'sdlc/specs',
    'sdlc/changes/archive',
    'sdlc/evals',
    'sdlc/.state/manifest',
  ]) {
    assert.ok(fs.existsSync(path.join(dir, rel)), `missing ${rel}`);
  }
  assert.match(fs.readFileSync(path.join(dir, 'sdlc/config.yaml'), 'utf8'), /tools: \[claude\]/);
  assert.match(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), /sdlc\/\.state\//);
});

test('init: is idempotent and never clobbers user-edited files', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const constitutionPath = path.join(dir, 'sdlc/context/constitution.md');
  fs.writeFileSync(constitutionPath, '# Constitution — mine\n- my rule\n');
  const res = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(fs.readFileSync(constitutionPath, 'utf8'), '# Constitution — mine\n- my rule\n');
});

test('init: rejects unknown tools', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'notepad']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /unknown tool/);
});

test('status: reports empty state and lists changes', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  let res = runCli(dir, ['status']);
  assert.match(res.stdout, /No active changes/);

  writeChange(dir, 'add-2fa', { status: 'building', body: STANDARD_BODY });
  res = runCli(dir, ['status']);
  assert.match(res.stdout, /add-2fa\s+\[standard\/building\]\s+Add two-factor auth/);
  assert.match(res.stdout, /1 active · 0 archived/);
});

test('status: fails cleanly outside an sdlc project', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['status']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /No sdlc\/ directory/);
});

test('archive: merges delta into a new living spec, stamps, journals, moves', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const changeDir = writeChange(dir, 'add-2fa', { status: 'verified', body: STANDARD_BODY });
  writeContractTests(changeDir);

  const res = runCli(dir, ['archive', 'add-2fa']);
  assert.equal(res.status, 0, res.stderr + res.stdout);

  const spec = fs.readFileSync(path.join(dir, 'sdlc/specs/auth/spec.md'), 'utf8');
  assert.match(spec, /### Requirement: Two-factor login/);
  assert.match(spec, /OTP required/);

  assert.ok(!fs.existsSync(changeDir), 'change dir should be moved');
  const archiveRoot = path.join(dir, 'sdlc/changes/archive');
  const archived = fs.readdirSync(archiveRoot).find((n) => n.endsWith('-add-2fa'));
  assert.ok(archived, 'archived folder exists with date prefix');
  assert.match(archived, /^\d{4}-\d{2}-\d{2}-add-2fa$/);

  const stamped = fs.readFileSync(path.join(archiveRoot, archived, 'change.md'), 'utf8');
  assert.match(stamped, /^status: shipped$/m);

  const journal = fs.readFileSync(path.join(archiveRoot, archived, 'journal.ndjson'), 'utf8').trim();
  const event = JSON.parse(journal.split('\n').at(-1));
  assert.equal(event.event, 'ship');
  assert.deepEqual(event.specs, ['auth']);
});

test('archive: refuses when strict validation fails (clarification marker)', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const body = STANDARD_BODY.replace('Password-only login is weak.',
    'Password-only login is weak. [NEEDS CLARIFICATION: which factor?]');
  const changeDir = writeChange(dir, 'add-2fa', { status: 'verified', body });
  writeContractTests(changeDir);

  const res = runCli(dir, ['archive', 'add-2fa']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /not archiving/);
  assert.ok(fs.existsSync(changeDir), 'change must stay in place');
  assert.ok(!fs.existsSync(path.join(dir, 'sdlc/specs/auth')), 'no partial spec writes');
});

test('archive: refuses MODIFIED against a missing requirement (all-or-nothing)', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const body = STANDARD_BODY.replace('### ADDED Requirement: Two-factor login',
    '### MODIFIED Requirement: Ghost requirement');
  const changeDir = writeChange(dir, 'add-2fa', { status: 'verified', body });
  writeContractTests(changeDir);

  const res = runCli(dir, ['archive', 'add-2fa']);
  assert.equal(res.status, 1);
  assert.ok(fs.existsSync(changeDir));
});

test('archive: second run on same id fails cleanly (already moved)', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const changeDir = writeChange(dir, 'add-2fa', { status: 'verified', body: STANDARD_BODY });
  writeContractTests(changeDir);
  runCli(dir, ['archive', 'add-2fa']);
  const res = runCli(dir, ['archive', 'add-2fa']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /not found/);
});

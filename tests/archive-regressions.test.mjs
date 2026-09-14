// Regressions around `archive` atomicity. The command promises all-or-nothing
// (bin/cli.mjs phase 1/phase 2), so anything that can fail must fail before the
// first spec byte is written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, runHook, writeChange, writeContractTests, STANDARD_BODY } from './helpers.mjs';

function stageChange(t) {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const changeDir = writeChange(dir, 'add-2fa', { status: 'verified', body: STANDARD_BODY });
  writeContractTests(changeDir);
  return { dir, changeDir };
}

// `init` scaffolds sdlc/changes/archive/, but git does not track empty
// directories — it is gone for everyone who clones the repo before the first
// change ships. The very first `archive` therefore ran into a missing parent.
test('archive: recreates changes/archive/ when the empty dir did not survive a clone', (t) => {
  const { dir, changeDir } = stageChange(t);
  fs.rmSync(path.join(dir, 'sdlc/changes/archive'), { recursive: true, force: true });

  const res = runCli(dir, ['archive', 'add-2fa']);
  assert.equal(res.status, 0, res.stderr + res.stdout);

  assert.ok(!fs.existsSync(changeDir), 'change dir should be moved');
  const archived = fs.readdirSync(path.join(dir, 'sdlc/changes/archive')).find((n) => n.endsWith('-add-2fa'));
  assert.ok(archived, 'archived folder exists with date prefix');
});

// Row 22 of sdlc/changes/next-this-session/contract/tests.md — shipping releases every
// pointer to the shipped change and no other; an aborted ship releases nothing.
test('row 22: archive removes the pointers naming the shipped change, and only on success', (t) => {
  const stageWithPointers = () => {
    const { dir } = stageChange(t);
    writeChange(dir, 'y', { body: STANDARD_BODY.replace(/auth/g, 'billing') });
    const setAs = (sid, id) => runHook(dir, 'journal.mjs', {
      args: ['set-active', id], env: { CLAUDE_CODE_SESSION_ID: sid },
    });
    assert.equal(setAs('s2', 'y').status, 0);
    assert.equal(setAs('s1', 'add-2fa').status, 0); // last set, so active.json names add-2fa too
    return dir;
  };
  const read = (dir, rel) => {
    const p = path.join(dir, 'sdlc/.state', rel);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')).change : null;
  };

  const shipped = stageWithPointers();
  const res = runCli(shipped, ['archive', 'add-2fa']);
  assert.equal(res.status, 0, res.stderr + res.stdout);
  assert.equal(read(shipped, 'sessions/s1.json'), null, 'the shipping session\'s pointer must be released');
  assert.equal(read(shipped, 'active.json'), null, 'the project pointer to the shipped change must be released');
  assert.equal(read(shipped, 'sessions/s2.json'), 'y', 'another session\'s pointer must be untouched');

  const aborted = stageWithPointers();
  const date = new Date().toISOString().slice(0, 10);
  fs.mkdirSync(path.join(aborted, 'sdlc/changes/archive', `${date}-add-2fa`), { recursive: true });
  assert.equal(runCli(aborted, ['archive', 'add-2fa']).status, 1, 'archive must abort on a taken destination');
  assert.equal(read(aborted, 'sessions/s1.json'), 'add-2fa', 'an aborted ship must release nothing');
  assert.equal(read(aborted, 'active.json'), 'add-2fa', 'an aborted ship must release nothing');
  assert.equal(read(aborted, 'sessions/s2.json'), 'y');
});

test('archive: a half-shipped repo is never left behind — specs and status move together', (t) => {
  const { dir } = stageChange(t);
  fs.rmSync(path.join(dir, 'sdlc/changes/archive'), { recursive: true, force: true });

  assert.equal(runCli(dir, ['archive', 'add-2fa']).status, 0);
  // No active change may remain claiming work that the specs already absorbed.
  assert.match(runCli(dir, ['status']).stdout, /No active changes/);
  assert.match(fs.readFileSync(path.join(dir, 'sdlc/specs/auth/spec.md'), 'utf8'), /Two-factor login/);
});

// The parent directory is prepared before phase 2, so an unusable archive path
// aborts while the specs are still untouched.
test('archive: an unusable archive path aborts before a single spec is written', (t) => {
  const { dir, changeDir } = stageChange(t);
  const archiveRoot = path.join(dir, 'sdlc/changes/archive');
  fs.rmSync(archiveRoot, { recursive: true, force: true });
  fs.writeFileSync(archiveRoot, 'not a directory\n');

  const res = runCli(dir, ['archive', 'add-2fa']);
  assert.equal(res.status, 1);
  assert.ok(!fs.existsSync(path.join(dir, 'sdlc/specs/auth/spec.md')), 'no spec may be merged');
  assert.match(fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8'), /^status: verified$/m);
  // The ship event goes to the out-of-tree stream, so that is where an aborted archive
  // must leave no trace — the change folder never holds one to check any more.
  const live = path.join(dir, 'sdlc/.state/journal/add-2fa.ndjson');
  const shipped = fs.existsSync(live) && fs.readFileSync(live, 'utf8').includes('"event":"ship"');
  assert.ok(!shipped, 'no ship event may be journalled');
  assert.ok(!fs.existsSync(path.join(changeDir, 'journal.ndjson')), 'nothing may be sealed in-tree');
});

// The mkdir at archive time recovers from a lost directory; this marker stops it
// from being lost in the first place, so `sdlc/changes/archive/` survives a clone.
test('init: leaves a .gitkeep so the empty archive dir survives a commit', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);

  const keep = path.join(dir, 'sdlc/changes/archive/.gitkeep');
  assert.ok(fs.existsSync(keep), 'archive/.gitkeep must exist');
  assert.equal(fs.readFileSync(keep, 'utf8'), '', 'the marker carries no content');

  // Not payload-owned: an empty marker is nothing for prune to reclaim or for
  // the installer to warn about when someone edits it.
  const manifest = fs.readFileSync(path.join(dir, 'sdlc/.state/manifest'), 'utf8');
  assert.doesNotMatch(manifest, /\.gitkeep/);
});

test('update: restores the marker for projects installed before it existed', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  fs.rmSync(path.join(dir, 'sdlc/changes/archive'), { recursive: true, force: true });

  const res = runCli(dir, ['update']);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'sdlc/changes/archive/.gitkeep')));
});

test('archive: the marker does not register as an archived change', (t) => {
  const { dir } = stageChange(t);
  assert.match(runCli(dir, ['status']).stdout, /1 active · 0 archived/);
  assert.equal(runCli(dir, ['archive', 'add-2fa']).status, 0);
  assert.match(runCli(dir, ['status']).stdout, /No active changes \(1 archived\)/);
});

// issue #1: `### MODIFIED Requirement:` replaces the body wholesale, so a
// rewritten body that carries only some of the spec's scenarios used to drop
// the rest with no error, no warning and nothing in the archive output — found
// only by a human reading the diff, after the change folder had already moved.
const SHIPPED_BODY = `# Change: Add two-factor auth

## Why
Password-only login is weak.

## Delta: auth

### ADDED Requirement: Two-factor login
The system SHALL require a second factor during login.

#### Scenario: OTP required
- WHEN a user with 2FA enabled submits valid credentials
- THEN the system prompts for a one-time code

#### Scenario: Lockout
- WHEN five one-time codes fail in a row
- THEN the system locks the account for 15 minutes

## Tasks
- [ ] T1 implement OTP flow [tier:balanced]
`;

function modifiedBody(scenarios) {
  return `# Change: Trim 2FA

## Why
Follow-up.

## Delta: auth

### MODIFIED Requirement: Two-factor login
The system SHALL require a second factor during login.
${scenarios}
## Tasks
- [ ] T1 adjust [tier:balanced]
`;
}

function shipFirst(t) {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  writeContractTests(writeChange(dir, 'add-2fa', { status: 'verified', body: SHIPPED_BODY }));
  assert.equal(runCli(dir, ['archive', 'add-2fa']).status, 0);
  return dir;
}

test('archive: a MODIFIED that drops a scenario merges, but says so', (t) => {
  const dir = shipFirst(t);
  const body = modifiedBody(`
#### Scenario: OTP required
- WHEN a user with 2FA enabled submits valid credentials
- THEN the system prompts for a one-time code
`);
  writeContractTests(writeChange(dir, 'trim-2fa', { status: 'verified', body }));

  const res = runCli(dir, ['archive', 'trim-2fa']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stderr, /drops scenario "Lockout"/);
  assert.match(res.stdout, /1 scenario warning\(s\)/);
  // Removing a scenario is sometimes the point — the merge still lands.
  const spec = fs.readFileSync(path.join(dir, 'sdlc/specs/auth/spec.md'), 'utf8');
  assert.ok(!spec.includes('Lockout'));
});

test('archive: a scenario kept by name but gutted of its promise is reported too', (t) => {
  const dir = shipFirst(t);
  const body = modifiedBody(`
#### Scenario: OTP required
- WHEN a user with 2FA enabled submits valid credentials
- THEN the system prompts for a one-time code

#### Scenario: Lockout
- WHEN five one-time codes fail in a row
`);
  writeContractTests(writeChange(dir, 'gut-2fa', { status: 'verified', body }));

  const res = runCli(dir, ['archive', 'gut-2fa']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stderr, /rewrites scenario "Lockout"/);
  assert.match(res.stderr, /locks the account for 15 minutes/);
});

test('archive: a MODIFIED that keeps every scenario is silent', (t) => {
  const dir = shipFirst(t);
  const body = modifiedBody(`
#### Scenario: OTP required
- WHEN a user with 2FA enabled submits valid credentials
- THEN the system prompts for a one-time code

#### Scenario: Lockout
- WHEN five one-time codes fail in a row
- THEN the system locks the account for 15 minutes
`);
  writeContractTests(writeChange(dir, 'keep-2fa', { status: 'verified', body }));

  const res = runCli(dir, ['archive', 'keep-2fa']);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(!/scenario/.test(res.stderr), res.stderr);
  assert.ok(!/scenario warning/.test(res.stdout), res.stdout);
});

// The loss must be visible while the change is still fixable, not only at ship.
test('validate: a scenario-dropping MODIFIED warns without failing the run', (t) => {
  const dir = shipFirst(t);
  const body = modifiedBody(`
#### Scenario: OTP required
- WHEN a user with 2FA enabled submits valid credentials
- THEN the system prompts for a one-time code
`);
  writeContractTests(writeChange(dir, 'trim-2fa', { status: 'verified', body }));

  const res = runCli(dir, ['validate', 'trim-2fa', '--strict']);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout + res.stderr, /drops scenario "Lockout"/);
});

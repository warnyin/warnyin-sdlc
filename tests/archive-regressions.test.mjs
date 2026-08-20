// Regressions around `archive` atomicity. The command promises all-or-nothing
// (bin/cli.mjs phase 1/phase 2), so anything that can fail must fail before the
// first spec byte is written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, writeChange, writeContractTests, STANDARD_BODY } from './helpers.mjs';

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
  assert.ok(!fs.existsSync(path.join(changeDir, 'journal.ndjson')), 'no ship event may be journalled');
});

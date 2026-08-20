// Regression: npx runs the bin through a node_modules/.bin symlink, so the
// entrypoint guard must realpath argv[1] — otherwise main() silently no-ops.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeTempProject, CLI } from './helpers.mjs';

test('CLI still works when invoked through a symlink (npx .bin path)', (t) => {
  const dir = makeTempProject(t);
  const binDir = path.join(dir, 'fake-bin');
  fs.mkdirSync(binDir);
  const link = path.join(binDir, 'warnyin-sdlc');
  fs.symlinkSync(CLI, link);

  const res = spawnSync(process.execPath, [link, 'init', '--tool', 'claude'], {
    cwd: dir, encoding: 'utf8',
  });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /SDLC Setup Complete/);
  assert.ok(fs.existsSync(path.join(dir, 'sdlc/config.yaml')));
});

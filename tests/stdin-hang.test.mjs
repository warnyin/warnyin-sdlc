// Regression: `journal.mjs note ...` (and any hook) must exit promptly even
// when stdin is open but idle — found by real dogfood where a playbook-driven
// `node sdlc/.hooks/journal.mjs note ...` hung a scripted shell for 2 minutes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { makeTempProject, runCli } from './helpers.mjs';

test('journal note exits within grace period when stdin stays open', async (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);

  const child = spawn(process.execPath, [path.join(dir, 'sdlc/.hooks/journal.mjs'), 'note', 'ping', 'k=v'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  // Deliberately keep child.stdin open — this used to hang forever.
  const code = await new Promise((resolve, reject) => {
    const killer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('journal note hung with open stdin')); }, 5000);
    child.on('exit', (c) => { clearTimeout(killer); resolve(c); });
  });
  assert.equal(code, 0);
  const journal = fs.readFileSync(path.join(dir, 'sdlc/.state/journal.ndjson'), 'utf8');
  assert.match(journal, /"event":"ping"/);
});

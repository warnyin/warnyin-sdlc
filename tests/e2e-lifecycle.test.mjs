// End-to-end, no-LLM: walk one change through the whole mechanical lifecycle
// exactly as the playbooks instruct an agent to — template copy, validator
// gates, hook guards, gate opening, archive, observe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeTempProject, runCli } from './helpers.mjs';

function runHook(projectRoot, script, stdinObj, extraArgs = []) {
  return spawnSync(process.execPath, [path.join(projectRoot, 'sdlc/.hooks', script), ...extraArgs], {
    cwd: projectRoot, input: stdinObj == null ? '' : JSON.stringify(stdinObj), encoding: 'utf8',
  });
}

test('e2e: init → new → contract → build → verify → ship → observe', (t) => {
  const dir = makeTempProject(t);

  // init
  assert.equal(runCli(dir, ['init', '--tool', 'claude']).status, 0);

  // new — from the installed template, with an unresolved marker first
  const changeDir = path.join(dir, 'sdlc/changes/rate-limit');
  fs.mkdirSync(changeDir, { recursive: true });
  const change = [
    '---', 'id: rate-limit', 'tier: standard', 'status: new', '---',
    '# Change: Add API rate limiting', '',
    '## Why', 'Unthrottled clients can exhaust the API.', '',
    '## Assumptions', '- Default limit 100 req/min per token (safe: matches gateway default).', '',
    '## Delta: api-limits', '',
    '### ADDED Requirement: Request rate limiting',
    'The system SHALL reject requests beyond the configured per-token rate.', '',
    '#### Scenario: over limit',
    '- WHEN a token exceeds [NEEDS CLARIFICATION: which window?] requests',
    '- THEN the system responds 429', '',
    '## Tasks', '- [ ] T1 middleware [tier:balanced]', '- [ ] T2 tests wiring [P] [tier:cheap]',
  ].join('\n');
  fs.writeFileSync(path.join(changeDir, 'change.md'), change);
  runHook(dir, 'journal.mjs', null, ['set-active', 'rate-limit']);

  // validator warns on marker at status new; archive must refuse outright
  let res = runCli(dir, ['validate', 'rate-limit']);
  assert.match(res.stdout, /CLARIFICATION/);
  assert.equal(runCli(dir, ['archive', 'rate-limit']).status, 1);

  // resolve the marker (the "asked the user" step)
  fs.writeFileSync(path.join(changeDir, 'change.md'), change.replace('[NEEDS CLARIFICATION: which window?]', '100/min'));

  // contract
  fs.mkdirSync(path.join(changeDir, 'contract'), { recursive: true });
  fs.writeFileSync(path.join(changeDir, 'contract/tests.md'), [
    '# Test contract — rate-limit',
    '| # | Given / When / Then | Kind | Maps to requirement |',
    '|---|---|---|---|',
    '| 1 | token over 100/min → 429 | int | Request rate limiting |',
    '## Out of scope', '- distributed clock skew — single node v1',
  ].join('\n'));
  fs.writeFileSync(path.join(changeDir, 'change.md'),
    fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8').replace('status: new', 'status: contracted'));
  assert.equal(runCli(dir, ['validate', 'rate-limit', '--strict']).status, 0);

  // build/verify simulated by journal notes + status stamps (agents do this)
  runHook(dir, 'journal.mjs', null, ['note', 'build', 'tasks=2']);
  runHook(dir, 'journal.mjs', null, ['note', 'verify', 'result=pass', 'round=1']);
  fs.writeFileSync(path.join(changeDir, 'change.md'),
    fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8').replace('status: contracted', 'status: verified'));

  // hook still guards specs before the gate opens
  res = runHook(dir, 'guard-writes.mjs', {
    tool_name: 'Edit',
    tool_input: { file_path: path.join(dir, 'sdlc/specs/api-limits/spec.md') },
  });
  assert.match(res.stdout, /"permissionDecision":"deny"/);

  // ship: open gate → archive → digest → close (as the ship playbook runs it)
  assert.equal(runHook(dir, 'journal.mjs', null, ['open-ship', 'rate-limit']).status, 0);
  res = runCli(dir, ['archive', 'rate-limit']);
  assert.equal(res.status, 0, res.stderr);
  const archived = fs.readdirSync(path.join(dir, 'sdlc/changes/archive')).find((n) => n.endsWith('-rate-limit'));
  fs.writeFileSync(path.join(dir, 'sdlc/changes/archive', archived, 'digest.md'),
    '# Digest — rate-limit\nshipped rate limiting; 1 assumption; verify 1 round.\n');
  runHook(dir, 'journal.mjs', null, ['close']);

  // living spec exists and carries the requirement
  const spec = fs.readFileSync(path.join(dir, 'sdlc/specs/api-limits/spec.md'), 'utf8');
  assert.match(spec, /### Requirement: Request rate limiting/);
  assert.match(spec, /429/);

  // observe reflects the shipped change with a verify round and no flags about digest
  const report = JSON.parse(runCli(dir, ['observe', '--json']).stdout);
  assert.equal(report.summary.shipped, 1);
  assert.equal(report.summary.firstPassRate, 1);
  const c = report.changes[0];
  assert.equal(c.verify.rounds, 1);
  assert.equal(c.digest, true);
  assert.ok(!report.flags.some((f) => f.includes('digest')), 'no digest flag');

  // update stays green post-ship
  assert.equal(runCli(dir, ['update']).status, 0);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeTempProject, runCli, writeChange, STANDARD_BODY } from './helpers.mjs';

function initProject(t) {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  return dir;
}

function runHook(projectRoot, script, stdinObj, extraArgs = []) {
  const res = spawnSync(process.execPath, [path.join(projectRoot, 'sdlc/.hooks', script), ...extraArgs], {
    cwd: projectRoot,
    input: stdinObj == null ? '' : JSON.stringify(stdinObj),
    encoding: 'utf8',
  });
  if (res.error) throw res.error;
  return res;
}

function readStateJournal(projectRoot) {
  const p = path.join(projectRoot, 'sdlc/.state/journal.ndjson');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}

const editInput = (projectRoot, rel) => ({
  hook_event_name: 'PreToolUse',
  tool_name: 'Edit',
  tool_input: { file_path: path.join(projectRoot, rel) },
  session_id: 'sess-1',
});

// ---------- guard-writes ----------

test('guard-writes: denies spec edits without a ship gate, and journals it', (t) => {
  const dir = initProject(t);
  const res = runHook(dir, 'guard-writes.mjs', editInput(dir, 'sdlc/specs/auth/spec.md'));
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /write-locked outside ship/);
  assert.ok(readStateJournal(dir).some((e) => e.event === 'guard' && e.action === 'deny'));
});

test('guard-writes: allows spec edits while the ship gate is open; TTL expiry re-locks', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'add-2fa', { body: STANDARD_BODY });
  runHook(dir, 'journal.mjs', null, ['open-ship', 'add-2fa']);
  let res = runHook(dir, 'guard-writes.mjs', editInput(dir, 'sdlc/specs/auth/spec.md'));
  assert.equal(res.stdout.trim(), '', 'gate open → no deny output');

  const phasePath = path.join(dir, 'sdlc/.state/phase.json');
  const phase = JSON.parse(fs.readFileSync(phasePath, 'utf8'));
  phase.expires = new Date(Date.now() - 1000).toISOString();
  fs.writeFileSync(phasePath, JSON.stringify(phase));
  res = runHook(dir, 'guard-writes.mjs', editInput(dir, 'sdlc/specs/auth/spec.md'));
  assert.match(res.stdout, /"permissionDecision":"deny"/);
});

test('guard-writes: journal.ndjson and .state are always machine-owned', (t) => {
  const dir = initProject(t);
  const changeDir = writeChange(dir, 'add-2fa', { body: STANDARD_BODY });
  fs.writeFileSync(path.join(changeDir, 'journal.ndjson'), '');
  let res = runHook(dir, 'guard-writes.mjs', editInput(dir, 'sdlc/changes/add-2fa/journal.ndjson'));
  assert.match(res.stdout, /machine-owned/);
  res = runHook(dir, 'guard-writes.mjs', editInput(dir, 'sdlc/.state/phase.json'));
  assert.match(res.stdout, /machine-owned/);
});

test('guard-writes: constitution locked without steer gate, open after open-steer', (t) => {
  const dir = initProject(t);
  let res = runHook(dir, 'guard-writes.mjs', editInput(dir, 'sdlc/context/constitution.md'));
  assert.match(res.stdout, /\/sdlc:steer/);
  runHook(dir, 'journal.mjs', null, ['open-steer']);
  res = runHook(dir, 'guard-writes.mjs', editInput(dir, 'sdlc/context/constitution.md'));
  assert.equal(res.stdout.trim(), '');
});

test('guard-writes: ignores files outside sdlc/', (t) => {
  const dir = initProject(t);
  const res = runHook(dir, 'guard-writes.mjs', editInput(dir, 'src/app.js'));
  assert.equal(res.stdout.trim(), '');
});

// ---------- inject-context ----------

test('inject-context: emits constitution + always-steering + active pointer', (t) => {
  const dir = initProject(t);
  fs.writeFileSync(path.join(dir, 'sdlc/context/constitution.md'), '# Constitution — demo\n- rule one\n');
  fs.writeFileSync(path.join(dir, 'sdlc/context/steering/db.md'),
    '---\nname: db\ninclusion: always\n---\n# Steering: db\n- use migrations\n');
  fs.writeFileSync(path.join(dir, 'sdlc/context/steering/api.md'),
    '---\nname: api\ninclusion: paths\npathMatch: ["src/api/**"]\n---\n# Steering: api\n- rest rules\n');
  writeChange(dir, 'add-2fa', { body: STANDARD_BODY });

  const res = runHook(dir, 'inject-context.mjs', { hook_event_name: 'SessionStart' });
  assert.match(res.stdout, /Constitution — demo/);
  assert.match(res.stdout, /use migrations/);
  assert.ok(!res.stdout.includes('rest rules'), 'paths steering must NOT be injected');
  assert.match(res.stdout, /Active change: sdlc\/changes\/add-2fa/);
});

test('inject-context: truncates beyond the always-budget with a warning', (t) => {
  const dir = initProject(t);
  const big = '# Constitution\n' + Array.from({ length: 80 }, (_, i) => `- rule ${i}`).join('\n');
  fs.writeFileSync(path.join(dir, 'sdlc/context/constitution.md'), big);
  const res = runHook(dir, 'inject-context.mjs', {});
  const lines = res.stdout.trim().split('\n');
  assert.equal(lines.length, 61); // 60 + warning line
  assert.match(lines.at(-1), /truncated at 60 lines/);
});

// ---------- validate-artifact ----------

test('validate-artifact: sdlc write with violations returns additionalContext', (t) => {
  const dir = initProject(t);
  const filler = Array.from({ length: 45 }, (_, i) => `- filler ${i}`).join('\n');
  writeChange(dir, 'big-vibe', { tier: 'vibe', body: `# Change: Big\n${filler}\n` });
  const res = runHook(dir, 'validate-artifact.mjs', {
    tool_name: 'Write',
    tool_input: { file_path: path.join(dir, 'sdlc/changes/big-vibe/change.md') },
    session_id: 'sess-1',
  });
  const out = JSON.parse(res.stdout);
  assert.match(out.hookSpecificOutput.additionalContext, /cap for vibe: 40/);
});

test('validate-artifact: steering pointer fires once per session and journals every hit', (t) => {
  const dir = initProject(t);
  fs.writeFileSync(path.join(dir, 'sdlc/context/steering/db.md'),
    '---\nname: db\ninclusion: paths\npathMatch: ["src/db/**"]\n---\n# Steering: db\n- x\n');
  const input = {
    tool_name: 'Edit',
    tool_input: { file_path: path.join(dir, 'src/db/users.sql') },
    session_id: 'sess-9',
  };
  let res = runHook(dir, 'validate-artifact.mjs', input);
  assert.match(JSON.parse(res.stdout).hookSpecificOutput.additionalContext, /steering\/db\.md/);
  res = runHook(dir, 'validate-artifact.mjs', input);
  assert.equal(res.stdout.trim(), '', 'second hit in same session is silent');
  const pointers = readStateJournal(dir).filter((e) => e.event === 'pointer');
  assert.equal(pointers.length, 2, 'both hits journaled for the learner');
});

// ---------- session-summary ----------

test('session-summary: journals real usage totals and prices when configured', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'add-2fa', { body: STANDARD_BODY });
  fs.appendFileSync(path.join(dir, 'sdlc/config.yaml'),
    'prices:\n  claude-sonnet-5: { input: 3, output: 15, cacheRead: 0.3 }\n');

  const transcript = [
    JSON.stringify({ message: { model: 'claude-sonnet-5', usage: { input_tokens: 1000, output_tokens: 2000, cache_read_input_tokens: 50000 } } }),
    JSON.stringify({ type: 'user', message: { content: 'hi' } }),
    JSON.stringify({ message: { model: 'claude-sonnet-5', usage: { input_tokens: 500, output_tokens: 100 } } }),
  ].join('\n');
  const tPath = path.join(dir, 'transcript.jsonl');
  fs.writeFileSync(tPath, transcript);

  const res = runHook(dir, 'session-summary.mjs', {
    session_id: 'sess-1', transcript_path: tPath,
  });
  assert.match(res.stdout, /\[sdlc\] session:/);
  assert.match(res.stdout, /change add-2fa/);

  const journal = fs.readFileSync(path.join(dir, 'sdlc/changes/add-2fa/journal.ndjson'), 'utf8')
    .trim().split('\n').map((l) => JSON.parse(l));
  const session = journal.find((e) => e.event === 'session');
  assert.equal(session.totals.input, 1500);
  assert.equal(session.totals.output, 2100);
  assert.equal(session.totals.cacheRead, 50000);
  // 1500*3 + 2100*15 + 50000*0.3 = 4500+31500+15000 = 51000 / 1e6 = 0.051
  assert.equal(session.costUsd, 0.051);
});

// ---------- journal utility ----------

test('journal: set-active steers attribution; note appends events', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'a-change', { body: STANDARD_BODY });
  writeChange(dir, 'b-change', { body: STANDARD_BODY.replace('auth', 'billing') });
  runHook(dir, 'journal.mjs', null, ['set-active', 'a-change']);
  runHook(dir, 'journal.mjs', null, ['note', 'compact']);
  const journal = fs.readFileSync(path.join(dir, 'sdlc/changes/a-change/journal.ndjson'), 'utf8');
  assert.match(journal, /"event":"compact"/);
});

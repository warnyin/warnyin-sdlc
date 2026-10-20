// Regression coverage for the review findings: symlink-driven prune deletion,
// symlink write-lock bypass, non-atomic archive, duplicate Delta blocks,
// update --tool config drift, session-id path traversal, __proto__ keys.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  makeTempProject, runCli, writeChange, writeContractTests, STANDARD_BODY,
  runHook as runHookWith, writeTranscript,
} from './helpers.mjs';
import { parseDelta, mergeDelta } from '../lib/delta.mjs';
import { parseFrontmatter } from '../lib/frontmatter.mjs';
import { resolveActive } from '../lib/active.mjs';

// A throwaway home so skills tests never read the real ~/.claude.
function emptyHome(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsdlc-home-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function runHook(projectRoot, script, stdinObj) {
  const env = { ...process.env, CLAUDE_CODE_SESSION_ID: undefined };
  return spawnSync(process.execPath, [path.join(projectRoot, 'sdlc/.hooks', script)], {
    cwd: projectRoot, input: JSON.stringify(stdinObj), encoding: 'utf8', env,
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
  // Row 21 — an unsafe id is refused, not stripped: stripping would alias `a/b` onto `ab`
  // and hand one session's seen-steering list to another.
  const stateEntries = fs.readdirSync(path.join(dir, 'sdlc/.state'));
  const stateFiles = stateEntries.filter((f) => f.startsWith('pointers-'));
  assert.deepEqual(stateFiles, ['pointers-nosession.json']);
  assert.ok(!stateEntries.some((f) => f.includes('evil')), 'no .state entry may be named from the unsafe id');
  assert.ok(!fs.existsSync(path.join(dir, '..', 'evil')), 'no traversal outside .state');
});

test('frontmatter: __proto__/constructor keys are ignored', () => {
  const { data } = parseFrontmatter('---\n__proto__: [1, 2]\nconstructor: x\nid: ok\n---\n');
  assert.equal(Object.prototype.hasOwnProperty.call(data, '__proto__'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(data, 'constructor'), false);
  assert.equal(data.id, 'ok');
  assert.equal(typeof data.map, 'undefined');
});

// Row 13: Given env session id hostile values · when set-active x runs
// then no file created outside .state/sessions/, active.json names x, status source is project
test('row 13: hostile session id rejected, active.json uses fallback, status source project', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  writeChange(dir, 'x', { body: STANDARD_BODY });

  const hostileIds = ['../evil', 'a/b', 'a\\b', 'a:b', '..', 'CON', 'con', 'x.', 'x ', ''];
  for (const hostile of hostileIds) {
    // Reset .state/ but keep what init needs
    const stateDir = path.join(dir, 'sdlc/.state');
    if (fs.existsSync(stateDir)) {
      fs.rmSync(stateDir, { recursive: true, force: true });
    }

    // Run journal.mjs set-active x with hostile session id
    const hookRes = runHookWith(dir, 'journal.mjs', {
      args: ['set-active', 'x'],
      env: { CLAUDE_CODE_SESSION_ID: hostile },
    });
    assert.equal(hookRes.status, 0, `journal.mjs set-active should exit 0 for hostile id "${hostile}"`);

    // Check no file created for the hostile id in .state/sessions/
    const sessionsDir = path.join(dir, 'sdlc/.state/sessions');
    if (fs.existsSync(sessionsDir)) {
      const files = fs.readdirSync(sessionsDir);
      assert.equal(files.length, 0, `no session files should exist for hostile id "${hostile}"`);
    }

    // Check no files outside the project root (look for 'evil' in parent)
    const parentDir = path.dirname(dir);
    const parentContents = fs.readdirSync(parentDir);
    assert.ok(!parentContents.includes('evil'), 'no traversal files should exist outside project');

    // `../evil` would resolve out of sessions/ into .state/ itself — nothing but the
    // project pointer (and an empty sessions/ dir, if any) may appear there.
    const stray = fs.readdirSync(path.join(dir, 'sdlc/.state'))
      .filter((f) => f !== 'active.json' && f !== 'sessions');
    assert.deepEqual(stray, [], `unexpected .state entries for hostile id "${hostile}"`);

    // active.json must name x (project-wide pointer)
    const activeJson = path.join(dir, 'sdlc/.state/active.json');
    assert.ok(fs.existsSync(activeJson), 'active.json should exist');
    const active = JSON.parse(fs.readFileSync(activeJson, 'utf8'));
    assert.equal(active.change, 'x', `active.json should name x for hostile id "${hostile}"`);

    // status --json should report current = {x, project}
    const statusRes = runCli(dir, ['status', '--json'], { env: { CLAUDE_CODE_SESSION_ID: hostile } });
    assert.equal(statusRes.status, 0, statusRes.stderr);
    const statusData = JSON.parse(statusRes.stdout);
    assert.deepStrictEqual(statusData.current, { id: 'x', source: 'project' },
      `status should show project source for hostile id "${hostile}"`);
  }
});

// Row 14: Given .state/hijack.json = {change: b} and session id ../hijack
// when status runs and hook runs with that stdin · then b not reported current and hook doesn't attribute to b
test('row 14: path traversal session id cannot hijack different change pointer', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  writeChange(dir, 'a', { body: STANDARD_BODY });
  writeChange(dir, 'b', { body: STANDARD_BODY });

  // Create a hijack file at .state/ level (to trick a naive implementation)
  fs.mkdirSync(path.join(dir, 'sdlc/.state'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'sdlc/.state/hijack.json'), JSON.stringify({ change: 'b' }));

  // Set project pointer to a
  const stateDir = path.join(dir, 'sdlc/.state');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, 'active.json'), JSON.stringify({ change: 'a' }));

  // Try to access with ../hijack session id - status must not report b as current
  const statusRes = runCli(dir, ['status', '--json'], { env: { CLAUDE_CODE_SESSION_ID: '../hijack' } });
  assert.equal(statusRes.status, 0, statusRes.stderr);
  const jsonData = JSON.parse(statusRes.stdout);
  // Must assert current is a/project, not b
  assert.deepStrictEqual(jsonData.current, { id: 'a', source: 'project' },
    'status must report project pointer a, not hijacked b');

  // Hook receiving ../hijack in stdin (journal.mjs note) should not attribute to b
  const noteRes = runHookWith(dir, 'journal.mjs', {
    args: ['note', 'probe'],
    stdin: { session_id: '../hijack' },
  });
  assert.equal(noteRes.status, 0, 'hook should exit 0 on hostile session_id');

  // Event should land in a's journal (project pointer), not b's
  const aJournal = path.join(dir, 'sdlc/.state/journal/a.ndjson');
  assert.ok(fs.existsSync(aJournal), 'a journal should exist');
  const aEvents = fs.readFileSync(aJournal, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  assert.ok(aEvents.some(e => e.event === 'probe'), 'event should land in a journal (project pointer)');

  const bJournal = path.join(dir, 'sdlc/.state/journal/b.ndjson');
  assert.ok(!fs.existsSync(bJournal), 'b journal should not be created');

  // Test with session-summary as well
  const summaryRes = runHookWith(dir, 'session-summary.mjs', {
    stdin: {
      hook_event_name: 'Stop',
      session_id: '../hijack',
      transcript_path: writeTranscript(dir),
    },
  });
  assert.equal(summaryRes.status, 0, 'session-summary should exit 0');

  // Event should still land in a journal, not b
  const aEvents2 = fs.readFileSync(aJournal, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  assert.ok(aEvents2.some(e => e.event === 'session'), 'session-summary should land in a journal');
});

// Row 15: Given hostile stdin session_id on guard-writes / validate-artifact
// when they run · then exit 0 and write nothing under .state/sessions/
test('row 15: hostile session_id in stdin rejected safely by guard-writes and validate-artifact', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  fs.writeFileSync(path.join(dir, 'sdlc/context/steering/db.md'),
    '---\nname: db\ninclusion: paths\npathMatch: ["src/**"]\n---\n# S\n- x\n');

  // guard-writes with hostile session_id
  const guardRes = runHookWith(dir, 'guard-writes.mjs', {
    stdin: {
      tool_name: 'Edit',
      tool_input: { file_path: path.join(dir, 'sdlc/specs/auth/spec.md') },
      session_id: '../../../evil',
    },
  });
  assert.equal(guardRes.status, 0, 'guard-writes should exit 0 with hostile session_id');

  // validate-artifact with hostile session_id
  const validateRes = runHookWith(dir, 'validate-artifact.mjs', {
    stdin: {
      tool_name: 'Edit',
      tool_input: { file_path: path.join(dir, 'src/a.js') },
      session_id: '..\\..\\evil',
    },
  });
  assert.equal(validateRes.status, 0, 'validate-artifact should exit 0 with hostile session_id');

  // No session file should be created for these hostile ids
  const sessionsDir = path.join(dir, 'sdlc/.state/sessions');
  if (fs.existsSync(sessionsDir)) {
    const files = fs.readdirSync(sessionsDir);
    assert.equal(files.length, 0, 'no session files should be created for hostile ids');
  }
});

// Row 18 — on a case-insensitive filesystem `changes/ARCHIVE` opens the archive folder,
// so a pointer spelling it in any case must never make the archive the active change.
test('row 18: a pointer naming the archive folder in any case is never the active change', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const sdlcRoot = path.join(dir, 'sdlc');
  for (const spelling of ['archive', 'ARCHIVE', 'Archive']) {
    for (const file of ['active.json', 'sessions/s1.json']) {
      fs.rmSync(path.join(sdlcRoot, '.state/sessions'), { recursive: true, force: true });
      fs.rmSync(path.join(sdlcRoot, '.state/active.json'), { force: true });
      fs.mkdirSync(path.dirname(path.join(sdlcRoot, '.state', file)), { recursive: true });
      fs.writeFileSync(path.join(sdlcRoot, '.state', file), JSON.stringify({ change: spelling }));
      assert.equal(resolveActive(sdlcRoot, { sessionId: 's1' }), null,
        `"${spelling}" in ${file} must not resolve to the archive folder`);
    }
  }
});

// Row 19 — pointer reads and writes must never follow a planted link out of the project.
// Junctions stand in for directory symlinks so this runs on Windows without privilege.
test('row 19: a planted .state or sessions link cannot redirect a pointer read or write', (t) => {
  const setup = () => {
    const dir = makeTempProject(t);
    runCli(dir, ['init', '--tool', 'claude']);
    writeChange(dir, 'a', { body: STANDARD_BODY });
    writeChange(dir, 'b', { body: STANDARD_BODY });
    const outside = fs.mkdtempSync(path.join(path.dirname(dir), 'outside-'));
    t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
    return { dir, outside };
  };
  const setActiveAs = (dir, sid) => runHookWith(dir, 'journal.mjs', {
    args: ['set-active', 'a'], env: { CLAUDE_CODE_SESSION_ID: sid },
  });
  const statusAs = (dir, sid) => runCli(dir, ['status', '--json'], { env: { CLAUDE_CODE_SESSION_ID: sid } });

  // (1) .state/sessions is a link to an outside directory
  {
    const { dir, outside } = setup();
    fs.mkdirSync(path.join(dir, 'sdlc/.state'), { recursive: true });
    fs.symlinkSync(outside, path.join(dir, 'sdlc/.state/sessions'), 'junction');
    assert.equal(setActiveAs(dir, 's1').status, 0);
    assert.deepEqual(fs.readdirSync(outside), [], 'session pointer written through the sessions link');
    const res = statusAs(dir, 's1');
    assert.equal(res.status, 0, res.stderr);
    // The project pointer still landed inside .state/, so it — not a session pointer — answers.
    assert.deepStrictEqual(JSON.parse(res.stdout).current, { id: 'a', source: 'project' },
      'a pointer behind a redirected sessions dir must not count as this session\'s');
  }

  // (2) .state itself is a link to an outside directory
  {
    const { dir, outside } = setup();
    fs.rmSync(path.join(dir, 'sdlc/.state'), { recursive: true, force: true });
    fs.symlinkSync(outside, path.join(dir, 'sdlc/.state'), 'junction');
    const setRes = setActiveAs(dir, 's1');
    assert.equal(setRes.status, 0);
    // A refused write must say so — claiming success would hide exactly what the guard did.
    assert.match(setRes.stderr, /not recorded/, 'set-active must report a pointer it could not write');
    assert.doesNotMatch(setRes.stdout, /active change: a/, 'set-active must not claim success');
    const leaked = fs.readdirSync(outside).filter((f) => f === 'active.json' || f === 'sessions');
    assert.deepEqual(leaked, [], 'pointer written through a redirected .state');
    // Neither pointer could be written or read, and the mtime fallback is never "current".
    const res = statusAs(dir, 's1');
    assert.equal(res.status, 0, res.stderr);
    assert.equal(JSON.parse(res.stdout).current, null, 'no pointer may answer through a redirected .state');
  }

  // (4) a pointer file is a DANGLING link to an outside path: `existsSync` reports it absent,
  // so a write that only checks existing entries would create the link's target outside.
  {
    const { dir, outside } = setup();
    const sessionTarget = path.join(outside, 'created-via-session-link.json');
    const projectTarget = path.join(outside, 'created-via-project-link.json');
    fs.mkdirSync(path.join(dir, 'sdlc/.state/sessions'), { recursive: true });
    fs.rmSync(path.join(dir, 'sdlc/.state/active.json'), { force: true });
    let linked = true;
    try {
      fs.symlinkSync(sessionTarget, path.join(dir, 'sdlc/.state/sessions/s1.json'), 'file');
      fs.symlinkSync(projectTarget, path.join(dir, 'sdlc/.state/active.json'), 'file');
    } catch (err) {
      if (err.code !== 'EPERM') throw err;
      linked = false;
      t.diagnostic('file symlinks need privilege here; case 4 skipped');
    }
    if (linked) {
      assert.equal(setActiveAs(dir, 's1').status, 0);
      assert.ok(!fs.existsSync(sessionTarget), 'session pointer written through a dangling link');
      assert.ok(!fs.existsSync(projectTarget), 'project pointer written through a dangling link');
    }
  }

  // (3) the session pointer file itself links to an outside file naming b
  {
    const { dir, outside } = setup();
    const target = path.join(outside, 'evil.json');
    fs.writeFileSync(target, JSON.stringify({ change: 'b' }));
    fs.mkdirSync(path.join(dir, 'sdlc/.state/sessions'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'sdlc/.state/active.json'), JSON.stringify({ change: 'a' }));
    try {
      fs.symlinkSync(target, path.join(dir, 'sdlc/.state/sessions/s1.json'), 'file');
    } catch (err) {
      if (err.code === 'EPERM') { t.diagnostic('file symlinks need privilege here; case 3 skipped'); return; }
      throw err;
    }
    const res = statusAs(dir, 's1');
    assert.equal(res.status, 0, res.stderr);
    assert.deepStrictEqual(JSON.parse(res.stdout).current, { id: 'a', source: 'project' },
      'a session pointer that links outside .state must not be read');
  }
});

// Row 20 — a pointer the resolver would ignore must not be written and reported as done.
test('row 20: set-active refuses an unsafe, missing or archived change id and touches no pointer', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  writeChange(dir, 'x', { body: STANDARD_BODY });
  const state = path.join(dir, 'sdlc/.state');
  const setActiveAs = (id) => runHookWith(dir, 'journal.mjs', {
    args: ['set-active', id], env: { CLAUDE_CODE_SESSION_ID: 's1' },
  });
  const pointers = () => ({
    project: fs.existsSync(path.join(state, 'active.json')) ? fs.readFileSync(path.join(state, 'active.json'), 'utf8') : null,
    sessions: fs.existsSync(path.join(state, 'sessions'))
      ? fs.readdirSync(path.join(state, 'sessions')).map((f) => [f, fs.readFileSync(path.join(state, 'sessions', f), 'utf8')])
      : [],
  });
  const bad = ['../x', 'a/b', 'CON', 'nope', 'archive'];

  for (const id of bad) {
    const res = setActiveAs(id);
    assert.equal(res.status, 2, `set-active "${id}" must fail with a usage error`);
    assert.ok(res.stderr.trim(), `set-active "${id}" must say why on stderr`);
    assert.deepEqual(pointers(), { project: null, sessions: [] }, `set-active "${id}" must create no pointer`);
  }

  assert.equal(setActiveAs('x').status, 0, 'an open change can still be made active');
  const before = pointers();
  for (const id of bad) {
    assert.equal(setActiveAs(id).status, 2);
    assert.deepEqual(pointers(), before, `set-active "${id}" must leave existing pointers unchanged`);
  }
});

// Row 8: project skill/agent linked to outside folder are not listed
test('row 8: skills command skips project skill/agent linked outside project; no outside text printed, exit 0', (t) => {
  const projectDir = makeTempProject(t);
  const outside = fs.mkdtempSync(path.join(projectDir, '..', 'outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));

  // Create a skill outside the project
  const outsideSkillDir = path.join(outside, 'outside-skill');
  fs.mkdirSync(outsideSkillDir);
  fs.writeFileSync(path.join(outsideSkillDir, 'SKILL.md'), '---\nname: outside-skill\ndescription: dangerous\n---\n# Skill');

  // Create an agent file outside the project
  const outsideAgent = path.join(outside, 'outside-agent.md');
  fs.writeFileSync(outsideAgent, '---\nname: outside-agent\ndescription: dangerous\n---\n# Agent');

  // Try to plant links to them in the project
  const projectSkillsDir = path.join(projectDir, '.claude/skills');
  fs.mkdirSync(projectSkillsDir, { recursive: true });
  const projectAgentsDir = path.join(projectDir, '.claude/agents');
  fs.mkdirSync(projectAgentsDir, { recursive: true });

  let linkedSkill = true;
  let linkedAgent = true;

  try {
    fs.symlinkSync(outsideSkillDir, path.join(projectSkillsDir, 'evil'), 'junction');
  } catch (err) {
    if (err.code === 'EPERM') {
      t.skip('junction creation not permitted; skipping link test');
      linkedSkill = false;
    } else {
      throw err;
    }
  }

  if (linkedSkill) {
    try {
      fs.symlinkSync(outsideAgent, path.join(projectAgentsDir, 'evil.md'), 'file');
    } catch (err) {
      if (err.code === 'EPERM') {
        linkedAgent = false;
      } else {
        throw err;
      }
    }
  }

  if (!linkedSkill && !linkedAgent) {
    t.skip('symlink creation not permitted; skipping link test');
    return;
  }

  const res = runCli(projectDir, ['skills', '--json'], { env: { HOME: emptyHome(t), USERPROFILE: emptyHome(t) } });
  assert.equal(res.status, 0);
  assert.doesNotMatch(res.stdout, /outside-skill/);
  assert.doesNotMatch(res.stdout, /outside-agent/);
  assert.doesNotMatch(res.stdout, /dangerous/);

  const data = JSON.parse(res.stdout);
  assert.equal(data.entries.length, 0, 'linked outside entries should not be listed');
});

// Row 9: .claude itself linked to outside folder
test('row 9: when .claude folder is linked outside the project, no project entries are listed, exit 0', (t) => {
  const projectDir = makeTempProject(t);
  const outside = fs.mkdtempSync(path.join(projectDir, '..', 'outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));

  // Create some skills and agents inside the outside directory
  const outsideSkillDir = path.join(outside, 'skills', 'outside-skill');
  fs.mkdirSync(outsideSkillDir, { recursive: true });
  fs.writeFileSync(path.join(outsideSkillDir, 'SKILL.md'), '---\nname: outside-skill\ndescription: dangerous\n---\n# Skill');

  const outsideAgentDir = path.join(outside, 'agents');
  fs.mkdirSync(outsideAgentDir, { recursive: true });
  fs.writeFileSync(path.join(outsideAgentDir, 'outside-agent.md'), '---\nname: outside-agent\ndescription: dangerous\n---\n# Agent');

  // Remove .claude if it exists and replace with a link
  const claudeDir = path.join(projectDir, '.claude');
  if (fs.existsSync(claudeDir)) {
    fs.rmSync(claudeDir, { recursive: true });
  }

  let linked = true;
  try {
    fs.symlinkSync(outside, claudeDir, 'junction');
  } catch (err) {
    if (err.code === 'EPERM') {
      t.skip('junction creation not permitted; skipping link test');
      linked = false;
    } else {
      throw err;
    }
  }

  if (!linked) return;

  const res = runCli(projectDir, ['skills', '--json'], { env: { HOME: emptyHome(t), USERPROFILE: emptyHome(t) } });
  assert.equal(res.status, 0);
  assert.doesNotMatch(res.stdout, /outside-skill/);
  assert.doesNotMatch(res.stdout, /outside-agent/);

  const data = JSON.parse(res.stdout);
  // No project entries should be listed since .claude points outside
  const projectEntries = data.entries.filter((e) => e.source === 'project');
  assert.equal(projectEntries.length, 0, 'no project entries should be listed when .claude is outside');
});

// Row 10: home skill folder linked to elsewhere IS listed (user-level links are allowed)
test('row 10: home skill folder linked to elsewhere IS listed with source: user (user links are ok)', (t) => {
  const projectDir = makeTempProject(t);
  const homeDir = fs.mkdtempSync(path.join(projectDir, '..', 'home-'));
  t.after(() => fs.rmSync(homeDir, { recursive: true, force: true }));

  const elsewhere = fs.mkdtempSync(path.join(projectDir, '..', 'elsewhere-'));
  t.after(() => fs.rmSync(elsewhere, { recursive: true, force: true }));

  // Create a skill elsewhere
  const elsewhereSkillDir = path.join(elsewhere, 'linked-skill');
  fs.mkdirSync(elsewhereSkillDir);
  fs.writeFileSync(path.join(elsewhereSkillDir, 'SKILL.md'), '---\nname: linked-skill\ndescription: linked from elsewhere\n---\n# Skill');

  // Link to it from home
  const homeSkillsDir = path.join(homeDir, '.claude/skills');
  fs.mkdirSync(homeSkillsDir, { recursive: true });

  let linked = true;
  try {
    fs.symlinkSync(elsewhereSkillDir, path.join(homeSkillsDir, 'linked-skill'), 'junction');
  } catch (err) {
    if (err.code === 'EPERM') {
      t.skip('junction creation not permitted; skipping link test');
      linked = false;
    } else {
      throw err;
    }
  }

  if (!linked) return;

  const res = runCli(projectDir, ['skills', '--json'], { env: { HOME: homeDir, USERPROFILE: homeDir } });
  assert.equal(res.status, 0);

  const data = JSON.parse(res.stdout);
  const linkedEntry = data.entries.find((e) => e.name === 'linked-skill');
  assert.ok(linkedEntry, 'linked home skill should be listed');
  assert.equal(linkedEntry.source, 'user', 'linked home skill should have source: user');
});

// update-notice row 24: `.state/` is gitignored but can ship as a link. The update check must
// not write its cache (or a temp file) through it, and must not spawn a request it cannot record.
// Each case also proves the hook ran (constitution injected), and a real `.state/` control shows
// the same setup does send a request — so a crashing hook cannot pass this.
test('row 24: update check never writes through a symlinked sdlc/.state', async (t) => {
  const http = await import('node:http');
  const hits = [];
  const server = http.createServer((req, res) => { hits.push(req.url); res.end('{"version":"0.10.0"}'); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => { server.closeAllConnections?.(); server.close(); });
  const env = { NO_UPDATE_NOTIFIER: undefined, CI: undefined, WARNYIN_SDLC_REGISTRY_URL: `http://127.0.0.1:${server.address().port}` };
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'wsdlc-state-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));

  const setup = (link) => {
    const dir = makeTempProject(t);
    runCli(dir, ['init', '--tool', 'claude'], { env: { NO_UPDATE_NOTIFIER: '1' } });
    fs.writeFileSync(path.join(dir, 'sdlc/context/constitution.md'), '# Constitution — linked\n');
    fs.rmSync(path.join(dir, 'sdlc/.state'), { recursive: true, force: true });
    if (link) fs.symlinkSync(link(dir), path.join(dir, 'sdlc/.state'));
    else fs.mkdirSync(path.join(dir, 'sdlc/.state'));
    return dir;
  };
  const cases = {
    outside: () => outside,
    dangling: (dir) => path.join(dir, 'no-such-dir'),
    'inside project': (dir) => { fs.mkdirSync(path.join(dir, 'elsewhere')); return path.join(dir, 'elsewhere'); },
  };
  for (const [name, link] of Object.entries(cases)) {
    const dir = setup(link);
    const res = runHookWith(dir, 'inject-context.mjs', { stdin: { hook_event_name: 'SessionStart' }, env });
    assert.equal(res.status, 0, name);
    assert.match(res.stdout, /Constitution — linked/, `${name}: hook did not run to completion`);
    const target = name === 'inside project' ? path.join(dir, 'elsewhere') : outside;
    assert.deepEqual(fs.readdirSync(target).filter((f) => f.startsWith('update-check')), [], name);
  }
  await new Promise((r) => setTimeout(r, 1500));
  assert.equal(hits.length, 0, 'a check it could not record must not be sent');

  const control = setup(null);
  runHookWith(control, 'inject-context.mjs', { stdin: { hook_event_name: 'SessionStart' }, env });
  const deadline = Date.now() + 5000;
  while (hits.length === 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  assert.equal(hits.length, 1, 'a real .state/ must still check');
});

// ---- change-artifacts rows 5-10 and 18: the artifact stamp and validate refuse names, paths and
// links they must not follow. Each refusal runs a valid name on the same fixture as its control.

function caProject(t) {
  const root = makeTempProject(t);
  assert.equal(runCli(root, ['init', '--tool', 'claude']).status, 0);
  return root;
}

// Refused by the OS (no privilege, no developer mode) comes back as the error, not a throw.
function caLink(target, link, type) {
  try {
    fs.symlinkSync(target, link, type);
    return null;
  } catch (err) {
    return err;
  }
}

// A file symlink goes by unlink; a directory link (or a Windows junction) only by rmdir.
function caUnlink(link) {
  try { fs.unlinkSync(link); } catch { fs.rmdirSync(link); }
}

// Every entry under dir, sorted; links are listed, never followed.
function caTree(dir) {
  const out = [];
  const walk = (abs, rel) => {
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = path.join(rel, e.name);
      out.push(r);
      if (e.isDirectory()) walk(path.join(abs, e.name), r);
    }
  };
  walk(dir, '');
  return out.sort();
}

const caWarns = (text) => text.split(/\r?\n/).filter((l) => l.startsWith('⚠'));

function caOutside(t, root) {
  const outside = fs.mkdtempSync(path.join(root, '..', 'outside-art-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  return outside;
}

function caPlan(dir) {
  fs.mkdirSync(path.join(dir, 'artifact'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'artifact', 'plan.html'), '<p>plan</p>\n');
}

test('change-artifacts row 5: a name that is not an artifact name is refused, named, and change.md stays byte-identical', (t) => {
  const root = caProject(t);
  const dir = writeChange(root, 'names', { body: STANDARD_BODY });
  caPlan(dir);
  const file = path.join(dir, 'change.md');
  const before = fs.readFileSync(file);
  const names = ['a/b.md', '..\\x.md', '../x.md', 'C:\\x.md', 'x.exe', 'Plan.HTML', 'plan.html.',
    'plan.html ', 'plan.html:x', 'pl\u0430n.html', 'plan\uFF0Ehtml', ''];
  for (const name of names) {
    const label = JSON.stringify(name);
    const res = runCli(root, ['artifact', 'names', name]);
    assert.notEqual(res.status, 0, `${label} must be refused`);
    assert.match(res.stderr, /not an artifact name/, `${label}: stderr must say it is not an artifact name`);
    if (name) assert.ok(res.stderr.includes(name), `${label}: stderr must echo the name`);
    assert.ok(fs.readFileSync(file).equals(before), `${label}: change.md must stay byte-identical`);
  }
  // Positive control on the same fixture.
  assert.equal(runCli(root, ['artifact', 'names', 'plan.html']).status, 0);
});

test('change-artifacts row 6: an absent artifact or a directory is refused naming the file and its own reason; nothing is written', (t) => {
  const root = caProject(t);
  const dir = writeChange(root, 'nothing', { body: STANDARD_BODY });
  caPlan(dir);
  const sdlc = path.join(root, 'sdlc');
  const refuse = (name, why) => {
    const before = caTree(sdlc);
    const res = runCli(root, ['artifact', 'nothing', name]);
    assert.notEqual(res.status, 0, `${name} must be refused`);
    assert.ok(res.stderr.includes(name), `${name}: stderr must name the file, got ${res.stderr}`);
    assert.match(res.stderr, why, `${name}: stderr must say why`);
    assert.deepEqual(caTree(sdlc), before, `${name}: nothing may be created or changed`);
  };
  refuse('x.md', /is missing/);
  fs.mkdirSync(path.join(dir, 'artifact', 'x.md'));
  refuse('x.md', /is not a regular file/);
  assert.equal(runCli(root, ['artifact', 'nothing', 'plan.html']).status, 0, 'control: plan.html stamps');
  // A change with no artifact/ folder at all: refused as missing, and the folder is not created.
  writeChange(root, 'no-folder', { body: STANDARD_BODY });
  const before = caTree(sdlc);
  const res = runCli(root, ['artifact', 'no-folder', 'x.md']);
  assert.notEqual(res.status, 0, 'no artifact/ folder must be refused');
  assert.ok(res.stderr.includes('artifact/x.md'), `stderr must name the file, got ${res.stderr}`);
  assert.match(res.stderr, /folder .* is missing/, 'stderr must say the artifact/ folder is missing');
  assert.deepEqual(caTree(sdlc), before, 'no artifact/ folder may be created');
});

test('change-artifacts row 6: a symlink artifact/x.md to a file outside the project is refused and nothing is followed or written', (t) => {
  const root = caProject(t);
  const dir = writeChange(root, 'linked-file', { body: STANDARD_BODY });
  caPlan(dir);
  const outside = caOutside(t, root);
  const secret = path.join(outside, 'x.md');
  fs.writeFileSync(secret, 'OUTSIDE\n');
  const link = path.join(dir, 'artifact', 'x.md');
  const err = caLink(secret, link, 'file');
  if (err) { t.skip(`cannot create a symlink here (${err.code})`); return; }
  const changeBytes = fs.readFileSync(path.join(dir, 'change.md'));
  const secretBytes = fs.readFileSync(secret);
  const res = runCli(root, ['artifact', 'linked-file', 'x.md']);
  assert.notEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(res.stderr.includes('x.md'), `stderr must name x.md, got ${res.stderr}`);
  assert.match(res.stderr, /is a symlink/, 'stderr must say artifact/x.md is a symlink');
  assert.ok(fs.readFileSync(path.join(dir, 'change.md')).equals(changeBytes), 'change.md must be unchanged');
  assert.ok(fs.readFileSync(secret).equals(secretBytes), 'the outside file must be byte-identical');
  // Positive control: the same change with a regular x.md stamps.
  caUnlink(link);
  fs.writeFileSync(path.join(dir, 'artifact', 'x.md'), '# x\n');
  assert.equal(runCli(root, ['artifact', 'linked-file', 'x.md']).status, 0, 'control: a regular x.md stamps');
});

// artifact/ itself a link to a directory outside the project. A Windows junction is the same
// shape, so the junction case calls symlinkSync directly and never skips.
function caDirLinkRefusal(t, type, { skipOnRefusal }) {
  const root = caProject(t);
  const dir = writeChange(root, 'linked-dir', { body: STANDARD_BODY });
  const outside = caOutside(t, root);
  fs.writeFileSync(path.join(outside, 'x.md'), 'OUTSIDE\n');
  const link = path.join(dir, 'artifact');
  const err = caLink(outside, link, type);
  if (err) {
    if (skipOnRefusal) { t.skip(`cannot create a ${type} here (${err.code})`); return; }
    throw err;
  }
  const changeBytes = fs.readFileSync(path.join(dir, 'change.md'));
  const outsideBytes = fs.readFileSync(path.join(outside, 'x.md'));
  const res = runCli(root, ['artifact', 'linked-dir', 'x.md']);
  assert.notEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(res.stderr.includes('x.md'), `stderr must name x.md, got ${res.stderr}`);
  assert.match(res.stderr, /is not a real directory/, 'stderr must say artifact/ is not a real directory');
  assert.ok(fs.readFileSync(path.join(dir, 'change.md')).equals(changeBytes), 'change.md must be unchanged');
  assert.ok(fs.readFileSync(path.join(outside, 'x.md')).equals(outsideBytes), 'the outside file must be byte-identical');
  // Positive control: the same change with a real artifact/ directory stamps.
  caUnlink(link);
  fs.mkdirSync(link);
  fs.writeFileSync(path.join(link, 'x.md'), '# x\n');
  assert.equal(runCli(root, ['artifact', 'linked-dir', 'x.md']).status, 0, 'control: a real artifact/ stamps');
}

test('change-artifacts row 6: an artifact/ symlink to a directory outside the project is refused and nothing is written', (t) => {
  caDirLinkRefusal(t, 'dir', { skipOnRefusal: true });
});

test('change-artifacts row 6: an artifact/ Windows junction to a directory outside the project is refused and nothing is written', (t) => {
  caDirLinkRefusal(t, 'junction', { skipOnRefusal: false });
});

test('change-artifacts row 7: an archive, a traversal, an absent or an archived id is refused naming the id and creates nothing under sdlc/changes/', (t) => {
  const root = caProject(t);
  const dir = writeChange(root, 'open-one', { body: STANDARD_BODY });
  caPlan(dir);
  const archived = path.join(root, 'sdlc', 'changes', 'archive', '2026-01-01-old-one');
  fs.mkdirSync(path.join(archived, 'artifact'), { recursive: true });
  fs.writeFileSync(path.join(archived, 'change.md'), STANDARD_BODY);
  fs.writeFileSync(path.join(archived, 'artifact', 'plan.html'), '<p>plan</p>\n');
  // changes/archive/change.md exists, so only the id rule can refuse the id `archive`.
  fs.writeFileSync(path.join(root, 'sdlc', 'changes', 'archive', 'change.md'), STANDARD_BODY);
  const sdlc = path.join(root, 'sdlc');
  const cases = [
    ['archive', /not a change id/],
    ['../x', /not a change id/],
    ['absent-id', /not an open change/],
    ['2026-01-01-old-one', /not an open change/],
  ];
  for (const [id, why] of cases) {
    const before = caTree(sdlc);
    const res = runCli(root, ['artifact', id, 'plan.html']);
    assert.notEqual(res.status, 0, `${id} must be refused`);
    assert.ok(res.stderr.includes(id), `${id}: stderr must name the id, got ${res.stderr}`);
    assert.match(res.stderr, why, `${id}: stderr must say why`);
    assert.deepEqual(caTree(sdlc), before, `${id}: nothing may be created under sdlc/changes/`);
  }
  assert.equal(runCli(root, ['artifact', 'open-one', 'plan.html']).status, 0, 'control: an open id stamps');
});

test('change-artifacts row 8: two ## Artifacts sections are refused as more than once, change.md byte-identical', (t) => {
  const root = caProject(t);
  const twice = `${STANDARD_BODY}## Artifacts\n- [a](artifact/plan.html)\n\n## Artifacts\n`;
  const dir = writeChange(root, 'twice', { body: twice });
  caPlan(dir);
  const file = path.join(dir, 'change.md');
  const before = fs.readFileSync(file);
  const res = runCli(root, ['artifact', 'twice', 'plan.html']);
  assert.notEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(res.stderr.includes('## Artifacts'), `stderr must name ## Artifacts, got ${res.stderr}`);
  assert.match(res.stderr, /more than once/, 'stderr must say it appears more than once');
  assert.ok(fs.readFileSync(file).equals(before), 'change.md must be byte-identical');
  // Positive control: the same change with the second section removed stamps.
  const text = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, text.slice(0, text.lastIndexOf('## Artifacts')));
  assert.equal(runCli(root, ['artifact', 'twice', 'plan.html']).status, 0, 'control: one section stamps');
});

test('change-artifacts row 9: a change.md that is a symlink out of the project is refused naming the change; the outside file is byte-identical', (t) => {
  const root = caProject(t);
  const dir = path.join(root, 'sdlc', 'changes', 'linked-md');
  caPlan(dir);
  const outside = caOutside(t, root);
  const outsideFile = path.join(outside, 'change.md');
  fs.writeFileSync(outsideFile, STANDARD_BODY);
  const err = caLink(outsideFile, path.join(dir, 'change.md'), 'file');
  if (err) { t.skip(`cannot create a symlink here (${err.code})`); return; }
  const bytes = fs.readFileSync(outsideFile);
  const res = runCli(root, ['artifact', 'linked-md', 'plan.html']);
  assert.notEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(res.stderr.includes('linked-md'), `stderr must name the change, got ${res.stderr}`);
  assert.match(res.stderr, /does not really resolve/, 'stderr must say the change does not really resolve');
  assert.ok(fs.readFileSync(outsideFile).equals(bytes), 'the outside file must be byte-identical');
  // Positive control: the same change with a regular change.md stamps.
  caUnlink(path.join(dir, 'change.md'));
  writeChange(root, 'linked-md', { body: STANDARD_BODY });
  assert.equal(runCli(root, ['artifact', 'linked-md', 'plan.html']).status, 0, 'control: a regular change.md stamps');
});

test('change-artifacts row 10: a read-only change.md is refused naming the change and the failed write, with no success line', (t) => {
  const root = caProject(t);
  const dir = writeChange(root, 'readonly', { body: STANDARD_BODY });
  caPlan(dir);
  const file = path.join(dir, 'change.md');
  fs.chmodSync(file, 0o444);
  // The temp project may already be gone when this runs (its own cleanup is registered first).
  t.after(() => { try { fs.chmodSync(file, 0o644); } catch { /* already removed */ } });
  const res = runCli(root, ['artifact', 'readonly', 'plan.html']);
  assert.notEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(res.stderr.includes('readonly'), `stderr must name the change, got ${res.stderr}`);
  assert.match(res.stderr, /write/i, 'stderr must name the failed write');
  assert.doesNotMatch(res.stdout, /artifact\/plan\.html/, 'stdout must carry no success line');
  // Positive control: the same change, writable again, stamps.
  fs.chmodSync(file, 0o644);
  assert.equal(runCli(root, ['artifact', 'readonly', 'plan.html']).status, 0, 'control: a writable change.md stamps');
});

test('change-artifacts row 18: listed paths that escape or are not allowed each warn once and never fail validate, plain or --strict', (t) => {
  const root = caProject(t);
  const dir = writeChange(root, 'escapes', {
    body: `${STANDARD_BODY}## Artifacts\n- ../x.md\n- /etc/x.md\n- C:\\x.md\n- artifact/sub/x.md\n`
      + '- artifact/./x.md\n- artifact//x.md\n- artifact/x.exe\n- artifact/ok.md\n',
  });
  fs.mkdirSync(path.join(dir, 'artifact'));
  fs.writeFileSync(path.join(dir, 'artifact', 'ok.md'), '# ok\n');
  // Present on disk, so only the extension rule can make it warn — not its absence.
  fs.writeFileSync(path.join(dir, 'artifact', 'x.exe'), 'MZ\n');
  // `../x.md` from artifact/ resolves to sdlc/changes/x.md: a real file that must never be touched.
  const real = path.join(root, 'sdlc', 'changes', 'x.md');
  fs.writeFileSync(real, 'REAL FILE, NOT AN ARTIFACT\n');
  const realBytes = fs.readFileSync(real);
  for (const args of [['validate', 'escapes'], ['validate', 'escapes', '--strict']]) {
    const label = args.join(' ');
    const res = runCli(root, args);
    assert.equal(res.status, 0, `${label} must exit 0: ${res.stdout}${res.stderr}`);
    const warns = caWarns(res.stdout + res.stderr);
    for (const p of ['../x.md', '/etc/x.md', 'C:\\x.md', 'artifact/sub/x.md', 'artifact/./x.md', 'artifact//x.md', 'artifact/x.exe']) {
      const hits = warns.filter((l) => l.includes(p));
      assert.equal(hits.length, 1, `${label}: ${p}: exactly one warn line naming it, got ${JSON.stringify(hits)}`);
      assert.match(hits[0], /not an artifact path/, `${label}: ${p}: the warning must say it is not an artifact path`);
    }
    assert.equal(warns.filter((l) => l.includes('ok.md')).length, 0, `${label}: control: a regular, allowed listed file does not warn`);
    assert.ok(fs.readFileSync(real).equals(realBytes), `${label}: sdlc/changes/x.md must stay byte-identical`);
  }
});

test('change-artifacts row 18: a dangling symlink and a symlink to an outside file each warn once and are never opened', (t) => {
  const root = caProject(t);
  const dir = writeChange(root, 'links', {
    body: `${STANDARD_BODY}## Artifacts\n- artifact/dangling.md\n- artifact/outside.md\n`,
  });
  fs.mkdirSync(path.join(dir, 'artifact'));
  const outside = caOutside(t, root);
  const secret = path.join(outside, 'secret.md');
  fs.writeFileSync(secret, 'OUTSIDE\n');
  const dangling = caLink(path.join(outside, 'nowhere.md'), path.join(dir, 'artifact', 'dangling.md'), 'file');
  if (dangling) { t.skip(`cannot create a symlink here (${dangling.code})`); return; }
  const toOutside = caLink(secret, path.join(dir, 'artifact', 'outside.md'), 'file');
  if (toOutside) { t.skip(`cannot create a symlink here (${toOutside.code})`); return; }
  const bytes = fs.readFileSync(secret);
  const res = runCli(root, ['validate', 'links']);
  assert.equal(res.status, 0, `validate must exit 0: ${res.stdout}${res.stderr}`);
  const warns = caWarns(res.stdout + res.stderr);
  for (const p of ['artifact/dangling.md', 'artifact/outside.md']) {
    const hits = warns.filter((l) => l.includes(p));
    assert.equal(hits.length, 1, `${p}: exactly one warn line naming it, got ${JSON.stringify(hits)}`);
  }
  assert.ok(fs.readFileSync(secret).equals(bytes), 'the outside file must be byte-identical');
});

test('change-artifacts row 27: a PRESENT artifact/con.html stamps nothing (POSIX); change.md byte-identical', (t) => {
  if (process.platform === 'win32') {
    t.skip('win32 cannot create a file named con.html');
    return;
  }
  const root = caProject(t);
  const dir = writeChange(root, 'device', { body: STANDARD_BODY });
  caPlan(dir);
  fs.writeFileSync(path.join(dir, 'artifact', 'con.html'), '<p>con</p>\n');
  const file = path.join(dir, 'change.md');
  const before = fs.readFileSync(file);
  const res = runCli(root, ['artifact', 'device', 'con.html']);
  assert.notEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(fs.readFileSync(file).equals(before), 'change.md must be byte-identical');
  // Positive control on the same change: plan.html stamps.
  assert.equal(runCli(root, ['artifact', 'device', 'plan.html']).status, 0, 'control: plan.html stamps');
});

test('change-artifacts row 28: a path listed on two lines is refused naming it as listed more than once, change.md byte-identical', (t) => {
  const root = caProject(t);
  const dir = writeChange(root, 'twice-listed', { body: STANDARD_BODY });
  caPlan(dir);
  const file = path.join(dir, 'change.md');
  assert.equal(runCli(root, ['artifact', 'twice-listed', 'plan.html']).status, 0, 'setup: the first stamp');
  // One hand-placed link line joins the one stamped line for the same path.
  fs.appendFileSync(file, '- [plan](artifact/plan.html)\n');
  const before = fs.readFileSync(file);
  const res = runCli(root, ['artifact', 'twice-listed', 'plan.html']);
  assert.notEqual(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stderr, /artifact\/plan\.html.*listed more than once/, 'stderr must name artifact/plan.html and say listed more than once');
  assert.ok(fs.readFileSync(file).equals(before), 'change.md must be byte-identical');
  // Control: without the hand-placed line the same change stamps.
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('- [plan](artifact/plan.html)\n', ''));
  assert.equal(runCli(root, ['artifact', 'twice-listed', 'plan.html']).status, 0, 'control: one line for the path stamps');
});

test('change-artifacts row 30: a stamp that would not read back (an unclosed fence after Design and Delta) is refused each time, change.md byte-identical', (t) => {
  const root = caProject(t);
  const DESIGN_DELTA = '# Change: x\n\n## Design\n- decision: a\n\n## Delta: auth\n\n'
    + '### ADDED Requirement: A\nThe system SHALL a.\n\n';
  const dir = writeChange(root, 'unclosed', { body: `${DESIGN_DELTA}\`\`\`\nnever closed\n` });
  caPlan(dir);
  const file = path.join(dir, 'change.md');
  const before = fs.readFileSync(file);
  for (const run of [1, 2]) {
    const res = runCli(root, ['artifact', 'unclosed', 'plan.html']);
    assert.notEqual(res.status, 0, `run ${run} must be refused: ${res.stdout}${res.stderr}`);
    assert.match(res.stderr, /would not read back/, `run ${run}: stderr must say the stamp would not read back`);
    assert.ok(fs.readFileSync(file).equals(before), `run ${run}: change.md must be byte-identical`);
  }
  // Control: the same change with its fence closed stamps.
  fs.appendFileSync(file, '```\n');
  assert.equal(runCli(root, ['artifact', 'unclosed', 'plan.html']).status, 0, 'control: with the fence closed the stamp reads back');
});

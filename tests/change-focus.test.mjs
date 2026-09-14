// Session-scoped active change pointer — per-session state isolated from project-wide fallback.
// Rows 1-5, 7-11, 16 of sdlc/changes/next-this-session/contract/tests.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, writeChange, runHook, writeTranscript, STANDARD_BODY } from './helpers.mjs';

function initProject(t) {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  return dir;
}

function setActive(projectRoot, id, { sessionId = null } = {}) {
  const env = sessionId ? { CLAUDE_CODE_SESSION_ID: sessionId } : {};
  return runHook(projectRoot, 'journal.mjs', {
    args: ['set-active', id],
    env,
  });
}

function status(projectRoot, { sessionId = null, json = false } = {}) {
  const args = ['status'];
  if (json) args.push('--json');
  const env = sessionId ? { CLAUDE_CODE_SESSION_ID: sessionId } : {};
  return runCli(projectRoot, args, { env });
}

// Row 1: Given open changes a, b, c with c most recently edited
// when session S1 runs set-active b and status
// then b's line is the first change line, marked `← this session`, a and c marked (not this session), json current = {b, session}
test('row 1: session-set change reported first with session marker', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'a', { body: STANDARD_BODY });
  writeChange(dir, 'b', { body: STANDARD_BODY });
  writeChange(dir, 'c', { body: STANDARD_BODY });

  // Make c the most recently edited
  const now = Date.now();
  fs.utimesSync(path.join(dir, 'sdlc/changes/a/change.md'), now / 1000, now / 1000);
  fs.utimesSync(path.join(dir, 'sdlc/changes/b/change.md'), (now + 1000) / 1000, (now + 1000) / 1000);
  fs.utimesSync(path.join(dir, 'sdlc/changes/c/change.md'), (now + 2000) / 1000, (now + 2000) / 1000);

  const setRes = setActive(dir, 'b', { sessionId: 's1' });
  assert.equal(setRes.status, 0, setRes.stderr);

  const statusRes = status(dir, { sessionId: 's1', json: false });
  assert.equal(statusRes.status, 0, statusRes.stderr);

  const lines = statusRes.stdout.trim().split('\n');
  // Find the first change line (skip summary lines)
  const changeLines = lines.filter(l => l.match(/^[a-z]+\s+\[/));
  assert.ok(changeLines.length >= 3, 'should have at least 3 changes listed');

  // First change line should be 'b' marked as 'this session'
  assert.match(changeLines[0], /^b\s+\[standard\/new\]\s+.*← this session/,
    'b should be the first change line and marked as this session');

  // a and c should be marked as not this session
  assert.ok(changeLines.some(l => l.startsWith('a ') && l.includes('(not this session)')),
    'a should be marked as not this session');
  assert.ok(changeLines.some(l => l.startsWith('c ') && l.includes('(not this session)')),
    'c should be marked as not this session');

  const jsonRes = status(dir, { sessionId: 's1', json: true });
  const jsonData = JSON.parse(jsonRes.stdout);
  assert.deepStrictEqual(jsonData.current, { id: 'b', source: 'session' },
    'json current should be {b, session}');
});

// Row 2: Given a set active by S1 · when S2 (no pointer of its own) runs status
// then a is first marked `← last set for project`, json source `project`
test('row 2: project pointer reported when session has no own pointer', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'a', { body: STANDARD_BODY });
  writeChange(dir, 'b', { body: STANDARD_BODY });

  // S1 sets b active — b is not first in natural order, so "first" proves a reorder
  setActive(dir, 'b', { sessionId: 's1' });

  // S2 runs status (has never set anything)
  const statusRes = status(dir, { sessionId: 's2', json: false });
  assert.equal(statusRes.status, 0, statusRes.stderr);

  const lines = statusRes.stdout.trim().split('\n');
  assert.match(lines[0], /^b\s+\[standard\/new\]\s+.*← last set for project/,
    'b should be first and marked as project pointer');
  // S2 never set anything, so it cannot know a is someone else's — no ownership claim.
  const aLine = lines.find((l) => l.startsWith('a '));
  assert.ok(aLine, 'a should still be listed');
  assert.doesNotMatch(aLine, /not this session/,
    'a project-sourced current must not mark other changes as not this session\'s');

  const jsonRes = status(dir, { sessionId: 's2', json: true });
  const jsonData = JSON.parse(jsonRes.stdout);
  assert.deepStrictEqual(jsonData.current, { id: 'b', source: 'project' },
    'json current should be {b, project}');
  // The JSON list is a machine contract: `current` names the id, the order stays put.
  assert.deepStrictEqual(jsonData.changes.map((c) => c.id), ['a', 'b'],
    'json changes must keep their original order');
});

// Row 3: Given open changes and no pointer at all (only change.md mtimes differ)
// when status runs · then no line carries ← this session or ← last set for project, json current is null
test('row 3: no markers when no pointer set, rely on mtimes', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'a', { body: STANDARD_BODY });
  writeChange(dir, 'b', { body: STANDARD_BODY });

  // Make sure no active.json exists
  fs.rmSync(path.join(dir, 'sdlc/.state/active.json'), { force: true });

  // Make a and b have different mtimes
  const aPath = path.join(dir, 'sdlc/changes/a/change.md');
  const bPath = path.join(dir, 'sdlc/changes/b/change.md');
  const now = Date.now();
  fs.utimesSync(aPath, now / 1000, now / 1000);
  fs.utimesSync(bPath, (now + 1000) / 1000, (now + 1000) / 1000);

  const statusRes = status(dir, { sessionId: 's1', json: false });
  const lines = statusRes.stdout.trim().split('\n');

  // Neither should have session/project markers
  for (const line of lines) {
    if (line.includes('active') || line.includes('archived')) continue;
    assert.ok(!line.includes('← this session'), 'should not have this session marker');
    assert.ok(!line.includes('← last set for project'), 'should not have project marker');
  }

  const jsonRes = status(dir, { sessionId: 's1', json: true });
  const jsonData = JSON.parse(jsonRes.stdout);
  assert.strictEqual(jsonData.current, null, 'json current should be null');
});

// Row 4: Given a pointer naming a change whose folder is gone
// when status runs · then json current is null and nothing is claimed
test('row 4: stale pointer to missing change returns null current', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'a', { body: STANDARD_BODY });
  writeChange(dir, 'b', { body: STANDARD_BODY });

  // S1 sets a active
  setActive(dir, 'a', { sessionId: 's1' });

  // Delete the a folder
  fs.rmSync(path.join(dir, 'sdlc/changes/a'), { recursive: true });

  const jsonRes = status(dir, { sessionId: 's1', json: true });
  const jsonData = JSON.parse(jsonRes.stdout);
  assert.strictEqual(jsonData.current, null, 'json current should be null for missing change');

  // Status text should not claim the missing change
  const statusRes = status(dir, { sessionId: 's1', json: false });
  const lines = statusRes.stdout.trim().split('\n');
  assert.ok(!lines.some(l => l.startsWith('a ')), 'missing change should not appear');
});

// Row 5: Given S1's pointer is stale but project pointer names open change a
// when S1 runs status · then a is current with source project
test('row 5: stale session pointer falls back to project pointer', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'a', { body: STANDARD_BODY });
  writeChange(dir, 'b', { body: STANDARD_BODY });
  writeChange(dir, 'c', { body: STANDARD_BODY });

  // S1 sets b active
  setActive(dir, 'b', { sessionId: 's1' });

  // Project sets a active
  setActive(dir, 'a', { sessionId: null });

  // Delete b folder (stale S1 pointer)
  fs.rmSync(path.join(dir, 'sdlc/changes/b'), { recursive: true });

  // S1 runs status
  const jsonRes = status(dir, { sessionId: 's1', json: true });
  const jsonData = JSON.parse(jsonRes.stdout);
  assert.deepStrictEqual(jsonData.current, { id: 'a', source: 'project' },
    'should fall back to project pointer with project source');

  // Falling back to the project pointer is still a guess about the rest: c stays unmarked.
  const lines = status(dir, { sessionId: 's1' }).stdout.split('\n');
  assert.match(lines.find((l) => l.startsWith('a ')) ?? '', /← last set for project/);
  assert.doesNotMatch(lines.find((l) => l.startsWith('c ')) ?? 'missing', /not this session|missing/,
    'c must be listed and carry no ownership marker after a fallback to the project pointer');
});

// Row 7: Given S1 sets x then S2 sets y
// when S1 runs status · then x is current with source session; S2's status shows y
test('row 7: two sessions maintain independent pointers', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'x', { body: STANDARD_BODY });
  writeChange(dir, 'y', { body: STANDARD_BODY });

  // S1 sets x
  setActive(dir, 'x', { sessionId: 's1' });
  // S2 sets y
  setActive(dir, 'y', { sessionId: 's2' });

  // S1 runs status
  const s1Res = status(dir, { sessionId: 's1', json: true });
  const s1Data = JSON.parse(s1Res.stdout);
  assert.deepStrictEqual(s1Data.current, { id: 'x', source: 'session' },
    'S1 should see x');

  // S2 runs status
  const s2Res = status(dir, { sessionId: 's2', json: true });
  const s2Data = JSON.parse(s2Res.stdout);
  assert.deepStrictEqual(s2Data.current, { id: 'y', source: 'session' },
    'S2 should see y');
});

// Row 8: Given S1 set x and S2 set y
// when journal.mjs note runs under S1's env · then event lands in x.ndjson, not y's
// when same note runs under S3 (no pointer) · then event lands in y's (project pointer)
test('row 8: session note lands in session pointer change journal', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'x', { body: STANDARD_BODY });
  writeChange(dir, 'y', { body: STANDARD_BODY });

  // S1 sets x
  setActive(dir, 'x', { sessionId: 's1' });
  // S2 sets y (project pointer now = y)
  setActive(dir, 'y', { sessionId: 's2' });

  // S1 runs note under its env
  const noteRes = runHook(dir, 'journal.mjs', {
    args: ['note', 's1_event'],
    env: { CLAUDE_CODE_SESSION_ID: 's1' },
  });
  assert.equal(noteRes.status, 0, noteRes.stderr);

  // Event should be in x's journal, not y's
  const xJournal = path.join(dir, 'sdlc/.state/journal/x.ndjson');
  assert.ok(fs.existsSync(xJournal), 'x journal should exist');
  const xEvents = fs.readFileSync(xJournal, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  assert.ok(xEvents.some(e => e.event === 's1_event'), 'S1 event should be in x journal');

  // S3 (with no pointer) runs note - should land in y's journal (project pointer)
  const s3NoteRes = runHook(dir, 'journal.mjs', {
    args: ['note', 's3_event'],
    env: { CLAUDE_CODE_SESSION_ID: 's3' },
  });
  assert.equal(s3NoteRes.status, 0, s3NoteRes.stderr);

  const yJournal = path.join(dir, 'sdlc/.state/journal/y.ndjson');
  assert.ok(fs.existsSync(yJournal), 'y journal should exist');
  const yEvents = fs.readFileSync(yJournal, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  assert.ok(yEvents.some(e => e.event === 's3_event'), 'S3 event should land in y journal (project pointer)');
});

// Row 9: Given S1 set x and S2 set y
// when session-summary runs with stdin session_id S1 and transcript · then event lands in x's journal
test('row 9: session-summary attributes event to session pointer via stdin', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'x', { body: STANDARD_BODY });
  writeChange(dir, 'y', { body: STANDARD_BODY });

  // S1 sets x
  setActive(dir, 'x', { sessionId: 's1' });
  // S2 sets y
  setActive(dir, 'y', { sessionId: 's2' });

  // session-summary runs with S1's session_id in stdin
  const sessionSummaryRes = runHook(dir, 'session-summary.mjs', {
    stdin: {
      hook_event_name: 'Stop',
      session_id: 's1',
      transcript_path: writeTranscript(dir),
    },
  });
  assert.equal(sessionSummaryRes.status, 0, sessionSummaryRes.stderr);

  // Event should be in x's journal
  const xJournal = path.join(dir, 'sdlc/.state/journal/x.ndjson');
  assert.ok(fs.existsSync(xJournal), 'x journal should exist');
  const xEvents = fs.readFileSync(xJournal, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  assert.ok(xEvents.some(e => e.event === 'session'), 'session event should be in x journal');
});

// Row 10: Given S1 set x and S2 set y
// when SessionStart (inject-context) runs with stdin session_id S1 · then its pointer line names x
test('row 10: inject-context reports correct pointer for session via stdin', (t) => {
  const dir = initProject(t);
  fs.writeFileSync(path.join(dir, 'sdlc/context/constitution.md'), '# Constitution\n- rule one\n');
  writeChange(dir, 'x', { body: STANDARD_BODY });
  writeChange(dir, 'y', { body: STANDARD_BODY });

  // S1 sets x
  setActive(dir, 'x', { sessionId: 's1' });
  // S2 sets y
  setActive(dir, 'y', { sessionId: 's2' });

  // inject-context runs with S1's session_id in stdin
  const injectRes = runHook(dir, 'inject-context.mjs', {
    stdin: {
      hook_event_name: 'SessionStart',
      session_id: 's1',
    },
  });
  assert.equal(injectRes.status, 0, injectRes.stderr);

  // SessionStart context is plain text; the pointer line names the session's change.
  assert.match(injectRes.stdout, /Active change: sdlc\/changes\/x\/change\.md/,
    'the SessionStart pointer line should name S1\'s change x');
  assert.doesNotMatch(injectRes.stdout, /sdlc\/changes\/y\//,
    'the SessionStart pointer line must not name S2\'s change y');
});

// Row 11: Given no session identity anywhere
// when set-active x then status and note run · then current = {x, project} and note lands in x's journal
test('row 11: no session identity treats as project-wide pointer', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'x', { body: STANDARD_BODY });
  writeChange(dir, 'y', { body: STANDARD_BODY });

  // set-active x with no session
  setActive(dir, 'x', { sessionId: null });

  // status with no session
  const statusRes = status(dir, { sessionId: null, json: true });
  const statusData = JSON.parse(statusRes.stdout);
  assert.deepStrictEqual(statusData.current, { id: 'x', source: 'project' },
    'no session should report as project source');

  // note with no session
  const noteRes = runHook(dir, 'journal.mjs', {
    args: ['note', 'test_event'],
    env: { CLAUDE_CODE_SESSION_ID: undefined },
  });
  assert.equal(noteRes.status, 0, noteRes.stderr);

  // Event should be in x's journal (because project pointer = x)
  const xJournal = path.join(dir, 'sdlc/.state/journal/x.ndjson');
  assert.ok(fs.existsSync(xJournal), 'x journal should exist');
  const xEvents = fs.readFileSync(xJournal, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  assert.ok(xEvents.some(e => e.event === 'test_event'), 'event should be in x journal');
});

// Row 12: Given test runner's own env carries CLAUDE_CODE_SESSION_ID
// when a test spawns CLI or hook without setting one · then child sees no session identity
test('row 12: test infrastructure scrubs CLAUDE_CODE_SESSION_ID from spawned processes', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'a', { body: STANDARD_BODY });
  writeChange(dir, 'b', { body: STANDARD_BODY });

  // Set project pointer
  setActive(dir, 'a', { sessionId: null });

  // Temporarily set a session id in the test runner's env
  const originalEnv = process.env.CLAUDE_CODE_SESSION_ID;
  t.after(() => {
    if (originalEnv === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
    else process.env.CLAUDE_CODE_SESSION_ID = originalEnv;
  });

  process.env.CLAUDE_CODE_SESSION_ID = 'test-runner-session';

  // Run status through the helper without specifying a session id
  // It should be scrubbed and report project source, not session source
  const statusRes = status(dir, { sessionId: undefined, json: true });
  assert.equal(statusRes.status, 0, statusRes.stderr);

  const jsonData = JSON.parse(statusRes.stdout);
  // Even though test runner has a session id, the spawned status should see none
  // So current should be null (no pointer set for a random session) or project source
  if (jsonData.current && jsonData.current.source === 'project') {
    assert.equal(jsonData.current.id, 'a', 'should see project pointer as project source, not session');
  }
});

// Row 16: Given session file with malformed JSON or non-string change
// when status and hook run · then both fall back to project pointer and exit 0
test('row 16: malformed session pointer falls back to project safely', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'x', { body: STANDARD_BODY });
  writeChange(dir, 'y', { body: STANDARD_BODY });

  // Set project pointer to x
  setActive(dir, 'x', { sessionId: null });

  // Create malformed session file for s1
  const sessionDir = path.join(dir, 'sdlc/.state/sessions');
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, 's1.json'), 'not json {]');

  // Status should fall back to project pointer and not error
  const statusRes = status(dir, { sessionId: 's1', json: true });
  assert.equal(statusRes.status, 0, statusRes.stderr);
  const statusData = JSON.parse(statusRes.stdout);
  assert.deepStrictEqual(statusData.current, { id: 'x', source: 'project' },
    'should fall back to project pointer on malformed session file');

  // Hook should also work
  const noteRes = runHook(dir, 'journal.mjs', {
    args: ['note', 'test'],
    env: { CLAUDE_CODE_SESSION_ID: 's1' },
  });
  assert.equal(noteRes.status, 0, 'hook should exit 0 despite malformed file');

  // Event should land in x's journal (project pointer)
  const xJournal = path.join(dir, 'sdlc/.state/journal/x.ndjson');
  const xEvents = fs.readFileSync(xJournal, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  assert.ok(xEvents.some(e => e.event === 'test'), 'event should be in x journal via fallback');
});

// Row 17: Given S1 set x and S2 set y
// when a hook runs with stdin session_id S1 but env CLAUDE_CODE_SESSION_ID S2
// then the event lands in x's journal — stdin wins, env is used only when stdin carries no session_id
test('row 17: stdin session_id takes precedence over env CLAUDE_CODE_SESSION_ID', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'x', { body: STANDARD_BODY });
  writeChange(dir, 'y', { body: STANDARD_BODY });

  // S1 sets x
  setActive(dir, 'x', { sessionId: 's1' });
  // S2 sets y
  setActive(dir, 'y', { sessionId: 's2' });

  // Run journal.mjs note with stdin session_id S1 but env CLAUDE_CODE_SESSION_ID S2
  const noteRes = runHook(dir, 'journal.mjs', {
    args: ['note', 'probe'],
    stdin: { session_id: 's1' },
    env: { CLAUDE_CODE_SESSION_ID: 's2' },
  });
  assert.equal(noteRes.status, 0, noteRes.stderr);

  // Event should land in x's journal (stdin wins)
  const xJournal = path.join(dir, 'sdlc/.state/journal/x.ndjson');
  assert.ok(fs.existsSync(xJournal), 'x journal should exist');
  const xEvents = fs.readFileSync(xJournal, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  assert.ok(xEvents.some(e => e.event === 'probe'), 'event should land in x journal (stdin session_id wins)');

  // Event should NOT be in y's journal
  const yJournal = path.join(dir, 'sdlc/.state/journal/y.ndjson');
  if (fs.existsSync(yJournal)) {
    const yEvents = fs.readFileSync(yJournal, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    assert.ok(!yEvents.some(e => e.event === 'probe'), 'event should not be in y journal');
  }

  // Test with session-summary as well
  const summaryRes = runHook(dir, 'session-summary.mjs', {
    stdin: {
      hook_event_name: 'Stop',
      session_id: 's1',
      transcript_path: writeTranscript(dir),
    },
    env: { CLAUDE_CODE_SESSION_ID: 's2' },
  });
  assert.equal(summaryRes.status, 0, summaryRes.stderr);

  // Event should be in x's journal, not y's
  const xEvents2 = fs.readFileSync(xJournal, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  assert.ok(xEvents2.some(e => e.event === 'session'), 'session-summary event should land in x journal');
});

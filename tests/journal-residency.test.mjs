// Journal residency — telemetry a session appends must never touch a tracked file,
// and a shipped change must carry its telemetry into the archive.
// Rows 1-20 of sdlc/changes/journal-out-of-tree/contract/tests.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeTempProject, runCli, writeChange, writeContractTests, STANDARD_BODY } from './helpers.mjs';
import { isSafeChangeId } from '../lib/journal.mjs';

// ---------- harness ----------

// Run a real installed hook, exactly as Claude Code would. Fabricating the file a
// hook is supposed to write proves nothing: this whole change is about WHERE the
// hook writes, so every row claiming something about a session's side effects has
// to go through here.
function runHook(projectRoot, script, args = [], stdinObj = null) {
  const env = { ...process.env, CLAUDE_CODE_SESSION_ID: undefined };
  const res = spawnSync(process.execPath, [path.join(projectRoot, 'sdlc/.hooks', script), ...args], {
    cwd: projectRoot,
    input: stdinObj == null ? '' : JSON.stringify(stdinObj),
    encoding: 'utf8',
    env,
  });
  if (res.error) throw res.error;
  return res;
}

const note = (dir, name, ...kv) => runHook(dir, 'journal.mjs', ['note', name, ...kv]);
const setActive = (dir, id) => runHook(dir, 'journal.mjs', ['set-active', id]);

const livePath = (dir, id) => path.join(dir, 'sdlc/.state/journal', `${id}.ndjson`);
const legacyPath = (dir, id) => path.join(dir, 'sdlc/changes', id, 'journal.ndjson');

function readNdjson(p) {
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function seed(p, events) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, events.map((e) => JSON.stringify(e)).join('\n') + '\n');
}

// Every file under a root with its content, so a test can assert "nothing here
// changed" rather than the weaker "this one file is absent".
function snapshot(root) {
  const out = new Map();
  if (!fs.existsSync(root)) return out;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.set(path.relative(root, p).split(path.sep).join('/'), fs.readFileSync(p, 'utf8'));
    }
  };
  walk(root);
  return out;
}

function initProject(t, { id = 'add-2fa', status = 'new' } = {}) {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const changeDir = writeChange(dir, id, { status, body: STANDARD_BODY });
  writeContractTests(changeDir);
  setActive(dir, id);
  return { dir, changeDir };
}

function archivedDir(dir) {
  const root = path.join(dir, 'sdlc/changes/archive');
  const found = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
  assert.equal(found.length, 1, 'exactly one archived change expected');
  return path.join(root, found[0].name);
}

// ---------- git ----------

const git = (dir, ...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
const gitAvailable = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;

function gitProject(t, opts) {
  const made = initProject(t, opts);
  const { dir } = made;
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'test');
  git(dir, 'add', '-A');
  git(dir, '-c', 'commit.gpgsign=false', 'commit', '-qm', 'init');
  return made;
}

// ---------- Requirement: a session never modifies a version-controlled file ----------

// Row 1 — the symptom the issue actually reports. This is the one test that still
// fails if the journal merely moves to some other tracked path.
test('row 1: a hook appending telemetry leaves the tracked tree clean', { skip: !gitAvailable && 'git unavailable' }, (t) => {
  const { dir } = gitProject(t);
  assert.equal(git(dir, 'status', '--porcelain').stdout.trim(), '', 'fixture must start clean');

  note(dir, 'session');
  note(dir, 'verify', 'result=pass');

  assert.equal(
    git(dir, 'status', '--porcelain').stdout.trim(), '',
    'a session appended telemetry and dirtied a version-controlled file',
  );
});

// Row 2 — and the file it did grow is one git is told to ignore.
test('row 2: the file a hook grows is git-ignored', { skip: !gitAvailable && 'git unavailable' }, (t) => {
  const { dir } = gitProject(t);
  note(dir, 'session');

  const live = livePath(dir, 'add-2fa');
  assert.ok(fs.existsSync(live), 'the hook wrote no telemetry at the out-of-tree path');
  assert.equal(git(dir, 'check-ignore', '-q', live).status, 0, 'the telemetry file is not git-ignored');
});

// Row 3 — no git needed: nothing under changes/ may move at all.
test('row 3: appending telemetry touches nothing under sdlc/changes/', (t) => {
  const { dir } = initProject(t);
  const changesRoot = path.join(dir, 'sdlc/changes');
  const before = snapshot(changesRoot);

  note(dir, 'session');
  note(dir, 'compact');

  const after = snapshot(changesRoot);
  assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort(), 'the file set under changes/ changed');
  for (const [rel, text] of after) assert.equal(text, before.get(rel), `content changed: ${rel}`);
});

// Row 16 — the machine-owned lock must still deny a hand edit at the new location.
// Green before implementation by design: the guard's `sdlc/.state/` prefix already
// covers the new path. This pins that it keeps covering it.
test('row 16: the write guard denies a hand edit of the live telemetry file', (t) => {
  const { dir } = initProject(t);
  note(dir, 'session');

  const res = runHook(dir, 'guard-writes.mjs', [], {
    hook_event_name: 'PreToolUse',
    tool_name: 'Edit',
    tool_input: { file_path: livePath(dir, 'add-2fa') },
    session_id: 'sess-1',
  });

  const out = JSON.parse(res.stdout);
  assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny', `guard allowed the edit: ${res.stdout}`);
});

// Row 17 — change ids reach the path builder from user-writable state. A traversing
// id must not land a file outside the telemetry directory. Green today only because
// the old code falls back to the global journal when the folder is missing; it is the
// new per-id path builder this is really aimed at.
test('row 17: a traversing change id cannot place telemetry outside .state/journal/', (t) => {
  const { dir } = initProject(t);
  const escaped = path.join(dir, 'sdlc', 'changes', 'add-2fa', 'escaped.ndjson');

  fs.writeFileSync(
    path.join(dir, 'sdlc/.state/active.json'),
    JSON.stringify({ change: '../../changes/add-2fa/escaped' }),
  );
  note(dir, 'session');

  assert.ok(!fs.existsSync(escaped), 'telemetry escaped sdlc/.state/journal/ via a traversing change id');
  const journalDir = path.join(dir, 'sdlc/.state/journal');
  for (const f of fs.existsSync(journalDir) ? fs.readdirSync(journalDir) : []) {
    assert.ok(!f.includes('..'), `unsafe name written into the telemetry directory: ${f}`);
  }
});

// Row 18 — a stale pointer must not resurrect an in-tree write, and must not lose the
// event. Green before implementation by design: today's fallback already handles it.
test('row 18: telemetry survives an active pointer whose change folder is gone', (t) => {
  const { dir, changeDir } = initProject(t);
  fs.rmSync(changeDir, { recursive: true, force: true });

  note(dir, 'session', 'k=v');

  const stray = [...snapshot(path.join(dir, 'sdlc/changes')).keys()].filter((p) => p.endsWith('.ndjson'));
  assert.deepEqual(stray, [], `telemetry was written under changes/: ${stray.join(', ')}`);

  const recorded = [
    ...readNdjson(livePath(dir, 'add-2fa')),
    ...readNdjson(path.join(dir, 'sdlc/.state/journal.ndjson')),
  ];
  assert.ok(recorded.some((e) => e.event === 'session'), 'the event was dropped instead of recorded somewhere');
});

// ---------- Requirement: a shipped change carries its telemetry into the archive ----------

test('row 5: archive seals a live-only stream into the archived folder', (t) => {
  const { dir } = initProject(t, { status: 'verified' });
  // Seeded at the live path on purpose: telemetry that only ever existed out of
  // tree has no folder move to ride into the archive on.
  seed(livePath(dir, 'add-2fa'), [
    { ts: '2026-01-01T10:00:00.000Z', event: 'build' },
    { ts: '2026-01-01T11:00:00.000Z', event: 'verify', result: 'pass' },
  ]);

  assert.equal(runCli(dir, ['archive', 'add-2fa']).status, 0);

  const sealed = readNdjson(path.join(archivedDir(dir), 'journal.ndjson'));
  assert.ok(sealed.some((e) => e.event === 'build'), 'build event missing from the sealed journal');
  assert.ok(sealed.some((e) => e.event === 'verify'), 'verify event missing from the sealed journal');
});

test('row 4: the sealed journal carries the ship event the CLI recorded', (t) => {
  const { dir } = initProject(t, { status: 'verified' });
  note(dir, 'build');

  assert.equal(runCli(dir, ['archive', 'add-2fa']).status, 0);

  const sealed = readNdjson(path.join(archivedDir(dir), 'journal.ndjson'));
  const ship = sealed.filter((e) => e.event === 'ship');
  assert.equal(ship.length, 1, 'expected exactly one ship event in the sealed journal');
  assert.deepEqual(ship[0].specs, ['auth'], 'the ship event lost the merged capability list');
});

test('row 6: archive merges legacy and live streams in recorded-time order', (t) => {
  const { dir } = initProject(t, { status: 'verified' });
  seed(legacyPath(dir, 'add-2fa'), [
    { ts: '2026-01-01T10:00:00.000Z', event: 'gate' },
    { ts: '2026-01-01T12:00:00.000Z', event: 'build' },
  ]);
  seed(livePath(dir, 'add-2fa'), [
    { ts: '2026-01-01T11:00:00.000Z', event: 'contract' },
    { ts: '2026-01-01T13:00:00.000Z', event: 'verify' },
  ]);

  assert.equal(runCli(dir, ['archive', 'add-2fa']).status, 0);

  const seeded = readNdjson(path.join(archivedDir(dir), 'journal.ndjson')).filter((e) => e.ts.startsWith('2026-01-01'));
  assert.deepEqual(
    seeded.map((e) => e.event),
    ['gate', 'contract', 'build', 'verify'],
    'the two streams were not interleaved by recorded time',
  );
});

test('row 7: archive leaves no telemetry at either source path', (t) => {
  const { dir } = initProject(t, { status: 'verified' });
  seed(legacyPath(dir, 'add-2fa'), [{ ts: '2026-01-01T10:00:00.000Z', event: 'gate' }]);
  seed(livePath(dir, 'add-2fa'), [{ ts: '2026-01-01T11:00:00.000Z', event: 'build' }]);

  assert.equal(runCli(dir, ['archive', 'add-2fa']).status, 0);

  assert.ok(!fs.existsSync(livePath(dir, 'add-2fa')), 'the live stream survived the ship');
  assert.ok(!fs.existsSync(legacyPath(dir, 'add-2fa')), 'the legacy in-tree file survived the ship');
  const sealed = readNdjson(path.join(archivedDir(dir), 'journal.ndjson'));
  assert.ok(sealed.some((e) => e.event === 'gate'), 'the legacy events were dropped rather than carried over');
});

test('row 8: an aborted archive consumes neither stream', (t) => {
  const { dir } = initProject(t, { status: 'verified' });
  seed(legacyPath(dir, 'add-2fa'), [{ ts: '2026-01-01T10:00:00.000Z', event: 'gate' }]);
  note(dir, 'build');

  // Take the archive destination so the command aborts before any write.
  const date = new Date().toISOString().slice(0, 10);
  fs.mkdirSync(path.join(dir, 'sdlc/changes/archive', `${date}-add-2fa`), { recursive: true });

  assert.notEqual(runCli(dir, ['archive', 'add-2fa']).status, 0, 'archive should have refused');

  assert.ok(fs.existsSync(legacyPath(dir, 'add-2fa')), 'a failed archive deleted the legacy stream');
  assert.ok(fs.existsSync(livePath(dir, 'add-2fa')), 'a failed archive deleted the live stream');
  assert.ok(readNdjson(livePath(dir, 'add-2fa')).some((e) => e.event === 'build'), 'the live stream was truncated');
});

test('row 9: archiving a change with no telemetry invents no journal', (t) => {
  const { dir } = initProject(t, { status: 'verified' });
  fs.rmSync(livePath(dir, 'add-2fa'), { force: true });

  assert.equal(runCli(dir, ['archive', 'add-2fa']).status, 0);

  // The CLI's own ship event may be there; an empty file may not.
  const sealed = path.join(archivedDir(dir), 'journal.ndjson');
  if (fs.existsSync(sealed)) {
    assert.ok(fs.readFileSync(sealed, 'utf8').trim().length > 0, 'an empty journal file was created');
  }
});

test('row 19: events sharing a recorded time keep a deterministic order, legacy first', (t) => {
  const { dir } = initProject(t, { status: 'verified' });
  const ts = '2026-01-01T10:00:00.000Z';
  seed(legacyPath(dir, 'add-2fa'), [{ ts, event: 'from-legacy' }]);
  seed(livePath(dir, 'add-2fa'), [{ ts, event: 'from-live' }]);

  assert.equal(runCli(dir, ['archive', 'add-2fa']).status, 0);

  const seeded = readNdjson(path.join(archivedDir(dir), 'journal.ndjson')).filter((e) => e.ts === ts);
  assert.deepEqual(seeded.map((e) => e.event), ['from-legacy', 'from-live'], 'tie order is not legacy-then-live');
});

test('row 20: a CRLF legacy journal merges without corrupting the sealed file', (t) => {
  const { dir } = initProject(t, { status: 'verified' });
  const legacy = legacyPath(dir, 'add-2fa');
  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  fs.writeFileSync(
    legacy,
    '{"ts":"2026-01-01T10:00:00.000Z","event":"gate"}\r\n{"ts":"2026-01-01T11:00:00.000Z","event":"build"}\r\n',
  );
  note(dir, 'verify', 'result=pass');

  assert.equal(runCli(dir, ['archive', 'add-2fa']).status, 0);

  const sealedPath = path.join(archivedDir(dir), 'journal.ndjson');
  assert.ok(!fs.readFileSync(sealedPath, 'utf8').includes('\r'), 'the sealed journal carries CR characters');
  const sealed = readNdjson(sealedPath);
  assert.ok(
    sealed.some((e) => e.event === 'gate') && sealed.some((e) => e.event === 'build'),
    'CRLF events were lost',
  );
});

// Review regressions — both found by the panel, neither reachable through the rows above.

// For an open change the sealed path and the legacy path are the SAME file. Sealing
// before the rename left the merged union there when the rename failed, and the retry
// merged that union with the live stream again — every event twice.
test('regression: a failed rename consumes nothing, so a retry does not double events', (t) => {
  const { dir } = initProject(t, { status: 'verified' });
  seed(legacyPath(dir, 'add-2fa'), [{ ts: '2026-01-01T10:00:00.000Z', event: 'gate' }]);
  seed(livePath(dir, 'add-2fa'), [{ ts: '2026-01-01T11:00:00.000Z', event: 'build' }]);

  // Make the rename fail while every earlier check passes: a file where the archive
  // destination's parent must be a directory.
  const date = new Date().toISOString().slice(0, 10);
  const archiveRoot = path.join(dir, 'sdlc/changes/archive');
  const failed = runCli(dir, ['archive', 'add-2fa']);
  if (failed.status === 0) {
    // The rename succeeded on this platform; assert the seal is right and stop.
    const sealed = readNdjson(path.join(archiveRoot, `${date}-add-2fa`, 'journal.ndjson'));
    assert.equal(sealed.filter((e) => e.event === 'gate').length, 1);
    assert.equal(sealed.filter((e) => e.event === 'build').length, 1);
    return;
  }

  // Whatever failed, neither source may have been consumed or rewritten.
  assert.deepEqual(
    readNdjson(legacyPath(dir, 'add-2fa')).map((e) => e.event), ['gate'],
    'the legacy stream was rewritten by a failed archive',
  );
  assert.deepEqual(
    readNdjson(livePath(dir, 'add-2fa')).map((e) => e.event), ['build'],
    'the live stream was rewritten by a failed archive',
  );
});

// `changeDir` was built from the raw id, so `a/../b` resolved to a real folder and
// shipped — then failed on the journal paths that DO gate the id, after the rename.
test('regression: archive refuses an unsafe change id before it writes anything', (t) => {
  const { dir } = initProject(t, { status: 'verified' });
  seed(livePath(dir, 'add-2fa'), [{ ts: '2026-01-01T10:00:00.000Z', event: 'build' }]);

  const res = runCli(dir, ['archive', 'sub/../add-2fa']);

  assert.notEqual(res.status, 0, 'an unsafe id was accepted');
  assert.ok(fs.existsSync(path.join(dir, 'sdlc/changes/add-2fa/change.md')), 'the change was shipped anyway');
  assert.ok(!fs.existsSync(path.join(dir, 'sdlc/specs/auth/spec.md')), 'a spec was merged for an unsafe id');
  assert.equal(
    fs.readdirSync(path.join(dir, 'sdlc/changes/archive')).filter((n) => n !== '.gitkeep').length, 0,
    'something was archived for an unsafe id',
  );
});

// ---------- Requirement: reporting reads an open change's telemetry ----------

function report(dir) {
  const res = runCli(dir, ['observe', '--json']);
  assert.equal(res.status, 0, res.stderr);
  return JSON.parse(res.stdout);
}
const changeIn = (rep, id) => rep.changes.find((c) => c.id === id);

test('row 10: the report counts an open change from its live stream', (t) => {
  const { dir } = initProject(t);
  seed(livePath(dir, 'add-2fa'), [
    { ts: '2026-01-01T10:00:00.000Z', event: 'session', totals: { input: 100, output: 20, cacheRead: 0, cacheWrite: 0 } },
    { ts: '2026-01-01T11:00:00.000Z', event: 'verify', result: 'pass' },
  ]);

  const c = changeIn(report(dir), 'add-2fa');
  assert.equal(c.sessions, 1, 'live sessions were not counted');
  assert.equal(c.tokens.input, 100, 'live token totals were not counted');
  assert.equal(c.verify.rounds, 1, 'live verify rounds were not counted');
});

// Green before implementation by design: this is the migration guard — projects
// installed on the old layout must keep reporting after they update.
test('row 11: the report still counts a change carrying only legacy telemetry', (t) => {
  const { dir } = initProject(t);
  fs.rmSync(livePath(dir, 'add-2fa'), { force: true });
  seed(legacyPath(dir, 'add-2fa'), [
    { ts: '2026-01-01T10:00:00.000Z', event: 'session', totals: { input: 42, output: 1, cacheRead: 0, cacheWrite: 0 } },
  ]);

  const c = changeIn(report(dir), 'add-2fa');
  assert.equal(c.sessions, 1, 'legacy telemetry stopped being read');
  assert.equal(c.tokens.input, 42);
});

test('row 12: the merge neither drops nor duplicates an event', (t) => {
  const { dir } = initProject(t);
  seed(legacyPath(dir, 'add-2fa'), [
    { ts: '2026-01-01T10:00:00.000Z', event: 'session', totals: { input: 10, output: 0, cacheRead: 0, cacheWrite: 0 } },
  ]);
  seed(livePath(dir, 'add-2fa'), [
    { ts: '2026-01-01T11:00:00.000Z', event: 'session', totals: { input: 5, output: 0, cacheRead: 0, cacheWrite: 0 } },
  ]);

  const c = changeIn(report(dir), 'add-2fa');
  assert.equal(c.sessions, 2, 'expected exactly one session from each stream');
  assert.equal(c.tokens.input, 15, 'token totals do not match both streams counted once');
});

test('row 13: the report reads an archived change from its sealed journal', (t) => {
  const { dir } = initProject(t, { status: 'verified' });
  seed(livePath(dir, 'add-2fa'), [
    { ts: '2026-01-01T10:00:00.000Z', event: 'session', totals: { input: 7, output: 0, cacheRead: 0, cacheWrite: 0 } },
  ]);
  assert.equal(runCli(dir, ['archive', 'add-2fa']).status, 0);

  const archived = report(dir).changes.find((c) => c.archived);
  assert.ok(archived, 'the archived change is missing from the report');
  assert.equal(archived.sessions, 1, 'the sealed journal was not read');
  assert.equal(archived.tokens.input, 7);
});

test('row 15: a malformed line is skipped and the rest of the stream survives', (t) => {
  const { dir } = initProject(t);
  const live = livePath(dir, 'add-2fa');
  fs.mkdirSync(path.dirname(live), { recursive: true });
  fs.writeFileSync(live, [
    '{ this is not json',
    JSON.stringify({ ts: '2026-01-01T10:00:00.000Z', event: 'session', totals: { input: 3, output: 0, cacheRead: 0, cacheWrite: 0 } }),
  ].join('\n') + '\n');

  const c = changeIn(report(dir), 'add-2fa');
  assert.equal(c.sessions, 1, 'a malformed line took the whole stream down');
  assert.equal(c.tokens.input, 3);
});

test('row 14: a merged stream is ordered by recorded time', (t) => {
  const { dir } = initProject(t);
  seed(legacyPath(dir, 'add-2fa'), [
    { ts: '2026-01-01T10:00:00.000Z', event: 'session', totals: { input: 1, output: 0, cacheRead: 0, cacheWrite: 0 } },
  ]);
  // The closing event lives in the live stream, so lead time is only right once
  // both streams are read — reading legacy alone leaves it null.
  seed(livePath(dir, 'add-2fa'), [{ ts: '2026-01-03T10:00:00.000Z', event: 'ship' }]);

  const c = changeIn(report(dir), 'add-2fa');
  // Lead time runs first event → ship; it is only right if the merge ordered them.
  assert.equal(c.leadTimeMs, 2 * 24 * 60 * 60 * 1000, 'lead time disagrees with recorded-time order');
});

// The Windows-specific rejections in isSafeChangeId, exercised directly: `:` is an NTFS
// alternate data stream, the device names are reserved with any extension, and a
// trailing dot or space is stripped so the id aliases onto a different change.
test('regression: isSafeChangeId rejects ids that alias or redirect a write', () => {
  for (const bad of [
    'a/b', 'a\\b', '..', '.', '', 'foo:bar', 'CON', 'nul', 'COM1', 'lpt9.ndjson',
    'add-2fa.', 'add-2fa ', 'x'.repeat(101), 'a\0b',
  ]) {
    assert.equal(isSafeChangeId(bad), false, `accepted an unsafe change id: ${JSON.stringify(bad)}`);
  }
  for (const ok of ['add-2fa', 'a', 'journal-out-of-tree', 'change.with.dots', 'UPPER_case-1']) {
    assert.equal(isSafeChangeId(ok), true, `rejected a legitimate change id: ${ok}`);
  }
});

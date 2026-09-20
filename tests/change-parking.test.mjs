// Parking a change out of the way — `journal.mjs park <id>`/`unpark <id>`, a `parked:
// "<reason>"` frontmatter key written only inside the fences, status hiding/counting/
// `--all`, and refusals from ship, set-active, validate and the session-start pointer.
// Rows 1-34 of sdlc/changes/change-parking/contract/tests.md.
//
// Rows 1-4 (of the ORIGINAL 18-row contract) were the four defects that got a first draft
// withdrawn from change-relations. A second attempt reproduced two of the same defects —
// `sdlc/.state/journal` as a symlink carrying a write outside the project (row 29), and a
// write reported done while it had not really happened (row 30, and the fail-open command
// swallow at row 31) — plus a third: `main().catch(() => process.exit(0))`, the hook
// fail-open rule, also swallowing a command's own failure. All are regressions here.
//
// `lib/park.mjs`, `lib/safe-path.mjs`, `payload/hooks/journal.mjs` (`park`/`unpark`
// subcommands) and the `parked` field across `lib/relations.mjs`/`lib/observe.mjs`/
// `bin/cli.mjs` now exist and `npm test` is green — this file's earlier rows (1-28) are
// no longer red-by-construction. The `GENERIC_USAGE` guard below stays for documentation
// and as a tripwire: `park`/`unpark` are real subcommands now, so no legitimate refusal
// should ever fall through to that generic multi-command usage line again.
//
// Rows 29-34 are new, added against an implementation that already exists — the opposite
// of red-first. Each was verified to actually bite by reverting the specific guard it
// covers, confirming the row goes red, then restoring the guard and confirming green
// again; the revert used for each is recorded in its own comment.
//
// Round-trip note: `lib/frontmatter.mjs`'s `coerce` unquotes without ever unescaping —
// `true` comes back boolean, `2026` comes back numeric, a trailing quote is stripped,
// padding is trimmed. So the requirement is not "the reason round-trips" unconditionally;
// it is "parks only if it reads back exactly as given, else refuses saying so" (row 8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  makeTempProject, runCli, writeChange, writeContractTests, runHook, STANDARD_BODY,
} from './helpers.mjs';
import { parseFrontmatter } from '../lib/frontmatter.mjs';
import { buildReport } from '../lib/observe.mjs';

function initProject(t) {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  return dir;
}

// Fixture writer for a change carrying `blocked-by` — mirrors tests/change-relations.
// test.mjs's own writeRelatedChange, built inline rather than touching helpers.mjs for
// one extra key this file alone needs.
function writeRelatedChange(projectRoot, id, { tier = 'standard', status = 'new', body = STANDARD_BODY, blockedBy } = {}) {
  const dir = path.join(projectRoot, 'sdlc', 'changes', id);
  fs.mkdirSync(dir, { recursive: true });
  let fm = `id: ${id}\ntier: ${tier}\nstatus: ${status}\n`;
  if (blockedBy) fm += `blocked-by: [${blockedBy.join(', ')}]\n`;
  fs.writeFileSync(path.join(dir, 'change.md'), `---\n${fm}---\n${body}`);
  return dir;
}

// Fixture for a change that is ALREADY parked, for rows that test what consumes the key
// (status, validate, ship, set-active, session-start) rather than the park command itself.
function writeParkedChange(projectRoot, id, {
  reason = 'stepping aside for now', tier = 'standard', status = 'new', body = STANDARD_BODY, blockedBy,
} = {}) {
  const dir = path.join(projectRoot, 'sdlc', 'changes', id);
  fs.mkdirSync(dir, { recursive: true });
  let fm = `id: ${id}\ntier: ${tier}\nstatus: ${status}\n`;
  if (blockedBy) fm += `blocked-by: [${blockedBy.join(', ')}]\n`;
  fm += `parked: "${reason}"\n`;
  fs.writeFileSync(path.join(dir, 'change.md'), `---\n${fm}---\n${body}`);
  return dir;
}

// A pre-existing `park` journal event, for rows that test unpark without depending on
// park actually working yet.
function seedJournalEvent(projectRoot, id, event, extra = {}) {
  const journalDir = path.join(projectRoot, 'sdlc', '.state', 'journal');
  fs.mkdirSync(journalDir, { recursive: true });
  fs.appendFileSync(
    path.join(journalDir, `${id}.ndjson`),
    JSON.stringify({ ts: new Date().toISOString(), event, ...extra }) + '\n',
  );
}

function readJournalEvents(projectRoot, id) {
  const p = path.join(projectRoot, 'sdlc', '.state', 'journal', `${id}.ndjson`);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// runHook (helpers.mjs) always JSON-encodes whatever `stdin` it is given — there is no way
// to hand it literal, non-JSON bytes. Row 7 needs exactly that (bare, non-JSON stdin), so
// this spawns the hook directly, mirroring the local `runHook` override other test files
// (tests/security-regressions.test.mjs) already use for the same reason, rather than
// changing the shared helper's contract for one row.
function runHookRawStdin(projectRoot, script, args, rawStdin) {
  const env = { ...process.env, CLAUDE_CODE_SESSION_ID: undefined };
  return spawnSync(process.execPath, [path.join(projectRoot, 'sdlc/.hooks', script), ...args], {
    cwd: projectRoot, input: rawStdin, encoding: 'utf8', env,
  });
}

// The generic fallback journal.mjs prints today for any subcommand it does not
// recognize. A test asserting a refusal must never accept THIS as the refusal —
// otherwise "park does not exist" would masquerade as "park refused it".
const GENERIC_USAGE = /open-ship\|open-steer\|close\|set-active\|note/;

// ---------- Requirement: No write escapes the project ----------

// Row 1 — security regression: the change folder is a symlink to a directory outside
// the temp project, with a change.md at the target.
test('row 1: a change folder symlinked outside the project is refused; the outside file is byte-identical', (t) => {
  const dir = initProject(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'wsdlc-r1-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  const originalText = `---\nid: linked-out\ntier: standard\nstatus: new\n---\n${STANDARD_BODY}`;
  fs.writeFileSync(path.join(outside, 'change.md'), originalText);
  fs.symlinkSync(outside, path.join(dir, 'sdlc/changes/linked-out'));

  const res = runHook(dir, 'journal.mjs', { args: ['park', 'linked-out'], stdin: { reason: 'shelved' } });
  assert.notEqual(res.status, 0, 'park must refuse a change folder that is a symlink out of the project');
  assert.match((res.stderr ?? '') + (res.stdout ?? ''), /linked-out/, 'the refusal must name the change');
  assert.equal(fs.readFileSync(path.join(outside, 'change.md'), 'utf8'), originalText,
    'the file outside the project must be byte-identical afterwards');
});

// ---------- Requirement: A write that did not happen is never reported as done ----------

// Row 2
test('row 2: a change.md with no usable frontmatter block fails park, leaves the file untouched, and journals nothing', (t) => {
  const dir = initProject(t);
  const changeDir = path.join(dir, 'sdlc/changes/no-frontmatter');
  fs.mkdirSync(changeDir, { recursive: true });
  const originalText = '# Change: No frontmatter here\n\nJust prose. No --- fences anywhere in this file.\n';
  fs.writeFileSync(path.join(changeDir, 'change.md'), originalText);

  const res = runHook(dir, 'journal.mjs', { args: ['park', 'no-frontmatter'], stdin: { reason: 'shelved' } });
  assert.notEqual(res.status, 0, 'park must fail when there is no usable frontmatter block');
  assert.match((res.stderr ?? '') + (res.stdout ?? ''), /no-frontmatter/, 'the failure must name the change');
  assert.equal(fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8'), originalText,
    'the file must be byte-identical');
  assert.ok(!readJournalEvents(dir, 'no-frontmatter').some((e) => e.event === 'park'),
    'no park event may be journalled for a park that did not happen');
});

// ---------- Requirement: A change can be parked with a reason it can carry ----------

// Row 3
test('row 3: unpark removes the key, relists/orders/offers the change again, and the journal records both events', (t) => {
  const dir = initProject(t);
  const changeDir = writeParkedChange(dir, 'to-unpark', { reason: 'temporary' });
  seedJournalEvent(dir, 'to-unpark', 'park', { reason: 'temporary' });

  const res = runHook(dir, 'journal.mjs', { args: ['unpark', 'to-unpark'] });
  assert.equal(res.status, 0, res.stderr);

  const text = fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8');
  assert.doesNotMatch(text, /^parked:/m, 'the parked key must be gone from the frontmatter');

  const statusRes = runCli(dir, ['status', '--json']);
  assert.equal(statusRes.status, 0, statusRes.stderr);
  const data = JSON.parse(statusRes.stdout);
  assert.ok(data.changes.some((c) => c.id === 'to-unpark'), 'the change must be listed again');
  assert.ok((data.order ?? []).includes('to-unpark'), 'the change must be ordered again');

  const events = readJournalEvents(dir, 'to-unpark');
  assert.ok(events.some((e) => e.event === 'park'), 'the journal must carry a park event');
  assert.ok(events.some((e) => e.event === 'unpark'), 'the journal must carry an unpark event');
});

// ---------- Requirement: A change can be parked with a reason it can carry (ship/set-active refuse) ----------

// Row 4
test('row 4: ship and set-active both refuse a parked change; the folder does not move and no pointer changes', (t) => {
  const dir = initProject(t);
  const changeDir = writeParkedChange(dir, 'parked-ship', { status: 'verified', reason: 'stepping aside' });
  writeContractTests(changeDir);
  const before = fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8');

  const shipRes = runCli(dir, ['archive', 'parked-ship']);
  assert.notEqual(shipRes.status, 0, 'ship must refuse a parked change');
  assert.match(shipRes.stderr + shipRes.stdout, /parked/i, 'the refusal must say the change is parked');
  assert.ok(fs.existsSync(changeDir), 'the folder must not move while parked');
  assert.equal(fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8'), before, 'the change must be untouched');

  const setRes = runHook(dir, 'journal.mjs', { args: ['set-active', 'parked-ship'] });
  assert.notEqual(setRes.status, 0, 'set-active must refuse a parked change');
  assert.ok(!fs.existsSync(path.join(dir, 'sdlc/.state/active.json')), 'no project pointer may be created for a parked change');
});

// ---------- Requirement: A change can be parked with a reason it can carry (validation) ----------

// Row 5
test('row 5: an empty, whitespace-only, numeric, or missing reason each fails park and leaves the change unparked', (t) => {
  const dir = initProject(t);
  const changeDir = writeChange(dir, 'bad-reason', { body: STANDARD_BODY });
  const before = fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8');
  const cases = [
    ['empty', { reason: '' }],
    ['whitespace-only', { reason: '   ' }],
    ['a number', { reason: 5 }],
    ['absent', {}],
  ];
  for (const [label, stdin] of cases) {
    const res = runHook(dir, 'journal.mjs', { args: ['park', 'bad-reason'], stdin });
    assert.notEqual(res.status, 0, `a ${label} reason must fail park`);
    // A generic "unknown subcommand" refusal is not the contract's refusal — park must be
    // recognized and refuse FOR the bad reason, not because it does not exist yet.
    assert.doesNotMatch(res.stderr ?? '', GENERIC_USAGE,
      `a ${label} reason must be refused by park's own reason validation, not journal.mjs's generic usage line`);
    assert.equal(fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8'), before,
      `a ${label} reason must leave the file untouched`);
  }
});

// Row 6
test('row 6: a reason passed as a command-line argument is refused — only the stdin form exists', (t) => {
  const dir = initProject(t);
  const changeDir = writeChange(dir, 'argv-reason', { body: STANDARD_BODY });
  const before = fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8');

  const res = runHook(dir, 'journal.mjs', { args: ['park', 'argv-reason', 'stepping aside'] });
  assert.notEqual(res.status, 0, 'a reason given as a command-line argument must be refused');
  assert.match(res.stderr ?? '', /park <change-id>/, 'the usage text must name the park command');
  assert.match(res.stderr ?? '', /stdin/i, 'the usage text must say the reason belongs on stdin');
  assert.doesNotMatch(res.stderr ?? '', /<reason>/, 'the usage text must show no command-line reason placeholder');
  assert.equal(fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8'), before, 'the file must be untouched');
});

// Row 7
test('row 7: only {"reason": "..."} on stdin parks; a wrong-shaped or bare non-JSON stdin fails with a usage error naming the stdin form, and writes nothing', (t) => {
  const dir = initProject(t);
  const changeDir = writeChange(dir, 'stdin-shape', { body: STANDARD_BODY });
  const before = fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8');

  const wrongRes = runHook(dir, 'journal.mjs', { args: ['park', 'stdin-shape'], stdin: { wrong: 'a reason' } });
  assert.notEqual(wrongRes.status, 0, 'a stdin payload missing "reason" must fail park');
  assert.match(wrongRes.stderr ?? '', /stdin/i, 'the usage error must name the stdin form');
  assert.equal(fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8'), before,
    'nothing may be written for a wrong-shaped stdin payload');

  const bareRes = runHookRawStdin(dir, 'journal.mjs', ['park', 'stdin-shape'], 'just plain text, not json\n');
  assert.notEqual(bareRes.status, 0, 'bare non-JSON stdin must fail park');
  assert.match(bareRes.stderr ?? '', /stdin/i, 'the usage error must name the stdin form');
  assert.equal(fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8'), before,
    'nothing may be written for bare non-JSON stdin');

  const goodRes = runHook(dir, 'journal.mjs', { args: ['park', 'stdin-shape'], stdin: { reason: 'a real reason' } });
  assert.equal(goodRes.status, 0, goodRes.stderr);
  const { data } = parseFrontmatter(fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8'));
  assert.equal(data.parked, 'a real reason', 'the correctly-shaped stdin form must park the change');
});

// Row 8
test('row 8: a reason coerce would read back as something else — bare true, a bare number, a trailing quote, padding, or two lines — is refused, saying the format cannot carry it', (t) => {
  const dir = initProject(t);
  const changeDir = writeChange(dir, 'unfaithful-reason', { body: STANDARD_BODY });
  const before = fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8');
  const cases = [
    ['bare true', 'true'],
    ['a bare number', '2026'],
    ['a trailing quote', 'ends with quote"'],
    ['leading/trailing padding', '  padded  '],
    ['two lines', 'first line\nsecond line'],
  ];
  for (const [label, reason] of cases) {
    const res = runHook(dir, 'journal.mjs', { args: ['park', 'unfaithful-reason'], stdin: { reason } });
    assert.notEqual(res.status, 0, `a reason that is ${label} must be refused`);
    assert.doesNotMatch(res.stderr ?? '', GENERIC_USAGE,
      `a reason that is ${label} must be refused by park's own round-trip check, not journal.mjs's generic usage line`);
    assert.equal(fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8'), before,
      `a reason that is ${label} must leave the file untouched`);
  }
});

// Row 9 — REPAIRED, not extended: the old payload here always carried a bare CR, which
// `reasonError` rejects (single-line only) before the reason ever reaches an echo path, so
// it never actually tested a round trip. This row is now only about characters the reader
// returns UNCHANGED — `:`, `#`, `&`, `%`, an interior quote, a backslash — none of them at
// the very start/end of the value, where `coerce`'s quote-stripping would touch them. The
// escaping-on-display half of the old row 9 now lives at row 28, unconditionally.
test('row 9: a reason carrying :, #, &, %, an interior quote and a backslash — all of which the reader returns unchanged — parks and reads back identically', (t) => {
  const dir = initProject(t);
  const changeDir = writeChange(dir, 'symbol-hazard-reason', { body: STANDARD_BODY });
  const reason = 'a:b#c&d%e "mid-quote" back\\slash end';

  const res = runHook(dir, 'journal.mjs', { args: ['park', 'symbol-hazard-reason'], stdin: { reason } });
  assert.equal(res.status, 0, res.stderr);

  const { data } = parseFrontmatter(fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8'));
  assert.equal(data.parked, reason, 'the reason must read back out of the frontmatter identical to what was given');
});

// ---------- Requirement: A write that did not happen is never reported as done ----------

// Row 10
test('row 10: a body containing lines beginning status: and parked: is left byte-identical; only the frontmatter gains the key', (t) => {
  const dir = initProject(t);
  const body = STANDARD_BODY + '\nstatus: not-real-frontmatter\nparked: also-not-real-frontmatter\n';
  const changeDir = writeChange(dir, 'body-lookalike', { body });

  const res = runHook(dir, 'journal.mjs', { args: ['park', 'body-lookalike'], stdin: { reason: 'stepping aside' } });
  assert.equal(res.status, 0, res.stderr);

  const text = fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8');
  assert.match(text, /\nstatus: not-real-frontmatter\n/, 'the body status: line must survive byte-identical');
  assert.match(text, /\nparked: also-not-real-frontmatter\n/, 'the body parked: line must survive byte-identical');
  const { data } = parseFrontmatter(text);
  assert.equal(typeof data.parked, 'string', 'the frontmatter block itself must gain the parked key');
});

// ---------- Requirement: A change can be parked with a reason it can carry (reparking) ----------

// Row 11
test('row 11: parking an already-parked change replaces the reason — exactly one parked: line remains', (t) => {
  const dir = initProject(t);
  const changeDir = writeParkedChange(dir, 'reparked', { reason: 'first reason' });

  const res = runHook(dir, 'journal.mjs', { args: ['park', 'reparked'], stdin: { reason: 'second reason' } });
  assert.equal(res.status, 0, res.stderr);

  const text = fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8');
  const parkedLines = text.split('\n').filter((l) => l.startsWith('parked:'));
  assert.equal(parkedLines.length, 1, 'exactly one parked: line must remain in the frontmatter');
  assert.match(parkedLines[0], /second reason/, 'the new reason must replace the old one');
  assert.doesNotMatch(text, /first reason/, 'the old reason must not survive alongside the new one');
});

// Row 12 — the parser trap: an empty `parked:` value reads as an EMPTY ARRAY and opens a
// list context that would swallow any following `- item` line as one of its own entries.
test('row 12: parked: with an empty value (which the reader turns into a list) is replaced by the string reason — one parked: line, and the file still parses', (t) => {
  const dir = initProject(t);
  const changeId = 'empty-parked-key';
  const changeDir = path.join(dir, 'sdlc/changes', changeId);
  fs.mkdirSync(changeDir, { recursive: true });
  const fm = `id: ${changeId}\ntier: standard\nstatus: new\nparked:\n`;
  fs.writeFileSync(path.join(changeDir, 'change.md'), `---\n${fm}---\n${STANDARD_BODY}`);

  // Fixture sanity — confirms the trap this row exists to catch, true today regardless of
  // whether park is implemented, so it does not count toward this test's own red status.
  const fixtureCheck = parseFrontmatter(fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8'));
  assert.deepEqual(fixtureCheck.data.parked, [], 'fixture sanity: an empty parked: value reads as an empty list today');

  const res = runHook(dir, 'journal.mjs', { args: ['park', changeId], stdin: { reason: 'a real reason now' } });
  assert.equal(res.status, 0, res.stderr);

  const text = fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8');
  const parkedLines = text.split('\n').filter((l) => l.startsWith('parked:'));
  assert.equal(parkedLines.length, 1, 'exactly one parked: line must remain');
  assert.doesNotThrow(() => parseFrontmatter(text), 'the file must still parse as frontmatter');
  const { data } = parseFrontmatter(text);
  assert.equal(data.parked, 'a real reason now', 'the empty list-opening key must be replaced by the string reason');
});

// ---------- Requirement: A change can be parked with a reason it can carry (status listing) ----------

// Row 13
test('row 13: a change parked mid-build keeps its stage, is hidden by default, counted, and listed with --all', (t) => {
  const dir = initProject(t);
  writeParkedChange(dir, 'mid-build', { status: 'new', reason: 'pausing mid-build' });
  writeChange(dir, 'other-13', { body: STANDARD_BODY });
  const before = fs.readFileSync(path.join(dir, 'sdlc/changes/mid-build/change.md'), 'utf8');

  const statusRes = runCli(dir, ['status']);
  assert.equal(statusRes.status, 0, statusRes.stderr);
  assert.doesNotMatch(statusRes.stdout, /^mid-build\s/m, 'a parked change must be absent from the default listing');
  assert.match(statusRes.stdout, /\bparked\b/i, 'the summary line must count parked changes');

  const allRes = runCli(dir, ['status', '--all']);
  assert.equal(allRes.status, 0, allRes.stderr);
  assert.match(allRes.stdout, /^mid-build\s/m, 'the parked change must be listed on request with --all');

  const jsonRes = runCli(dir, ['status', '--json']);
  const data = JSON.parse(jsonRes.stdout);
  assert.equal(data.parked, 1, 'the top-level parked count must be reported');
  assert.ok(!(data.order ?? []).includes('mid-build'), 'a parked change must not be offered as ready');
  assert.notEqual(data.next?.id, 'mid-build', 'a parked change must never be the next step');

  assert.equal(fs.readFileSync(path.join(dir, 'sdlc/changes/mid-build/change.md'), 'utf8'), before,
    'reading status must never rewrite the change — its stage is unchanged');
});

// Row 14
test('row 14: status --json carries a parked field (reason or null) per change and a parked count, with every pre-existing field unchanged', (t) => {
  const dir = initProject(t);
  writeParkedChange(dir, 'parked-14', { reason: 'shelved for review' });
  writeChange(dir, 'open-14', { body: STANDARD_BODY });

  const res = runCli(dir, ['status', '--json']);
  assert.equal(res.status, 0, res.stderr);
  const data = JSON.parse(res.stdout);

  const parkedC = data.changes.find((c) => c.id === 'parked-14');
  const openC = data.changes.find((c) => c.id === 'open-14');
  assert.equal(parkedC?.parked, 'shelved for review', 'a parked change must carry its reason as the parked field');
  assert.equal(openC?.parked, null, 'an open change must carry an explicit not-parked value, not undefined');
  assert.equal(typeof parkedC?.tier, 'string', 'pre-existing fields must still be present on a parked change');
  assert.equal(typeof parkedC?.status, 'string', 'pre-existing fields must still be present on a parked change');
  assert.equal(data.parked, 1, 'the top-level parked count must be reported');
});

// ---------- Requirement: A parked change is not offered as work ----------

// Row 15
test('row 15: parking a change two others wait on is refused, naming both waiters; nothing is written', (t) => {
  const dir = initProject(t);
  writeRelatedChange(dir, 'target-15', {});
  writeRelatedChange(dir, 'waiter-15a', { blockedBy: ['target-15'] });
  writeRelatedChange(dir, 'waiter-15b', { blockedBy: ['target-15'] });
  const before = fs.readFileSync(path.join(dir, 'sdlc/changes/target-15/change.md'), 'utf8');

  const res = runHook(dir, 'journal.mjs', { args: ['park', 'target-15'], stdin: { reason: 'shelved' } });
  assert.notEqual(res.status, 0, 'park must refuse a change other open changes wait on');
  const out = (res.stderr ?? '') + (res.stdout ?? '');
  assert.match(out, /waiter-15a/, 'the refusal must name the first stranded waiter');
  assert.match(out, /waiter-15b/, 'the refusal must name the second stranded waiter');
  assert.equal(fs.readFileSync(path.join(dir, 'sdlc/changes/target-15/change.md'), 'utf8'), before,
    'change.md must be byte-identical');
  assert.ok(!readJournalEvents(dir, 'target-15').some((e) => e.event === 'park'),
    'no park event may be journalled for a refused park');
});

// ---------- Requirement: A relation must name a real change ----------

// Row 16
test('row 16: a change declaring blocked-by on a parked change fails validate, naming the parked change and its reason', (t) => {
  const dir = initProject(t);
  writeParkedChange(dir, 'parked-16', { reason: 'stepping aside for now' });
  writeRelatedChange(dir, 'waiter-16', { blockedBy: ['parked-16'] });

  const res = runCli(dir, ['validate']);
  assert.notEqual(res.status, 0, 'a relation that would wait on a parked change must fail validate');
  const out = res.stdout + res.stderr;
  assert.match(out, /parked-16/, 'the error must name the parked change');
  assert.match(out, /stepping aside for now/, 'the error must name the park reason');
});

// ---------- Requirement: A parked change is not offered as work ----------

// Row 17
test('row 17: a change waiting on an open change can still be parked — only stranding others is refused', (t) => {
  const dir = initProject(t);
  writeRelatedChange(dir, 'blocker-17', {});
  const waiterDir = writeRelatedChange(dir, 'self-waiting-17', { blockedBy: ['blocker-17'] });

  const res = runHook(dir, 'journal.mjs', { args: ['park', 'self-waiting-17'], stdin: { reason: 'shelved while waiting' } });
  assert.equal(res.status, 0, res.stderr);
  const { data } = parseFrontmatter(fs.readFileSync(path.join(waiterDir, 'change.md'), 'utf8'));
  assert.equal(typeof data.parked, 'string', 'a change that is itself waiting must still be parkable');
});

// ---------- Requirement: A parked change is not offered as work ----------

// Row 18 — defect (d) from the withdrawn draft: a freed-but-parked change must never be
// offered a resume command it would only refuse.
test('row 18: a parked change freed by a shipping blocker is reported parked, not resumable, and stays parked', (t) => {
  const dir = initProject(t);
  const blockerDir = writeChange(dir, 'blocker-18', { status: 'verified', body: STANDARD_BODY });
  writeContractTests(blockerDir);
  const waiterDir = writeParkedChange(dir, 'waiter-18', { reason: 'paused mid-flight', blockedBy: ['blocker-18'] });

  const res = runCli(dir, ['archive', 'blocker-18']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /waiter-18/, 'the ship report must still name the freed-but-parked change');
  assert.match(res.stdout, /parked/i, 'the report must say it is parked, not simply resumable');
  assert.doesNotMatch(res.stdout, /waiter-18[^\n]*(set-active|resume)/i,
    'a parked change must never be offered a resume command it would only refuse');

  const { data } = parseFrontmatter(fs.readFileSync(path.join(waiterDir, 'change.md'), 'utf8'));
  assert.equal(typeof data.parked, 'string', 'the change must still be parked after its blocker ships');
});

// ---------- Requirement: A change can be parked with a reason it can carry ----------

// Row 19
test('row 19: unpark on a change that was never parked fails naming the change; the file is byte-identical; no event is journalled', (t) => {
  const dir = initProject(t);
  const changeDir = writeChange(dir, 'never-parked', { body: STANDARD_BODY });
  const before = fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8');

  const res = runHook(dir, 'journal.mjs', { args: ['unpark', 'never-parked'] });
  assert.notEqual(res.status, 0, 'unpark must fail on a change that was never parked');
  assert.match((res.stderr ?? '') + (res.stdout ?? ''), /never-parked/, 'the failure must name the change');
  assert.equal(fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8'), before, 'the file must be byte-identical');
  assert.ok(!readJournalEvents(dir, 'never-parked').some((e) => e.event === 'unpark'),
    'no unpark event may be journalled for a call that did nothing');
});

// ---------- Requirement: No write escapes the project (id shape) ----------

// Row 20 — kept consistent with tests/security-regressions.test.mjs's own style of
// exercising several hostile id shapes in one loop against the same guard.
test('row 20: park refuses an id with no open folder, and ids shaped .., a/b and archive — each naming the id, deriving no path from it', (t) => {
  const dir = initProject(t);
  const ids = ['no-such-change', '..', 'a/b', 'archive'];
  for (const id of ids) {
    const res = runHook(dir, 'journal.mjs', { args: ['park', id], stdin: { reason: 'shelved' } });
    assert.notEqual(res.status, 0, `park must refuse id "${id}"`);
    assert.doesNotMatch(res.stderr ?? '', GENERIC_USAGE,
      `park must recognize and refuse id "${id}" on its own terms, not by falling through to the generic usage line`);
  }
  const parentDir = path.dirname(dir);
  assert.ok(!fs.readdirSync(parentDir).some((f) => f.includes('shelved')), 'no stray file may be created from an unsafe id');
  // `init` seeds the archive folder with a .gitkeep, so "empty" was never the right claim —
  // what matters is that park added nothing to it.
  assert.deepEqual(fs.readdirSync(path.join(dir, 'sdlc/changes/archive')), ['.gitkeep'],
    'the archive folder must be untouched');
});

// ---------- Requirement: A write that did not happen is never reported as done ----------

// Row 21 — same no-fences failure shape as row 2, but CRLF: the refusal path must not
// normalize line endings on its way to reporting failure.
test('row 21: a CRLF change.md with no usable frontmatter comes back byte-identical, CRLF intact', (t) => {
  const dir = initProject(t);
  const changeDir = path.join(dir, 'sdlc/changes/crlf-no-frontmatter');
  fs.mkdirSync(changeDir, { recursive: true });
  const originalText = '# Change: CRLF, no fences\r\n\r\nJust prose. No --- fences anywhere.\r\n';
  fs.writeFileSync(path.join(changeDir, 'change.md'), originalText);

  const res = runHook(dir, 'journal.mjs', { args: ['park', 'crlf-no-frontmatter'], stdin: { reason: 'shelved' } });
  assert.notEqual(res.status, 0, 'park must fail on a file with no usable frontmatter block');
  assert.doesNotMatch(res.stderr ?? '', GENERIC_USAGE,
    'park must recognize this file and refuse it on its own terms — not because the subcommand does not exist yet');
  const after = fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8');
  assert.equal(after, originalText, 'the file must be byte-identical, including every CRLF');
  assert.match(after, /\r\n/, 'sanity: the CRLF line endings must still be present');
});

// ---------- Requirement: A parked change is not offered as work ----------

// Row 22
test('row 22: a parked change is never announced as the session\'s work even when it was edited most recently', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'unparked-22', { body: STANDARD_BODY });
  writeParkedChange(dir, 'parked-22', { reason: 'shelved' });
  const now = Date.now();
  fs.utimesSync(path.join(dir, 'sdlc/changes/unparked-22/change.md'), now / 1000, now / 1000);
  fs.utimesSync(path.join(dir, 'sdlc/changes/parked-22/change.md'), (now + 5000) / 1000, (now + 5000) / 1000);

  const res = runHook(dir, 'inject-context.mjs', { stdin: { hook_event_name: 'SessionStart' } });
  assert.equal(res.status, 0, res.stderr);
  assert.doesNotMatch(res.stdout, /sdlc\/changes\/parked-22\//,
    'a parked change must never be resolved as this session\'s change, even if it is the most recently edited');
  assert.match(res.stdout, /sdlc\/changes\/unparked-22\//, 'an unparked change must be used instead');
});

// ---------- Requirement: Only an open change can be made active ----------

// Row 23
test('row 23: set-active on a parked change fails naming the park reason; no pointer is created', (t) => {
  const dir = initProject(t);
  writeParkedChange(dir, 'parked-23', { reason: 'on hold for review' });

  const res = runHook(dir, 'journal.mjs', { args: ['set-active', 'parked-23'] });
  assert.notEqual(res.status, 0, 'set-active must refuse a parked change');
  assert.match(res.stderr ?? '', /on hold for review/, 'the refusal must name the park reason');
  assert.ok(!fs.existsSync(path.join(dir, 'sdlc/.state/active.json')), 'no project pointer may be created');
});

// ---------- Requirement: A parked change is not offered as work ----------

// Row 24
test('row 24: a parked change ready in every other respect is absent from order; next never names it', (t) => {
  const dir = initProject(t);
  writeParkedChange(dir, 'parked-ready-24', { reason: 'shelved' });
  writeRelatedChange(dir, 'ready-24', {});

  const res = runCli(dir, ['status', '--json']);
  const data = JSON.parse(res.stdout);
  assert.ok((data.order ?? []).includes('ready-24'), 'the ready change must be ordered');
  assert.ok(!(data.order ?? []).includes('parked-ready-24'), 'a parked change must never be named in the order');
  assert.notEqual(data.next?.id, 'parked-ready-24', 'a parked change must never be offered as next');
});

// ---------- Requirement: A change can be parked with a reason it can carry (nothing parked stays unchanged) ----------

// Row 25
test('row 25: a project with nothing parked keeps every field/order, gaining only additive parking data', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'alpha25', { body: STANDARD_BODY });
  writeChange(dir, 'beta25', { body: STANDARD_BODY.replace('## Delta: auth', '## Delta: beta25') });

  const statusRes = runCli(dir, ['status', '--json']);
  assert.equal(statusRes.status, 0, statusRes.stderr);
  const data = JSON.parse(statusRes.stdout);
  assert.deepEqual(data.changes.map((c) => c.id), ['alpha25', 'beta25'], 'order must be unchanged');
  for (const c of data.changes) {
    assert.equal(c.parked, null, 'an unparked change must carry an explicit not-parked value, not undefined');
  }
  assert.equal(data.parked, 0, 'the top-level parked count must be additive, defaulting to 0');

  const observeRes = runCli(dir, ['observe', '--json']);
  assert.equal(observeRes.status, 0, observeRes.stderr);

  const validateRes = runCli(dir, ['validate']);
  assert.equal(validateRes.status, 0, validateRes.stderr);
});

// ---------- Requirement: No write escapes the project (extraction) ----------

// Row 26 — park and set-active are both real commands now; this exercises the shared
// containment guard (lib/safe-path.mjs) through both public surfaces against the same
// redirected .state/, rather than importing the module's internals directly.
test('row 26: the active-pointer containment behaviour is unchanged, and park is refused through the same guard, not by falling through to a generic usage line', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'unaffected-26', { body: STANDARD_BODY });

  // (a) Existing behaviour — already shipped, must still hold.
  const outsideA = fs.mkdtempSync(path.join(os.tmpdir(), 'wsdlc-r26a-'));
  t.after(() => fs.rmSync(outsideA, { recursive: true, force: true }));
  fs.rmSync(path.join(dir, 'sdlc/.state'), { recursive: true, force: true });
  fs.symlinkSync(outsideA, path.join(dir, 'sdlc/.state'));
  const setRes = runHook(dir, 'journal.mjs', { args: ['set-active', 'unaffected-26'] });
  assert.equal(setRes.status, 0);
  assert.match(setRes.stderr, /not recorded/, 'the existing containment refusal message must be unchanged by the extraction');
  assert.deepEqual(fs.readdirSync(outsideA), [], 'writeActive must still write nothing through a redirected .state');

  // (b) park must share the same guard.
  fs.rmSync(path.join(dir, 'sdlc/.state'), { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'sdlc/.state'), { recursive: true });
  writeChange(dir, 'to-park-26', { body: STANDARD_BODY });
  const outsideB = fs.mkdtempSync(path.join(os.tmpdir(), 'wsdlc-r26b-'));
  t.after(() => fs.rmSync(outsideB, { recursive: true, force: true }));
  fs.rmSync(path.join(dir, 'sdlc/.state'), { recursive: true, force: true });
  fs.symlinkSync(outsideB, path.join(dir, 'sdlc/.state'));
  const parkRes = runHook(dir, 'journal.mjs', { args: ['park', 'to-park-26'], stdin: { reason: 'shelved' } });
  assert.doesNotMatch(parkRes.stderr ?? '', GENERIC_USAGE,
    'park must be its own recognized command, refused by the shared containment guard — not by falling through to the generic usage line');
  assert.deepEqual(fs.readdirSync(outsideB), [], 'park must write nothing through a redirected .state either');
});

// Row 27 — a legitimate write must not be refused just because the PROJECT ROOT itself
// (not a change folder, not .state/) resolves elsewhere: containment guards the target,
// not every ancestor of the invocation path.
test('row 27: a project reached through a symlinked root still allows park and active-pointer writes', (t) => {
  const realDir = makeTempProject(t);
  runCli(realDir, ['init', '--tool', 'claude']);
  const linkDir = path.join(path.dirname(realDir), `wsdlc-link-${path.basename(realDir)}`);
  fs.symlinkSync(realDir, linkDir);
  t.after(() => fs.rmSync(linkDir, { force: true }));

  writeChange(linkDir, 'via-link', { body: STANDARD_BODY });

  const setRes = runHook(linkDir, 'journal.mjs', { args: ['set-active', 'via-link'] });
  assert.equal(setRes.status, 0, setRes.stderr);
  assert.match(setRes.stdout, /active change: via-link/, 'set-active must still succeed through a symlinked project root');

  const parkRes = runHook(linkDir, 'journal.mjs', { args: ['park', 'via-link'], stdin: { reason: 'shelved via link' } });
  assert.equal(parkRes.status, 0, parkRes.stderr);
  const { data } = parseFrontmatter(fs.readFileSync(path.join(realDir, 'sdlc/changes/via-link/change.md'), 'utf8'));
  assert.equal(typeof data.parked, 'string', 'park must succeed and write through a symlinked project root');
});

// ---------- Requirement: A change can be parked with a reason it can carry ----------

// Row 28 — the gap row 9 could not reach: its composite payload always carried a bare CR, which
// `reasonError` rejects before the reason ever reaches an echo path. A lone bidi override
// survives that check, so it is the one that proves the display guarantee.
test('row 28: a hazard character that survives the reason check is escaped and capped in every echo', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'echoed-28', { body: STANDARD_BODY });
  const reason = `shelved\u202Ekcatta${'x'.repeat(90)}`;

  const parkRes = runHook(dir, 'journal.mjs', { args: ['park', 'echoed-28'], stdin: { reason } });
  assert.equal(parkRes.status, 0, `a single-line reason must park: ${parkRes.stderr}`);

  const listing = runCli(dir, ['status', '--all']).stdout;
  const parkedLine = listing.split('\n').find((l) => l.startsWith('echoed-28 ')) ?? '';
  assert.ok(parkedLine, 'the parked change must appear under --all');
  assert.doesNotMatch(parkedLine, /\u202e/, 'status must not print a raw bidi override');
  assert.ok(parkedLine.length <= 200, `status must cap the reason, got a ${parkedLine.length}-char line`);

  const setRes = runHook(dir, 'journal.mjs', { args: ['set-active', 'echoed-28'] });
  assert.notEqual(setRes.status, 0, 'set-active must refuse a parked change');
  assert.doesNotMatch(setRes.stderr, /\u202e/, 'the refusal must not print a raw bidi override');
  assert.ok(setRes.stderr.length <= 250, `the refusal must cap the reason, got ${setRes.stderr.length} chars`);

  // The ship refusal throws, and the CLI's top-level handler prints the message — a third echo
  // path for the same field, reachable directly and through ship.md step 2.
  const shipRes = runCli(dir, ['archive', 'echoed-28']);
  assert.notEqual(shipRes.status, 0, 'a parked change must refuse to ship');
  assert.doesNotMatch(shipRes.stderr, /\u202e/, 'the ship refusal must not print a raw bidi override');
  assert.ok(shipRes.stderr.length <= 250, `the ship refusal must cap the reason, got ${shipRes.stderr.length} chars`);
});

// ---------- Requirement: No write escapes the project ----------

// Row 29 \u2014 the FIRST withdrawal-defect regression from the second attempt, reproduced by
// running it before it was fixed: `sdlc/.state/journal` itself replaced by a symlink to a
// directory outside the project. The old guard checked only `sdlc/.state`, never the exact
// path actually written (`sdlc/.state/journal/<id>.ndjson`), so the event \u2014 carrying the
// reason \u2014 landed outside. The assertion here is deliberately about the OUTSIDE directory,
// not the exit code: an exit-code-only check would pass whether or not the leak happened.
//
// Bite proven: reverted payload/hooks/_shared.mjs's `appendJournal` from
//   `if (!target || !pathIsContained(sdlcRoot, target)) return;`
// to
//   `if (!target) return;`
// (dropping the containment re-check), ran this row alone \u2192 RED (t.ndjson appeared in the
// outside directory with the reason inside it). Restored the file \u2192 GREEN again.
test('row 29: sdlc/.state/journal replaced by a symlink to an outside directory \u2014 nothing is ever written there', (t) => {
  const dir = initProject(t);
  const changeDir = writeChange(dir, 'journal-link-29', { body: STANDARD_BODY });
  const before = fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8');
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'wsdlc-r29-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));

  fs.rmSync(path.join(dir, 'sdlc/.state/journal'), { recursive: true, force: true });
  fs.symlinkSync(outside, path.join(dir, 'sdlc/.state/journal'));

  const res = runHook(dir, 'journal.mjs', { args: ['park', 'journal-link-29'], stdin: { reason: 'shelved via linked journal' } });

  assert.deepEqual(fs.readdirSync(outside), [], 'nothing may be written through a symlinked .state/journal \u2014 the withdrawal regression');

  const text = fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8');
  const { data } = parseFrontmatter(text);
  if (res.status === 0) {
    assert.equal(typeof data.parked, 'string', 'a successful park must actually be recorded in the frontmatter');
  } else {
    assert.equal(text, before, 'a refused park must leave the change untouched');
  }
});

// ---------- Requirement: A write that did not happen is never reported as done ----------

// Row 30 \u2014 the SECOND withdrawal-defect regression, reproduced by running it: frontmatter
// carrying two `parked:` lines. `removeFrontmatterKey` drops the FIRST matching line, but
// `parseFrontmatter` resolves a repeated key to the LAST one \u2014 so unpark reported success
// (`unparked: <id>`, exit 0) while the second line still made the change read as parked.
//
// Bite proven: reverted lib/park.mjs's `unpark()` by deleting the post-removal re-check \u2014
//   `if (parkReason(parseFrontmatter(after).data[PARKED])) { return fail(...); }`
// ran this row alone \u2192 RED (exit 0, "unparked: dup-parked-30" on stdout). Restored the
// file \u2192 GREEN again.
test('row 30: frontmatter carrying two parked: lines refuses unpark, saying it would still read as parked; the file is byte-identical', (t) => {
  const dir = initProject(t);
  const changeDir = path.join(dir, 'sdlc/changes/dup-parked-30');
  fs.mkdirSync(changeDir, { recursive: true });
  const fm = 'id: dup-parked-30\ntier: standard\nstatus: new\nparked: "first reason"\nparked: "second reason"\n';
  const originalText = `---\n${fm}---\n${STANDARD_BODY}`;
  fs.writeFileSync(path.join(changeDir, 'change.md'), originalText);

  const res = runHook(dir, 'journal.mjs', { args: ['unpark', 'dup-parked-30'] });
  assert.notEqual(res.status, 0, 'unpark must refuse when a duplicated key would leave the change still parked');
  assert.match(res.stderr ?? '', /still read as parked/i, 'the refusal must say so, not report success');
  assert.equal(fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8'), originalText, 'the file must be byte-identical');
});

// Row 31 \u2014 the THIRD defect: `main().catch(() => process.exit(0))`, the hook fail-open
// rule, also swallowed a COMMAND's own failure \u2014 a write that fails for a real reason
// (EACCES) must not read as "nothing happened, exit 0, no output".
//
// Bite proven: reverted BOTH (a) lib/park.mjs's `commit()`, removing the try/catch around
// `writeFileContained` so a thrown fs error propagates out of `park()` uncaught, and (b)
// payload/hooks/journal.mjs's local `try { result = park(...)/unpark(...) } catch (err) {
// console.error(...); process.exit(2); }`, replacing it with a bare call \u2014 so the
// exception reaches only the top-level `main().catch(() => process.exit(0))`. Ran this row
// alone \u2192 RED (exit 0, empty stdout AND stderr). Restored both files \u2192 GREEN again.
test('row 31: a read-only change.md and folder make park exit non-zero, naming the change and what failed', (t) => {
  if (process.getuid && process.getuid() === 0) {
    // A permission bit is meaningless to root \u2014 this environment cannot exercise EACCES.
    return;
  }
  const dir = initProject(t);
  const changeDir = writeChange(dir, 'readonly-31', { body: STANDARD_BODY });
  const filePath = path.join(changeDir, 'change.md');
  const originalFileMode = fs.statSync(filePath).mode;
  const originalDirMode = fs.statSync(changeDir).mode;
  // Restored INLINE, before this function returns \u2014 not only in t.after: makeTempProject's
  // own cleanup hook (registered by initProject, above) runs in registration order, so a
  // restore left to t.after here would fire AFTER it and hit a read-only tree mid-rmSync.
  // The fallback below tolerates the temp dir already being gone by the time it runs.
  const restore = () => {
    try { fs.chmodSync(changeDir, originalDirMode); } catch { /* already cleaned up */ }
    try { fs.chmodSync(filePath, originalFileMode); } catch { /* already cleaned up */ }
  };
  t.after(restore); // still-safe fallback if an assertion below throws first
  fs.chmodSync(filePath, 0o444);
  fs.chmodSync(changeDir, 0o555);

  const res = runHook(dir, 'journal.mjs', { args: ['park', 'readonly-31'], stdin: { reason: 'shelved' } });
  restore();
  assert.notEqual(res.status, 0, 'park must exit non-zero when the write itself fails \u2014 never silently');
  assert.match(res.stderr ?? '', /readonly-31/, 'the failure must name the change');
  assert.ok((res.stderr ?? '').trim().length > 0, 'the failure must say something on stderr, not exit silently');
});

// ---------- Requirement: A change can be parked with a reason it can carry ----------

// Row 32 \u2014 the reason is escaped wherever it is STORED for a later reader, not only where
// it is displayed: `observe` reads the journal back, and `ship.md` hands it to the learner.
//
// Bite proven: reverted payload/hooks/journal.mjs's
//   `...(result.reason ? { reason: escapeEntry(result.reason, 200) } : {}) `
// to store `result.reason` raw (no `escapeEntry` call). Ran this row alone \u2192 RED (the
// stored `reason` field carried the raw bidi override). Restored the file \u2192 GREEN again.
test('row 32: a park reason carrying a bidi override is stored escaped in the journal event, not raw', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'journal-echo-32', { body: STANDARD_BODY });
  const reason = 'shelved\u202ereversed';

  const res = runHook(dir, 'journal.mjs', { args: ['park', 'journal-echo-32'], stdin: { reason } });
  assert.equal(res.status, 0, res.stderr);

  const events = readJournalEvents(dir, 'journal-echo-32');
  const parkEvent = events.find((e) => e.event === 'park');
  assert.ok(parkEvent, 'a park event must be journalled');
  assert.doesNotMatch(parkEvent.reason ?? '', /\u202e/, 'the stored reason must never carry a raw bidi override');
  assert.notEqual(parkEvent.reason, reason, 'the stored reason must be the escaped form, not the raw one');
});

// ---------- Requirement: A parked change is not offered as work ----------

// Row 33 \u2014 a change parked on purpose is not forgotten work; flagging it "freed but not
// resumed" would teach the human to ignore the flag that matters. Uses `buildReport`
// directly, per the style of the old (pre-restructure) row 22 in this file.
//
// Bite proven: reverted lib/observe.mjs's
//   `if (node.parked || node.declaredBlockedBy.length === 0 || node.blockedBy.length > 0) continue;`
// to drop `node.parked ||`. Ran this row alone \u2192 RED (the flag appeared). Restored the
// file \u2192 GREEN again.
test('row 33: a parked change whose blockers have all shipped is not flagged freed-but-not-resumed by observe', (t) => {
  const dir = initProject(t);
  const blockerDir = writeChange(dir, 'blocker-33', { status: 'verified', body: STANDARD_BODY });
  writeContractTests(blockerDir);
  writeParkedChange(dir, 'forgotten-parked-33', { reason: 'on hold', blockedBy: ['blocker-33'] });
  const shipRes = runCli(dir, ['archive', 'blocker-33']);
  assert.equal(shipRes.status, 0, shipRes.stderr);

  const report = buildReport(path.join(dir, 'sdlc'));
  assert.ok(!report.flags.some((f) => f.includes('forgotten-parked-33')),
    `observe must not flag a parked change as freed-but-not-resumed; flags: ${JSON.stringify(report.flags)}`);
});

// Row 34 \u2014 a report that stops a change waiting must say it is parked rather than merely
// naming what remains, since a parked change is not simply "still working, one blocker
// left" \u2014 it will not resume on its own even once every blocker ships.
//
// Bite proven: reverted lib/relations.mjs's `renderShipImpact` still-waiting loop from
//   `const parked = w.parked ? \` \u00b7 parked (\${escapeEntry(w.parked, 60)})\` : '';`
//   `lines.push(\`\u21b3 \${w.id} waits on: \${w.remaining.join(', ')}\${parked}\`);`
// to the un-annotated `lines.push(\`\u21b3 \${w.id} waits on: \${w.remaining.join(', ')}\`);`.
// Ran this row alone \u2192 RED (no "parked" on the still-waiting line). Restored the
// file \u2192 GREEN again.
test('row 34: a parked change waiting on two blockers has its still-waiting line say parked as well as what it still waits on, when one blocker ships', (t) => {
  const dir = initProject(t);
  const blockerADir = writeChange(dir, 'blocker-34a', { status: 'verified', body: STANDARD_BODY });
  writeContractTests(blockerADir);
  writeRelatedChange(dir, 'blocker-34b', {});
  writeParkedChange(dir, 'waiter-34', { reason: 'shelved while waiting', blockedBy: ['blocker-34a', 'blocker-34b'] });

  const res = runCli(dir, ['archive', 'blocker-34a']);
  assert.equal(res.status, 0, res.stderr);
  const waitingLine = res.stdout.split('\n').find((l) => l.includes('waiter-34') && l.includes('waits on'));
  assert.ok(waitingLine, 'the still-waiting line for waiter-34 must be printed');
  assert.match(waitingLine, /blocker-34b/, 'the still-waiting line must name the remaining blocker');
  assert.match(waitingLine, /parked/i, 'the still-waiting line must also say the change is parked');
});

// Row 35 — the symmetry row 29 left open: unpark writes the same file through the same journal,
// so it needs the same proof that a hijacked journal cannot carry a write out of the project.
// Bites: reverting `appendJournal`'s `pathIsContained` guard puts <id>.ndjson in the outside dir.
test('row 35: unpark with the journal symlinked outside the project writes nothing outside it', (t) => {
  const dir = initProject(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'wsdlc-r35-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));

  writeChange(dir, 'roundtrip-35', { body: STANDARD_BODY });
  const parked = runHook(dir, 'journal.mjs', { args: ['park', 'roundtrip-35'], stdin: { reason: 'shelved' } });
  assert.equal(parked.status, 0, parked.stderr);

  fs.rmSync(path.join(dir, 'sdlc/.state/journal'), { recursive: true, force: true });
  fs.symlinkSync(outside, path.join(dir, 'sdlc/.state/journal'));

  const res = runHook(dir, 'journal.mjs', { args: ['unpark', 'roundtrip-35'] });
  assert.deepEqual(fs.readdirSync(outside), [], 'nothing may be written through a hijacked journal');

  const text = fs.readFileSync(path.join(dir, 'sdlc/changes/roundtrip-35/change.md'), 'utf8');
  const stillParked = /^parked:/m.test(text);
  assert.ok(res.status === 0 ? !stillParked : stillParked,
    'the change is either unparked, or the unpark was refused and it stayed parked — never a half state');
});

// Relations between changes — `blocked-by` / `spawned-from` frontmatter, unresolved/self/
// duplicate/cycle/chain/shape guards on validate, an archive-folder's claim to actually
// having shipped, ship-time refusal and freed/still-waiting reports, and frees-most
// ordering. Rows 1-29 of sdlc/changes/change-relations/contract/tests.md.
//
// A prior capability for setting a change aside was split OUT of this change entirely
// after an adversarial review traced most of its blockers to that one surface — it will
// return as its own change with its own security contract, and none of it belongs here.
//
// The machine surface below reflects what lib/relations.mjs, bin/cli.mjs and
// lib/validate.mjs actually implement as of this pass (T1-T10 done; T11 the archive-folder
// proof and T12 the wider escape/unreadable-neighbour handling are the newest additions —
// see lib/relations.mjs and the Design section of change.md):
//   status --json  per-change: blockedBy [ids still open — an archived-with-proof blocker
//                   is dropped], spawnedFrom [ids], waitedOnBy [ids of open changes naming
//                   this one as a blocker]
//   status --json  top-level: order [ready ids, ranked frees-most/tier/idle/id, empty
//                   when the graph does not validate], next { id } (the blocker when
//                   current is waiting, current itself otherwise, order[0] when neither)
//   status (text)  a waiting change's line carries `⇠ waiting on <ids>`; a ready change
//                   that frees others carries `⇢ frees <N>` — the same count as the json
//   validate       (via validateAll, which holds sdlcRoot, so a single-change validate as
//                   `archive` runs sees the same graph-wide verdict as a project-wide run)
//                   errors for unresolved/self/duplicate/cyclic/malformed relations, a
//                   warning for a waiting chain over 3, and an unreadable neighbour is a
//                   warning on the single-change path but an error project-wide
//   archive        reads waiting changes BEFORE merging anything; refuses while its own
//                   blocker is open; an unreadable NEIGHBOUR no longer blocks an unrelated
//                   ship (reversed design — one bad folder must not stop every ship in the
//                   project) — it warns instead and the ship proceeds; on a successful
//                   ship, reports who it freed and who is still waiting, and the ship
//                   playbook relays that report and records it in the digest
//   lib/relations.mjs archivedIds()  an archive folder is evidence, not proof: it must
//                   hold a change.md whose id matches the folder's suffix AND whose status
//                   is "shipped" — a planted or half-written folder retires nothing
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  makeTempProject, runCli, writeChange, writeContractTests, runHook, STANDARD_BODY, CLI, PKG_ROOT,
} from './helpers.mjs';
import { buildReport } from '../lib/observe.mjs';

function initProject(t) {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  return dir;
}

// Fixture writer for a change carrying the relation keys under contract. Built
// inline with node:fs (mirrors helpers.mjs's own writeChange) rather than
// modifying the shared helper for a single change's worth of extra keys.
function writeRelatedChange(projectRoot, id, {
  tier = 'standard', status = 'new', body = STANDARD_BODY, blockedBy, spawnedFrom,
} = {}) {
  const changeDir = path.join(projectRoot, 'sdlc', 'changes', id);
  fs.mkdirSync(changeDir, { recursive: true });
  let fm = `id: ${id}\ntier: ${tier}\nstatus: ${status}\n`;
  if (blockedBy) fm += `blocked-by: [${blockedBy.join(', ')}]\n`;
  if (spawnedFrom) fm += `spawned-from: [${spawnedFrom.join(', ')}]\n`;
  fs.writeFileSync(path.join(changeDir, 'change.md'), `---\n${fm}---\n${body}`);
  return changeDir;
}

// A shipping fixture needs its own requirement name whenever a second change ships into
// the same project — two ADDED requirements of the same name in one capability conflict
// at merge, which would fail the ship for a reason unrelated to what the test is checking.
function uniqueBody(requirementName) {
  return STANDARD_BODY.replace('Two-factor login', requirementName);
}

// Frontmatter with exact control over raw lines — for shapes writeRelatedChange cannot
// produce: a bare scalar, or a list holding a non-string.
function writeRawChange(projectRoot, id, { tier = 'standard', status = 'new', extraLines = [], body = STANDARD_BODY } = {}) {
  const changeDir = path.join(projectRoot, 'sdlc', 'changes', id);
  fs.mkdirSync(changeDir, { recursive: true });
  const fm = [`id: ${id}`, `tier: ${tier}`, `status: ${status}`, ...extraLines].join('\n');
  fs.writeFileSync(path.join(changeDir, 'change.md'), `---\n${fm}\n---\n${body}`);
  return changeDir;
}

// A single list entry via the multi-line `- "quoted"` form. Unlike the inline `[a, b]`
// form, `lib/frontmatter.mjs`'s coerce() trims every element before returning it, which
// would silently eat a trailing-space payload; wrapping it in quotes on its own line
// keeps the payload — including trailing whitespace — exactly as written.
function writeQuotedListChange(projectRoot, id, key, rawValue) {
  const changeDir = path.join(projectRoot, 'sdlc', 'changes', id);
  fs.mkdirSync(changeDir, { recursive: true });
  const fm = `id: ${id}\ntier: standard\nstatus: new\n${key}:\n  - "${rawValue}"\n`;
  fs.writeFileSync(path.join(changeDir, 'change.md'), `---\n${fm}---\n${STANDARD_BODY}`);
  return changeDir;
}

// A timeout-guarded CLI runner, used only where the contract explicitly requires "no walk
// hangs" — runCli/helpers.mjs carries no timeout, and it must not be modified for one test.
function runCliTimed(cwd, args, { timeout = 5000 } = {}) {
  const res = spawnSync(process.execPath, [CLI, ...args], {
    cwd, encoding: 'utf8', timeout,
    env: { ...process.env, NO_COLOR: '1', CLAUDE_CODE_SESSION_ID: undefined },
  });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '', signal: res.signal };
}

// A raw archive folder that only PARTLY proves a shipped blocker — used by row 26 to
// plant folders that must not retire a blocker still genuinely open.
function plantArchiveFolder(projectRoot, folderName, changeMdText) {
  const dir = path.join(projectRoot, 'sdlc', 'changes', 'archive', folderName);
  fs.mkdirSync(dir, { recursive: true });
  if (changeMdText !== null) fs.writeFileSync(path.join(dir, 'change.md'), changeMdText);
  return dir;
}

// ---------- Requirement: A change records what blocks it and where it came from ----------

// Row 1
test('row 1: a waiting change records both blockers; neither blocker holds a record of it', (t) => {
  const dir = initProject(t);
  writeRelatedChange(dir, 'b', {});
  writeRelatedChange(dir, 'c', {});
  writeRelatedChange(dir, 'a', { blockedBy: ['b', 'c'] });

  const res = runCli(dir, ['status', '--json']);
  assert.equal(res.status, 0, res.stderr);
  const data = JSON.parse(res.stdout);
  const a = data.changes.find((x) => x.id === 'a');
  assert.deepEqual(a?.blockedBy, ['b', 'c'], 'a must record both blockers it names');

  const bText = fs.readFileSync(path.join(dir, 'sdlc/changes/b/change.md'), 'utf8');
  const cText = fs.readFileSync(path.join(dir, 'sdlc/changes/c/change.md'), 'utf8');
  assert.doesNotMatch(bText, /blocked-by|waiting/, 'the edge must live only on the waiting side — b stores nothing');
  assert.doesNotMatch(cText, /blocked-by|waiting/, 'the edge must live only on the waiting side — c stores nothing');
});

// Row 2 — golden snapshot pinning both the old-field order/values and the additive new
// fields, per bin/cli.mjs's "JSON is a machine contract" comment.
test('row 2: a relation-free project keeps status/observe JSON order and every prior field value; new fields are additive', (t) => {
  const dir = initProject(t);
  writeChange(dir, 'alpha', { body: STANDARD_BODY });
  writeChange(dir, 'beta', { body: STANDARD_BODY.replace('## Delta: auth', '## Delta: beta-cap') });

  const statusRes = runCli(dir, ['status', '--json']);
  assert.equal(statusRes.status, 0, statusRes.stderr);
  const statusData = JSON.parse(statusRes.stdout);
  assert.deepEqual(statusData.changes.map((c) => c.id), ['alpha', 'beta'], 'the changes array must keep its order');
  for (const c of statusData.changes) {
    assert.equal(c.tier, 'standard');
    assert.equal(c.status, 'new');
    assert.equal(typeof c.title, 'string');
    assert.deepEqual(c.blockedBy, [], 'new field must be additive: empty, not undefined');
    assert.deepEqual(c.spawnedFrom, [], 'new field must be additive: empty, not undefined');
  }
  assert.equal(statusData.archived, 0);
  assert.equal(statusData.current, null);

  const observeRes = runCli(dir, ['observe', '--json']);
  assert.equal(observeRes.status, 0, observeRes.stderr);
  const observeData = JSON.parse(observeRes.stdout);
  assert.deepEqual(observeData.changes.map((c) => c.id), ['alpha', 'beta'], 'observe must keep its order too');
  assert.deepEqual(observeData.summary, { active: 2, shipped: 0, firstPassRate: null });
});

// ---------- Requirement: A relation must name a real change ----------

// Row 3
test('row 3: a blocker that resolves to no real change fails validation, naming the entry and how to fix it', (t) => {
  const dir = initProject(t);
  writeRelatedChange(dir, 'names-a-ghost', { blockedBy: ['nonexistent-change'] });

  const res = runCli(dir, ['validate']);
  assert.notEqual(res.status, 0, 'an unresolvable blocker must fail validate');
  const out = res.stdout + res.stderr;
  assert.match(out, /nonexistent-change/, 'the error must name the offending entry');
  assert.match(out, /remove/i, 'the error must say to remove it from the list to proceed');
});

// Row 4 — merges the self-reference and duplicate-entry scenarios into one.
test('row 4: a self-reference and a duplicate entry each fail validation, naming the offending entry', (t) => {
  const dir = initProject(t);
  writeRelatedChange(dir, 'self-ref', { blockedBy: ['self-ref'] });
  writeRelatedChange(dir, 'dup-target', {});
  writeRelatedChange(dir, 'dup-list', { blockedBy: ['dup-target', 'dup-target'] });

  const res = runCli(dir, ['validate']);
  assert.notEqual(res.status, 0, 'both a self-reference and a duplicate entry must fail validate');
  const out = res.stdout + res.stderr;
  assert.match(out, /self-ref/, 'the self-reference error must name the change');
  assert.match(out, /dup-target/, 'the duplicate-entry error must name the repeated id');
});

// Row 5
test('row 5: blocked-by: [archive] and [ARCHIVE] are both refused as naming no change', (t) => {
  const dir = initProject(t);
  // Distinct-cased directory NAMES (not just their blocked-by values) — a case-insensitive
  // filesystem (macOS default) would otherwise alias `names-archive-upper` onto
  // `names-archive-lower`'s folder and produce an unrelated id-mismatch error.
  writeRelatedChange(dir, 'names-archive-lower', { blockedBy: ['archive'] });
  writeRelatedChange(dir, 'names-archive-upper', { blockedBy: ['ARCHIVE'] });

  const res = runCli(dir, ['validate']);
  assert.notEqual(res.status, 0, 'blocked-by: [archive] must be refused as naming no change');
  const out = res.stdout + res.stderr;
  assert.match(out, /names-archive-lower/);
  assert.match(out, /names-archive-upper/);
});

// Row 6
test('row 6: a shipped blocker is satisfied only by its whole id, never by a suffix of the archive folder', (t) => {
  const dir = initProject(t);
  const blockerDir = writeRelatedChange(dir, 'add-auth', { status: 'verified' });
  writeContractTests(blockerDir);
  const shipRes = runCli(dir, ['archive', 'add-auth']);
  assert.equal(shipRes.status, 0, shipRes.stderr);
  // now archived under `<date>-add-auth`

  writeRelatedChange(dir, 'trusts-suffix', { blockedBy: ['auth'] });
  writeRelatedChange(dir, 'trusts-whole-id', { blockedBy: ['add-auth'] });

  const res = runCli(dir, ['validate']);
  assert.notEqual(res.status, 0, 'a blocker named by only a folder suffix must be refused');
  assert.match(res.stdout + res.stderr, /trusts-suffix/);

  const validWholeId = runCli(dir, ['validate', 'trusts-whole-id']);
  assert.equal(validWholeId.status, 0, 'the whole shipped id must satisfy the blocker');

  const statusRes = runCli(dir, ['status', '--json']);
  const data = JSON.parse(statusRes.stdout);
  const whole = data.changes.find((x) => x.id === 'trusts-whole-id');
  assert.deepEqual(whole?.blockedBy, [], 'the whole id must count as satisfied');
});

// Row 7 — widened security row: separators, "..", ":", trailing dot/space, a device
// name, an ANSI escape, a bare CR, and now a bidi override (Trojan-Source class).
test('row 7: a separator, "..", ":", a trailing dot/space, a device name, an ANSI escape, a bare CR, or a bidi override is refused, escaped and length-capped in the echo', (t) => {
  const dir = initProject(t);
  const entries = {
    'r7-separator': 'sub/dir',
    'r7-dotdot': '../../etc/passwd',
    'r7-colon': 'foo:bar',
    'r7-trailingdot': 'foo.',
    'r7-trailingspace': 'foo ',
    'r7-device': 'COM1',
    'r7-ansi': 'foo\x1b[31mred\x1b[0m',
    // A bare CR (no LF) survives the frontmatter reader's \r?\n line splitter as one entry.
    'r7-newline': 'foo\rbar',
    // U+202E RIGHT-TO-LEFT OVERRIDE — reorders what is displayed without changing a byte
    // of it (Trojan-Source class); lib/relations.mjs's escapeEntry() targets \p{Cf}.
    'r7-bidi': 'foo‮reversed',
  };
  for (const [id, value] of Object.entries(entries)) {
    writeQuotedListChange(dir, id, 'blocked-by', value);
  }

  const res = runCli(dir, ['validate']);
  assert.notEqual(res.status, 0, 'every one of these entries must be refused');
  const out = res.stdout + res.stderr;
  assert.doesNotMatch(out, /ENOENT|EACCES|no such file/,
    'refusal must come from rejecting the shape, not from an attempted filesystem read');
  assert.doesNotMatch(out, /\x1b\[31m/, 'an ANSI escape sequence must be escaped, not echoed raw');
  assert.doesNotMatch(out, /\r(?!\n)/, 'a raw control character must be escaped, not echoed raw');
  assert.doesNotMatch(out, /‮/, 'a raw bidi override must never survive into the output');
  for (const line of out.split('\n')) {
    assert.ok(line.length <= 300,
      `an echoed relation entry must be length-capped, got a ${line.length}-char line: ${JSON.stringify(line.slice(0, 40))}`);
  }
});

// Row 8
test('row 8: blocked-by as a bare scalar, and a list holding a number, each error naming the value', (t) => {
  const dir = initProject(t);
  writeRawChange(dir, 'scalar-blocker', { extraLines: ['blocked-by: change-x'] });
  writeRawChange(dir, 'numeric-blocker', { extraLines: ['blocked-by: [2026]'] });

  const res = runCli(dir, ['validate']);
  assert.notEqual(res.status, 0, 'a non-list blocked-by and a non-string list element must each fail validate');
  const out = res.stdout + res.stderr;
  assert.match(out, /change-x/, 'the scalar error must name the value');
  assert.match(out, /2026/, 'the wrong-shape list-element error must name the value');
});

// ---------- Requirement: Relations never form a cycle ----------

// Row 9
test('row 9: a cycle through a third change fails validation, naming all three, and reports no order', (t) => {
  const dir = initProject(t);
  writeRelatedChange(dir, 'cycle-a', { blockedBy: ['cycle-b'] });
  writeRelatedChange(dir, 'cycle-b', { blockedBy: ['cycle-c'] });
  writeRelatedChange(dir, 'cycle-c', { blockedBy: ['cycle-a'] });

  const res = runCli(dir, ['validate']);
  assert.notEqual(res.status, 0, 'a relation cycle must fail validate');
  const out = res.stdout + res.stderr;
  assert.match(out, /cycle-a/);
  assert.match(out, /cycle-b/);
  assert.match(out, /cycle-c/);

  const statusRes = runCli(dir, ['status', '--json']);
  const data = JSON.parse(statusRes.stdout);
  assert.ok(!Array.isArray(data.order) || !data.order.includes('cycle-a'),
    'a change caught in an unresolved cycle must not be reported as ordered');
});

// Row 10
test('row 10: a spawned-from two-change loop is an error, and no discovery walk hangs', (t) => {
  const dir = initProject(t);
  writeRelatedChange(dir, 'spawn-x', { spawnedFrom: ['spawn-y'] });
  writeRelatedChange(dir, 'spawn-y', { spawnedFrom: ['spawn-x'] });

  const res = runCliTimed(dir, ['validate']);
  assert.notEqual(res.signal, 'SIGTERM', 'validate must not hang walking a spawned-from cycle');
  assert.notEqual(res.status, 0, 'a spawned-from cycle must fail validate');
  assert.match(res.stdout + res.stderr, /spawn-x/);
  assert.match(res.stdout + res.stderr, /spawn-y/);
});

// Row 11 — exactly three (nothing) and four (warn) in one test.
test('row 11: a waiting chain of exactly three raises nothing; a chain of four warns on the length', (t) => {
  const dir = initProject(t);
  writeRelatedChange(dir, 'three-c', {});
  writeRelatedChange(dir, 'three-b', { blockedBy: ['three-c'] });
  writeRelatedChange(dir, 'three-a', { blockedBy: ['three-b'] });

  const threeRes = runCli(dir, ['validate']);
  assert.equal(threeRes.status, 0, 'a chain of exactly three must not fail validate');
  assert.doesNotMatch(threeRes.stdout, /chain/i, 'a chain of exactly three must raise no chain warning at all');

  writeRelatedChange(dir, 'four-d', {});
  writeRelatedChange(dir, 'four-c', { blockedBy: ['four-d'] });
  writeRelatedChange(dir, 'four-b', { blockedBy: ['four-c'] });
  writeRelatedChange(dir, 'four-a', { blockedBy: ['four-b'] });

  const fourRes = runCli(dir, ['validate']);
  assert.equal(fourRes.status, 0, 'a chain of four must warn, not fail validate');
  assert.match(fourRes.stdout, /chain/i, 'the warning must mention the chain');
  assert.match(fourRes.stdout, /4/, 'the warning must report the chain length');
});

// Row 12 — pins that relation checks live in validateAll (which holds sdlcRoot), not only
// on the full project-wide scan path.
test('row 12: a cycle between two changes is reported both by shipping an unrelated third change and by project-wide validate', (t) => {
  const dir = initProject(t);
  writeRelatedChange(dir, 'cyc-x', { blockedBy: ['cyc-y'] });
  writeRelatedChange(dir, 'cyc-y', { blockedBy: ['cyc-x'] });
  const thirdDir = writeRelatedChange(dir, 'third', { status: 'verified' });
  writeContractTests(thirdDir);

  const shipRes = runCli(dir, ['archive', 'third']);
  assert.notEqual(shipRes.status, 0, 'shipping an unrelated change must still see a cycle elsewhere in the graph');
  assert.match(shipRes.stderr, /cyc-x/);
  assert.match(shipRes.stderr, /cyc-y/);
  assert.ok(fs.existsSync(thirdDir), 'the refusal must happen before any write — third must not have shipped');

  const validateRes = runCli(dir, ['validate']);
  assert.notEqual(validateRes.status, 0);
  assert.match(validateRes.stdout + validateRes.stderr, /cyc-x/);
  assert.match(validateRes.stdout + validateRes.stderr, /cyc-y/);
});

// ---------- Requirement: Reporting survives a graph that does not validate ----------

// Row 13
test('row 13: status, status --json and observe stay answerable on a cycle plus a dangling relation', (t) => {
  const dir = initProject(t);
  writeRelatedChange(dir, 'cyc2-x', { blockedBy: ['cyc2-y'] });
  writeRelatedChange(dir, 'cyc2-y', { blockedBy: ['cyc2-x'] });
  // 'hand-deleted' is named but was never created — simulates a change hand-deleted after
  // another change already named it as a relation.
  writeRelatedChange(dir, 'points-nowhere', { blockedBy: ['hand-deleted'] });

  const textRes = runCli(dir, ['status']);
  assert.equal(textRes.status, 0, 'status must stay answerable on an invalid graph');
  for (const id of ['cyc2-x', 'cyc2-y', 'points-nowhere']) {
    assert.ok(textRes.stdout.includes(id), `${id} must still be listed`);
  }

  const jsonRes = runCli(dir, ['status', '--json']);
  assert.equal(jsonRes.status, 0, 'status --json must not throw on an invalid graph');
  const data = JSON.parse(jsonRes.stdout);
  assert.equal(data.changes.length, 3, 'every change must still be listed');
  const dangling = data.changes.find((x) => x.id === 'points-nowhere');
  assert.deepEqual(dangling?.blockedBy, ['hand-deleted'],
    'a dangling relation must still be reported as data, not hidden');
  assert.ok(!Array.isArray(data.order) || data.order.length === 0,
    'an invalid graph must claim no ordering');

  const observeRes = runCli(dir, ['observe']);
  assert.equal(observeRes.status, 0, 'observe must stay answerable on an invalid graph too');
  const observeJsonRes = runCli(dir, ['observe', '--json']);
  assert.equal(observeJsonRes.status, 0);
  const oData = JSON.parse(observeJsonRes.stdout);
  assert.equal(oData.changes.filter((c) => !c.archived).length, 3, 'observe must still list every open change');
});

// ---------- Requirement: Status says why a change is paused ----------

// Row 14
test('row 14: a change waiting on two others is shown paused, naming both, distinguishable from idle', (t) => {
  const dir = initProject(t);
  writeRelatedChange(dir, 'idle', {});
  writeRelatedChange(dir, 'blocker-p', {});
  writeRelatedChange(dir, 'blocker-q', {});
  writeRelatedChange(dir, 'paused', { blockedBy: ['blocker-p', 'blocker-q'] });

  const textRes = runCli(dir, ['status']);
  const lines = textRes.stdout.split('\n');
  const pausedLine = lines.find((l) => l.startsWith('paused '));
  assert.ok(pausedLine, 'the paused change must still be listed');
  assert.match(pausedLine, /blocker-p/);
  assert.match(pausedLine, /blocker-q/);
  const idleLine = lines.find((l) => l.startsWith('idle '));
  assert.doesNotMatch(idleLine ?? '', /blocker-p|blocker-q/, 'an idle change must read differently from a paused one');

  const jsonRes = runCli(dir, ['status', '--json']);
  const data = JSON.parse(jsonRes.stdout);
  const c = data.changes.find((x) => x.id === 'paused');
  assert.deepEqual(c?.blockedBy, ['blocker-p', 'blocker-q'], 'machine output must carry both names as data');
});

// ---------- Requirement: Shipping refuses while a blocker is still open ----------

// Row 15
test('row 15: ship refuses while a blocker is still open — specs, status and folder untouched', (t) => {
  const dir = initProject(t);
  writeRelatedChange(dir, 'open-blocker', {});
  const changeDir = writeRelatedChange(dir, 'waiter-15', { status: 'verified', blockedBy: ['open-blocker'] });
  writeContractTests(changeDir);

  const specPath = path.join(dir, 'sdlc/specs/auth/spec.md');
  const specExistedBefore = fs.existsSync(specPath);
  const changeBefore = fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8');

  const res = runCli(dir, ['archive', 'waiter-15']);
  assert.notEqual(res.status, 0, 'ship must refuse while a blocker is still open');
  assert.match(res.stderr, /open-blocker/, 'the refusal must name the open blocker');

  assert.equal(fs.existsSync(specPath), specExistedBefore, 'the living spec must be untouched');
  assert.equal(fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8'), changeBefore,
    'the waiting change\'s own status must be untouched');
  assert.ok(fs.existsSync(changeDir), 'the change folder must not have moved');
});

// Row 16
test('row 16: a blocker still under changes/ but stamped status: shipped still counts as open', (t) => {
  const dir = initProject(t);
  // Never actually archived — the folder is still directly under sdlc/changes/.
  writeRelatedChange(dir, 'stamped-shipped', { status: 'shipped' });
  const waiterDir = writeRelatedChange(dir, 'waiter-16', { status: 'verified', blockedBy: ['stamped-shipped'] });
  writeContractTests(waiterDir);

  const res = runCli(dir, ['archive', 'waiter-16']);
  assert.notEqual(res.status, 0, 'a blocker only stamped shipped, but not archived, must still count as open');
  assert.match(res.stderr, /stamped-shipped/);
  assert.ok(fs.existsSync(waiterDir), 'the waiting change must not have shipped');
});

// ---------- Requirement: Shipping reports who it freed and who is still waiting ----------

// Row 17
test('row 17: shipping one of two blockers reports the waiter as still waiting, naming what remains', (t) => {
  const dir = initProject(t);
  const firstDir = writeRelatedChange(dir, 'first-blocker', { status: 'verified' });
  writeContractTests(firstDir);
  writeRelatedChange(dir, 'second-blocker', {});
  writeRelatedChange(dir, 'waiter-17', { blockedBy: ['first-blocker', 'second-blocker'] });

  const res = runCli(dir, ['archive', 'first-blocker']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /waiter-17/, 'the ship report must name the still-waiting change');
  assert.match(res.stdout, /second-blocker/, 'the ship report must name the remaining blocker');
  assert.doesNotMatch(res.stdout, /waiter-17[^\n]*resumable/i, 'a still-waiting change must not be announced as resumable');
});

// Row 18
test('row 18: shipping the last blocker reports the waiter free to resume, with the resume command', (t) => {
  const dir = initProject(t);
  const onlyDir = writeRelatedChange(dir, 'only-blocker', { status: 'verified' });
  writeContractTests(onlyDir);
  writeRelatedChange(dir, 'waiter-18', { blockedBy: ['only-blocker'] });

  const res = runCli(dir, ['archive', 'only-blocker']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /waiter-18/, 'the ship report must name the freed change');
  assert.match(res.stdout, /resume/i, 'the report must say it is free to resume');
  assert.match(res.stdout, /waiter-18[^\n]*(set-active|resume)/i, 'the report must carry the command that resumes it');
});

// Row 19
test('row 19: waiting on one open and one already-archived blocker; the open one shipping frees it to resume', (t) => {
  const dir = initProject(t);
  const archivedDir = writeRelatedChange(dir, 'already-archived', { status: 'verified', body: uniqueBody('Archived Blocker Feature') });
  writeContractTests(archivedDir);
  const shipArchived = runCli(dir, ['archive', 'already-archived']);
  assert.equal(shipArchived.status, 0, shipArchived.stderr);

  const openDir = writeRelatedChange(dir, 'still-open-19', { status: 'verified', body: uniqueBody('Open Blocker Feature') });
  writeContractTests(openDir);
  writeRelatedChange(dir, 'waiter-19', { blockedBy: ['already-archived', 'still-open-19'] });

  const res = runCli(dir, ['archive', 'still-open-19']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /waiter-19/, 'the ship report must name the freed change');
  assert.match(res.stdout, /resume/i, 'the change must be reported free to resume');
  assert.doesNotMatch(res.stdout, /waiter-19[^\n]*still waiting/i,
    'an already-archived blocker must never leave the waiter reported as still waiting');
});

// Row 20
test('row 20: a diamond — D waits on B and C, both wait on A — reports B and C freed, D still waiting, when A ships', (t) => {
  const dir = initProject(t);
  const aDir = writeRelatedChange(dir, 'diamond-a', { status: 'verified' });
  writeContractTests(aDir);
  writeRelatedChange(dir, 'diamond-b', { blockedBy: ['diamond-a'] });
  writeRelatedChange(dir, 'diamond-c', { blockedBy: ['diamond-a'] });
  writeRelatedChange(dir, 'diamond-d', { blockedBy: ['diamond-b', 'diamond-c'] });

  const res = runCli(dir, ['archive', 'diamond-a']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /diamond-b/, 'B must be mentioned in the freed report');
  assert.match(res.stdout, /diamond-c/, 'C must be mentioned in the freed report');
  assert.match(res.stdout, /resume/i, 'the freed changes must be reported resumable');
  assert.match(res.stdout, /diamond-d/, 'D must be mentioned as still waiting');
  assert.doesNotMatch(res.stdout, /diamond-d[\s\S]*resumable/i, 'D must not be announced as resumable — it still waits on two');

  const statusRes = runCli(dir, ['status', '--json']);
  const data = JSON.parse(statusRes.stdout);
  assert.ok(!(data.order ?? []).includes('diamond-d'), 'D must not be offered as ready work while still waiting');
  assert.notEqual(data.next?.id, 'diamond-d', 'D must never be offered as the next work while waiting');
});

// Row 21 — the design REVERSED here (review finding A8): an unreadable neighbour must no
// longer block every ship in the project. Shipping an unrelated change now SUCCEEDS, with
// a stderr warning naming the unreadable change; only a project-wide validate treats it
// as an error. The EISDIR mechanism (change.md replaced by a directory) is unchanged.
test('row 21: an unreadable neighbour lets an unrelated ship succeed with a warning, but still fails project-wide validate', (t) => {
  const dir = initProject(t);
  const blockerDir = writeRelatedChange(dir, 'blocker-21', { status: 'verified' });
  writeContractTests(blockerDir);
  const waiterDir = writeRelatedChange(dir, 'waiter-21', { blockedBy: ['blocker-21'] });

  // EISDIR is deterministic reading a directory back as a file, on every platform —
  // unlike a permission bit, which behaves differently as root.
  fs.rmSync(path.join(waiterDir, 'change.md'));
  fs.mkdirSync(path.join(waiterDir, 'change.md'));

  const res = runCli(dir, ['archive', 'blocker-21']);
  assert.equal(res.status, 0, 'an unreadable neighbour must not block an unrelated ship');
  assert.match(res.stderr, /waiter-21/, 'the warning must name the unreadable change');
  assert.match(res.stderr, /cannot be read|unknown/i, 'the warning must say relations involving it are unknown');

  const validateRes = runCli(dir, ['validate']);
  assert.notEqual(validateRes.status, 0, 'project-wide validate must still report the unreadable change as an error');
  assert.match(validateRes.stdout + validateRes.stderr, /waiter-21/,
    'project-wide validate must name the unreadable change, not just fail silently or crash unattributed');
});

// ---------- Requirement: A change freed long ago but never resumed is surfaced ----------

// Row 22
test('row 22: a change whose blockers all shipped, with no activity since, is flagged freed but not resumed', (t) => {
  const dir = initProject(t);
  const blockerDir = writeRelatedChange(dir, 'past-blocker', { status: 'verified' });
  writeContractTests(blockerDir);
  writeRelatedChange(dir, 'forgotten', { blockedBy: ['past-blocker'] });
  const shipRes = runCli(dir, ['archive', 'past-blocker']);
  assert.equal(shipRes.status, 0, shipRes.stderr);

  const report = buildReport(path.join(dir, 'sdlc'));
  assert.ok(report.flags.some((f) => f.includes('forgotten') && /freed/i.test(f) && /not resumed/i.test(f)),
    `observe must flag the freed-but-not-resumed change; flags: ${JSON.stringify(report.flags)}`);
});

// Row 23
test('row 23: a change two others wait on is flagged with how many wait on it', (t) => {
  const dir = initProject(t);
  writeRelatedChange(dir, 'popular', {});
  writeRelatedChange(dir, 'waiter-x', { blockedBy: ['popular'] });
  writeRelatedChange(dir, 'waiter-y', { blockedBy: ['popular'] });

  const report = buildReport(path.join(dir, 'sdlc'));
  assert.ok(report.flags.some((f) => f.includes('popular') && /2/.test(f)),
    `observe must flag how many other changes wait on "popular"; flags: ${JSON.stringify(report.flags)}`);
});

// ---------- Requirement: Among ready changes, the one that frees the most goes first ----------

// Row 24 — additionally asserts the frees-count rides the human `status` listing, not
// only the json (bin/cli.mjs renders `  ⇢ frees N` on a ready change's line).
test('row 24: among ready changes, the one that frees the most is ordered first, with the count that decided it — in both the human and machine listings', (t) => {
  const dir = initProject(t);
  writeRelatedChange(dir, 'frees-two', {});
  writeRelatedChange(dir, 'frees-none', {});
  writeRelatedChange(dir, 'dep-1', { blockedBy: ['frees-two'] });
  writeRelatedChange(dir, 'dep-2', { blockedBy: ['frees-two'] });

  const res = runCli(dir, ['status', '--json']);
  const data = JSON.parse(res.stdout);
  assert.deepEqual((data.order ?? []).slice(0, 2), ['frees-two', 'frees-none'],
    'the change that frees more must be ordered ahead of the one that frees none');
  const c = data.changes.find((x) => x.id === 'frees-two');
  assert.equal(c?.waitedOnBy?.length, 2, 'the count that decided the order must be exposed in the json');

  const textRes = runCli(dir, ['status']);
  const freesLine = textRes.stdout.split('\n').find((l) => l.startsWith('frees-two '));
  assert.ok(freesLine, 'frees-two must be listed in the human status output');
  assert.match(freesLine, /frees 2/, 'the frees-count must also render in the human status listing');
});

// Row 25
test('row 25: order is stable across runs for ready changes with no recorded activity (a fresh checkout)', (t) => {
  const dir = initProject(t);
  writeRelatedChange(dir, 'ready-1', {});
  writeRelatedChange(dir, 'ready-2', {});
  writeRelatedChange(dir, 'ready-3', {});
  // sdlc/.state is gitignored — a fresh checkout carries no journal for any of them.
  fs.rmSync(path.join(dir, 'sdlc/.state/journal'), { recursive: true, force: true });

  const res1 = JSON.parse(runCli(dir, ['status', '--json']).stdout);
  const res2 = JSON.parse(runCli(dir, ['status', '--json']).stdout);
  assert.ok(Array.isArray(res1.order) && res1.order.length === 3, 'all three ready changes must be ordered');
  assert.deepEqual(res1.order, res2.order, 'the order must be stable across runs with no activity recorded');
});

// Row 26 — security regression: `changes/archive/` is ordinary repo content, so a planted
// or half-written folder must never retire a blocker that has not really shipped. Covers
// an empty planted folder and a folder whose change.md lies about its id or status.
test('row 26: a planted or lying archive folder never satisfies a blocker — the real, still-open one still counts', (t) => {
  const dir = initProject(t);

  writeRelatedChange(dir, 'blocker-empty', {});
  const emptyFake = plantArchiveFolder(dir, '2024-01-01-blocker-empty', null);

  writeRelatedChange(dir, 'blocker-wrong-id', {});
  const idFake = plantArchiveFolder(dir, '2024-01-01-blocker-wrong-id',
    '---\nid: someone-else\ntier: standard\nstatus: shipped\n---\n# Change: x\n## Why\ny\n');

  writeRelatedChange(dir, 'blocker-wrong-status', {});
  const statusFake = plantArchiveFolder(dir, '2024-01-01-blocker-wrong-status',
    '---\nid: blocker-wrong-status\ntier: standard\nstatus: verified\n---\n# Change: x\n## Why\ny\n');

  const waitOn = [
    ['blocker-empty', 'waits-empty', emptyFake],
    ['blocker-wrong-id', 'waits-wrong-id', idFake],
    ['blocker-wrong-status', 'waits-wrong-status', statusFake],
  ];
  for (const [blockerId, waiterId] of waitOn) {
    const waiterDir = writeRelatedChange(dir, waiterId, {
      status: 'verified', blockedBy: [blockerId], body: uniqueBody(`Feature for ${waiterId}`),
    });
    writeContractTests(waiterDir);
  }

  const statusData = JSON.parse(runCli(dir, ['status', '--json']).stdout);
  for (const [blockerId, waiterId] of waitOn) {
    const c = statusData.changes.find((x) => x.id === waiterId);
    assert.deepEqual(c?.blockedBy, [blockerId], `${blockerId} must still count as open despite the planted archive folder`);
  }

  for (const [, waiterId, fakeDir] of waitOn) {
    const res = runCli(dir, ['archive', waiterId]);
    assert.notEqual(res.status, 0, `shipping ${waiterId} must be refused — its blocker never really shipped`);
    assert.ok(fs.existsSync(path.join(dir, 'sdlc/changes', waiterId)), `${waiterId} must not have shipped`);
    assert.ok(fs.existsSync(fakeDir), 'the planted archive folder must still be in place, untouched');
  }
});

// Row 27 — payload-content assertion, in the style of tests/payload.test.mjs: read the
// ship playbook and assert on its text, no CLI involved.
test('row 27: the ship playbook tells the stage to relay the freed / still-waiting report and record it in the digest', () => {
  const shipMd = fs.readFileSync(path.join(PKG_ROOT, 'payload/playbook/ship.md'), 'utf8');
  assert.match(shipMd, /is free to resume/i, 'ship.md must reference the freed-report line');
  assert.match(shipMd, /waits on/i, 'ship.md must reference the still-waiting-report line');
  assert.match(shipMd, /relay/i, 'ship.md must instruct the stage to relay the report to the human');
  assert.match(shipMd, /digest/i, 'ship.md must instruct the stage to record the report in the digest');
  assert.match(shipMd, /freed/i, 'the digest instructions must mention the freed changes by name');
  assert.match(shipMd, /waiting/i, 'the digest instructions must mention the still-waiting changes by name');
});

// ---------- Delta: change-focus — Next answers for this session's change first ----------

// Row 28
test('row 28: the session\'s own blocked change is never the next step — the blocker is named instead', (t) => {
  const dir = initProject(t);
  writeRelatedChange(dir, 'the-blocker', {});
  writeRelatedChange(dir, 'the-waiter', { blockedBy: ['the-blocker'] });

  const setRes = runHook(dir, 'journal.mjs', { args: ['set-active', 'the-waiter'], env: { CLAUDE_CODE_SESSION_ID: 's1' } });
  assert.equal(setRes.status, 0, setRes.stderr);

  const res = runCli(dir, ['status', '--json'], { env: { CLAUDE_CODE_SESSION_ID: 's1' } });
  const data = JSON.parse(res.stdout);
  assert.equal(data.current?.id, 'the-waiter', 'the session marker still names the session\'s own change');
  assert.equal(data.next?.id, 'the-blocker', 'the next step reported must be the blocker, not the waiting change');
});

// ---------- Requirement: Among ready changes, the one that frees the most goes first (cont'd) ----------

// Row 29 — a waiting change is absent from the order, a ready one is present.
test('row 29: a waiting change is absent from the order; a ready change is present', (t) => {
  const dir = initProject(t);
  writeRelatedChange(dir, 'ready-29', {});
  writeRelatedChange(dir, 'blocker-29', {});
  writeRelatedChange(dir, 'waiting-29', { blockedBy: ['blocker-29'] });

  const res = runCli(dir, ['status', '--json']);
  const data = JSON.parse(res.stdout);
  assert.ok(Array.isArray(data.order), 'order must be reported');
  assert.ok(data.order.includes('ready-29'), 'a ready change must be named in the order');
  assert.ok(!data.order.includes('waiting-29'), 'a waiting change must not be named in the order');
});

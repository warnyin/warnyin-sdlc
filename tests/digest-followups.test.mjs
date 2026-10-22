// Contract rows for digest-followups: sdlc/changes/digest-followups/contract/tests.md.
// Rows 1–5 drive observe over open changes (journals in mkdtemp projects). Rows 6–10 pin payload,
// docs and harness prose as EXACT sentences (tests/rule-pins.mjs); row 6 also runs the snapshot
// commands review.md prescribes in a mkdtemp git repo. Rows 11–13 guard the helper, the removed
// guard rows and the CHANGELOG entry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeTempProject, runCli, writeChange, writeContractTests, STANDARD_BODY, PKG_ROOT } from './helpers.mjs';
import { buildReport } from '../lib/observe.mjs';
import { CAPS, countEffectiveLines } from '../lib/caps.mjs';
import { assertRule, assertSentence, nonEmpty, oneLine, payload, section } from './rule-pins.mjs';
import { runMutants } from './mutation.mjs';

// Sentences, verbatim from tests.md. B1 holds a literal backslash before s, t and u0001.
const RULES = Object.freeze({
  R1: "Take the change's diff from a snapshot of the tree: with a scratch index at a path that does not exist yet, `GIT_INDEX_FILE=<tmp> git add -A` then `git write-tree`, so untracked files are in it and the real index is untouched; the change's diff is `git diff HEAD <tree>`.",
  R1b: 'Commit every other open change first, so the snapshot holds this change alone; every path it lists goes to the reviewers.',
  R1c: 'A file that must never reach a reviewer must be untracked and matched by `.gitignore` before the snapshot; a tracked file is in the snapshot whatever `.gitignore` says.',
  R2: "Every review note but the skip note carries that snapshot as `base=<tree>`, and a repeated panel's fix diff comes from `git diff <base> <tree>`, with `<tree>` taken the same way now; if git has pruned `<base>`, the repeated panel gets the change's whole diff instead.",
  R5: '`node sdlc/.hooks/journal.mjs note review blockers=<n> mode=<panel|solo> base=<tree>`.',
  V4: 'Mutants are made in a copy of the tree, never in the working tree, so an interrupted run leaves nothing mutated.',
  R3: "The human's reason line in change.md starts with `closed=human:` and says why.",
  R4: 'Each lens reviewer is handed this rule with its brief.',
  V1: 'Verify never writes a `review` note, the skip note included.',
  V2: 'A mutation count stands only on a passing baseline: the unmutated tests run first, and a red baseline voids the count.',
  V3: "A pass journaled before its suite was green is corrected, never deleted: `node sdlc/.hooks/journal.mjs note correction gate=<fast|final> round=<n>`, then the re-run's verify note carries `rerun=yes`.",
  B1: String.raw`Write file text with the file tools, never a shell heredoc: the shell drops ` + '`' + String.raw`\s` + '`, `' + String.raw`\t` + '` and `' + String.raw`\u0001` + '`, so scan each written file for control characters.',
  D1: 'An agent file carries verbatim a rule it applies; a term it only reads is defined once, in the playbook, and the agent points there.',
  H1: "Its own exit code decides a pass; a pipe reports the last stage's exit, not the suite's.",
  S8: 'A finding is a security, data-loss or contract defect by its effect, not by the label it carries; when unsure, it is one.',
});

const FLAG = (id) => `${id}: a blocker closed by a human has no reason in change.md`;

// Journal stream of an open change: sdlc/.state/journal/<id>.ndjson (the layout observe reads).
function journalLine(changeDir, event) {
  const live = path.resolve(changeDir, '..', '..', '.state', 'journal', `${path.basename(changeDir)}.ndjson`);
  fs.mkdirSync(path.dirname(live), { recursive: true });
  fs.appendFileSync(live, JSON.stringify(event) + '\n');
}

function initProject(t) {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  return dir;
}

const sdlcOf = (dir) => path.join(dir, 'sdlc');
const changeOf = (dir, id) => buildReport(sdlcOf(dir)).changes.find((x) => x.id === id);

function observeLine(dir, id) {
  const res = runCli(dir, ['observe']);
  assert.equal(res.status, 0, res.stderr);
  return res.stdout.split(/\r?\n/).find((l) => l.includes(` ${id} `)) ?? '';
}

// A verify note in the shape the playbook writes it.
const verifyNote = (round, result = 'pass', extra = {}) => ({
  event: 'verify', result, round: String(round), gate: 'fast', mode: 'solo', ...extra,
});
const closedReview = (closed) => ({ event: 'review', blockers: '0', mode: 'solo', closed });

test('row 1: closed=human reviews count as humanClosed and show human-closed×N; none shows none', (t) => {
  const dir = initProject(t);
  const cd = writeChange(dir, 'closes-two', { status: 'building', body: STANDARD_BODY });
  const plain = writeChange(dir, 'closes-none', { status: 'building', body: STANDARD_BODY });
  journalLine(cd, closedReview('human'));
  journalLine(cd, closedReview(' Human '));
  journalLine(plain, { event: 'review', blockers: '0', mode: 'panel' });
  assert.equal(changeOf(dir, 'closes-two').humanClosed, 2);
  assert.equal(changeOf(dir, 'closes-none').humanClosed, 0);
  assert.ok(observeLine(dir, 'closes-two').includes('human-closed×2'), 'observe text shows human-closed×2');
  assert.ok(!observeLine(dir, 'closes-none').includes('human-closed×'), 'no closure shows no human-closed×');
});

test('row 2: a correction event counts as corrections 1 and shows corrected×1; none shows none', (t) => {
  const dir = initProject(t);
  const fixed = writeChange(dir, 'fixed-later', { status: 'building', body: STANDARD_BODY });
  const clean = writeChange(dir, 'clean-run', { status: 'building', body: STANDARD_BODY });
  journalLine(fixed, { event: 'correction', gate: 'fast', round: '1' });
  journalLine(clean, verifyNote(1));
  assert.equal(changeOf(dir, 'fixed-later').corrections, 1);
  assert.equal(changeOf(dir, 'clean-run').corrections, 0);
  assert.ok(observeLine(dir, 'fixed-later').includes('corrected×1'), 'observe text shows corrected×1');
  assert.ok(!observeLine(dir, 'clean-run').includes('corrected×'), 'no correction shows no corrected×');
});

test('row 3: a rerun=yes pass replaces the earlier pass of its gate and round; rounds are 2', (t) => {
  const dir = initProject(t);
  const cd = writeChange(dir, 'rerun-replaces', { status: 'building', body: STANDARD_BODY });
  journalLine(cd, verifyNote(1));
  journalLine(cd, verifyNote(3));
  journalLine(cd, { event: 'correction', gate: 'fast', round: '3' });
  journalLine(cd, verifyNote(3, 'pass', { rerun: 'YES' }));
  assert.equal(changeOf(dir, 'rerun-replaces').verify.rounds, 2);
  assert.ok(observeLine(dir, 'rerun-replaces').includes('corrected×1'), 'the scenario shows corrected×1');
});

test('row 4: a rerun replaces nothing without an earlier pass at its gate and round, and never a fail', (t) => {
  const dir = initProject(t);
  const alone = writeChange(dir, 'rerun-alone', { status: 'building', body: STANDARD_BODY });
  journalLine(alone, verifyNote(1, 'pass', { rerun: 'yes' }));
  assert.equal(changeOf(dir, 'rerun-alone').verify.rounds, 1, 'a rerun with nothing before it counts');

  const other = writeChange(dir, 'rerun-other', { status: 'building', body: STANDARD_BODY });
  journalLine(other, verifyNote(1));
  journalLine(other, verifyNote(2));
  journalLine(other, verifyNote(3, 'pass', { rerun: 'yes' }));
  journalLine(other, verifyNote(3, 'pass', { rerun: 'yes', gate: 'final' }));
  assert.equal(changeOf(dir, 'rerun-other').verify.rounds, 3, 'a different round or gate replaces nothing');

  const afterFail = writeChange(dir, 'rerun-after-fail', { status: 'building', body: STANDARD_BODY });
  journalLine(afterFail, verifyNote(3, 'fail'));
  journalLine(afterFail, { event: 'correction', gate: 'fast', round: '3' });
  journalLine(afterFail, verifyNote(3, 'pass', { rerun: 'yes' }));
  const c = changeOf(dir, 'rerun-after-fail');
  assert.equal(c.verify.rounds, 2, 'a recorded fail is never erased');
  assert.equal(c.verify.firstPass, false);

  const uncorrected = writeChange(dir, 'rerun-uncorrected', { status: 'building', body: STANDARD_BODY });
  journalLine(uncorrected, verifyNote(3));
  journalLine(uncorrected, verifyNote(3, 'pass', { rerun: 'yes' }));
  assert.equal(changeOf(dir, 'rerun-uncorrected').verify.rounds, 2, 'without a correction between them, nothing is replaced');

  const failedRerun = writeChange(dir, 'rerun-fails', { status: 'building', body: STANDARD_BODY });
  journalLine(failedRerun, verifyNote(3));
  journalLine(failedRerun, { event: 'correction', gate: 'fast', round: '3' });
  journalLine(failedRerun, verifyNote(3, 'fail', { rerun: 'yes' }));
  const f = changeOf(dir, 'rerun-fails');
  assert.equal(f.verify.rounds, 1, 'the corrected pass gives way to the re-run, here a fail');
  assert.equal(f.verify.firstPass, false, 'a corrected pass is not a first pass');
});

test('row 5: a closed=human review without a non-empty closed=human: line is flagged; with one it is not', (t) => {
  const dir = initProject(t);
  const cases = {
    'human-no-why': STANDARD_BODY,
    'human-empty-why': `${STANDARD_BODY}\nclosed=human:   \n`,
    'human-with-why': `${STANDARD_BODY}\nclosed=human: committed the other change first\n`,
  };
  for (const [id, body] of Object.entries(cases)) {
    journalLine(writeChange(dir, id, { status: 'building', body }), closedReview('human'));
  }
  const twice = writeChange(dir, 'human-twice-one-why', {
    status: 'building', body: `${STANDARD_BODY}\nclosed=human: the first one\n`,
  });
  journalLine(twice, closedReview('human'));
  journalLine(twice, closedReview('human'));
  const { flags } = buildReport(sdlcOf(dir));
  assert.ok(flags.includes(FLAG('human-no-why')), `flags were: ${JSON.stringify(flags)}`);
  assert.ok(flags.includes(FLAG('human-empty-why')), 'an empty reason is no reason');
  assert.ok(flags.includes(FLAG('human-twice-one-why')), 'two closures need two reason lines');
  assert.ok(!flags.includes(FLAG('human-with-why')), 'a written reason is not flagged');

  // A shipped change.md is immutable, so an archived closure without a reason is not flagged.
  const shipped = writeChange(dir, 'human-archived', { status: 'verified', body: STANDARD_BODY.replace('## Delta: auth', '## Delta: shipped-cap') });
  writeContractTests(shipped);
  journalLine(shipped, closedReview('human'));
  assert.equal(runCli(dir, ['archive', 'human-archived']).status, 0);
  const after = buildReport(sdlcOf(dir));
  const archived = after.changes.find((c) => c.archived && c.id.endsWith('human-archived'));
  assert.equal(archived?.humanClosed, 1, 'the archived journal still counts its closure');
  assert.ok(!after.flags.some((f) => f.includes('human-archived') && f.includes('closed by a human')),
    'an archived change is never flagged for a missing reason');
});

// git with the caller's repository variables removed, so a hook's GIT_DIR or GIT_INDEX_FILE can
// never point these commands at the repository that runs the suite.
function git(cwd, args, env = {}) {
  const base = { ...process.env };
  for (const k of ['GIT_DIR', 'GIT_INDEX_FILE', 'GIT_WORK_TREE', 'GIT_OBJECT_DIRECTORY']) delete base[k];
  const res = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...base, ...env } });
  assert.equal(res.status, 0, `git ${args.join(' ')}: ${res.stderr}`);
  return res.stdout.trim();
}

test('row 6: review.md states how the diffs are built, and the snapshot commands behave as stated', (t) => {
  const review = nonEmpty(payload('playbook', 'review.md'), 'playbook/review.md');
  for (const key of ['R1', 'R1b', 'R1c', 'R2']) assertSentence(review, RULES[key], 'playbook/review.md');

  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-snapshot-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  git(repo, ['init', '-q']);
  git(repo, ['config', 'user.email', 't@t']);
  git(repo, ['config', 'user.name', 't']);
  git(repo, ['config', 'core.autocrlf', 'false']);
  fs.writeFileSync(path.join(repo, 'a.txt'), 'a\n');
  git(repo, ['add', '.']);
  git(repo, ['commit', '-qm', 'init']);
  fs.appendFileSync(path.join(repo, 'a.txt'), 'b\n');
  fs.writeFileSync(path.join(repo, 'new.txt'), 'new\n');
  const snapshot = (n) => {
    const scratch = { GIT_INDEX_FILE: path.join(repo, '.git', `scratch-index-${n}`) };
    git(repo, ['add', '-A'], scratch);
    return git(repo, ['write-tree'], scratch);
  };
  const before = git(repo, ['status', '--porcelain']);
  const base = snapshot(1);
  assert.ok(git(repo, ['diff', '--name-only', 'HEAD', base]).split('\n').includes('new.txt'),
    'the untracked file is in the snapshot diff');
  assert.equal(git(repo, ['status', '--porcelain']), before, 'the real index is untouched');

  // The repeated panel: a file created after the base is in the fix diff; an untouched one is not.
  fs.writeFileSync(path.join(repo, 'later.txt'), 'later\n');
  const now = snapshot(2);
  assert.deepEqual(git(repo, ['diff', '--name-only', base, now]).split('\n'), ['later.txt'],
    'the fix diff holds exactly the edits since base');

  // R1c: .gitignore keeps an untracked file out of the snapshot, never a tracked one.
  fs.writeFileSync(path.join(repo, '.gitignore'), 'secret.env\na.txt\n');
  fs.writeFileSync(path.join(repo, 'secret.env'), 'TOKEN=x\n');
  const ignored = git(repo, ['diff', '--name-only', 'HEAD', snapshot(3)]).split('\n');
  assert.ok(!ignored.includes('secret.env'), 'an untracked, ignored file is not in the snapshot');
  assert.ok(ignored.includes('a.txt'), 'a tracked file is in the snapshot whatever .gitignore says');
});

// The lens bullet: from `- Plus one reviewer per recorded lens` through its deeper-indented lines.
function lensBullet(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trimStart().startsWith('- Plus one reviewer per recorded lens'));
  assert.ok(start !== -1, 'review.md has no lens bullet');
  const indent = lines[start].length - lines[start].trimStart().length;
  let end = start + 1;
  while (end < lines.length && lines[end].trim() !== '' && lines[end].length - lines[end].trimStart().length > indent) end += 1;
  return lines.slice(start, end).join('\n');
}

test('row 7: review.md states the closing-reason line, and the lens bullet hands lens reviewers the effect rule', () => {
  const review = nonEmpty(payload('playbook', 'review.md'), 'playbook/review.md');
  assertSentence(review, RULES.R3, 'playbook/review.md');
  assert.ok(oneLine(review).includes(RULES.R5), 'review.md step 4 writes the note with base=<tree>');
  // Every review-note command but the skip note carries the snapshot.
  const commands = oneLine(review).match(/note review blockers=[^`]*/g) ?? [];
  assert.ok(commands.length >= 3, `review.md has its review-note commands, found ${commands.length}`);
  for (const cmd of commands.filter((c) => !c.includes('skipped='))) {
    assert.ok(cmd.includes('base=<tree>'), `review.md command "${cmd}" must carry base=<tree>`);
  }
  const lens = nonEmpty(lensBullet(review), 'review.md lens bullet');
  assertSentence(lens, RULES.R4, 'review.md lens bullet');
  assertSentence(lens, RULES.S8, 'review.md lens bullet');
});

test('row 8: verify.md states V1, V2 and V3 as exact sentences', () => {
  const verify = nonEmpty(payload('playbook', 'verify.md'), 'playbook/verify.md');
  for (const key of ['V1', 'V2', 'V3', 'V4']) assertSentence(verify, RULES[key], 'playbook/verify.md');
});

test('row 9: build.md states B1 and docs/design.md states D1 as exact sentences', () => {
  assertSentence(payload('playbook', 'build.md'), RULES.B1, 'playbook/build.md');
  const design = fs.readFileSync(path.join(PKG_ROOT, 'docs', 'design.md'), 'utf8');
  assertSentence(design, RULES.D1, 'docs/design.md');
});

test('row 10: harness Sandbox & execution states H1, and the file stays within its cap', () => {
  const harness = fs.readFileSync(path.join(PKG_ROOT, 'sdlc', 'harness.md'), 'utf8');
  const sandbox = nonEmpty(section(harness, 'Sandbox & execution'), 'sdlc/harness.md ## Sandbox & execution');
  assertSentence(sandbox, RULES.H1, 'sdlc/harness.md ## Sandbox & execution');
  assert.ok(countEffectiveLines(harness) <= CAPS.harness,
    `sdlc/harness.md is ${countEffectiveLines(harness)} effective lines, cap ${CAPS.harness}`);
  // The seed every new project gets carries the same note on its test command.
  const seed = nonEmpty(section(payload('templates', 'harness.md'), 'Sandbox & execution'), 'templates/harness.md ## Sandbox & execution');
  assertSentence(seed, RULES.H1, 'templates/harness.md ## Sandbox & execution');
});

test('row 11: assertRule bounds a clause at its start', () => {
  const clause = 'a clause holds';
  for (const bad of ['not a clause holds here', 'xa clause holds']) {
    assert.throws(() => assertRule(bad, clause, 'helper probe'), `anchor "${bad}" must fail the clause pin`);
  }
  for (const good of ['a clause holds', '- a clause holds', 'one. a clause holds', 'one; a clause holds', 'two: a clause holds']) {
    assert.doesNotThrow(() => assertRule(good, clause, 'helper probe'), `anchor "${good}" must pass the clause pin`);
  }
});

// Every file a removed guard row used to run (gate-rules-second-pass 18, gate-moving-target 3
// and 12, anti-loop-rules 10). They now run only through the suite's own discovery.
const FORMERLY_GUARDED = [
  'verify-gates', 'review-blocker-class', 'minimal-build', 'payload', 'playbook-budgets', 'anti-loop-rules',
  'gate-moving-target', 'final-gate-confirm', 'lenses', 'deploy-runbook', 'contractor-assertion-rules', 'caps-sync',
];

test('row 12: no doctrine test spawns another test file, helpers are shared, and the guarded files still exist', () => {
  // A test file runs another one by spawning node itself; built in parts so this file never matches.
  const SPAWN = /spawnSync\(process\.execPath/;
  const read = (name) => fs.readFileSync(path.join(PKG_ROOT, 'tests', `${name}.test.mjs`), 'utf8');
  for (const name of ['gate-rules-second-pass', 'gate-moving-target', 'anti-loop-rules', 'digest-followups']) {
    assert.ok(!SPAWN.test(read(name)), `tests/${name}.test.mjs still spawns another test file`);
  }
  for (const name of ['gate-moving-target', 'anti-loop-rules']) {
    const text = read(name);
    assert.match(text, /from '\.\/rule-pins\.mjs'/, `tests/${name}.test.mjs imports the shared helpers`);
    for (const fn of ['section', 'step', 'nonEmpty', 'body']) {
      assert.ok(!text.includes(`function ${fn}(`), `tests/${name}.test.mjs declares its own ${fn}()`);
    }
  }
  for (const name of FORMERLY_GUARDED) {
    assert.ok(fs.existsSync(path.join(PKG_ROOT, 'tests', `${name}.test.mjs`)), `tests/${name}.test.mjs is gone`);
  }
});

// The `## ` section holding the CHANGELOG entry that contains the marker, found by entry, not heading.
function changelogEntry(text, marker) {
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((l) => l.includes(marker));
  assert.ok(at !== -1, `CHANGELOG.md has no entry containing ${marker}`);
  let start = at;
  while (start > 0 && !lines[start].startsWith('## ')) start -= 1;
  let end = at + 1;
  while (end < lines.length && !lines[end].startsWith('## ')) end += 1;
  return lines.slice(start, end).join('\n');
}

test('row 13: the CHANGELOG entry names human-closed, rerun=yes, base=<tree> and closed=human:', () => {
  const changelog = fs.readFileSync(path.join(PKG_ROOT, 'CHANGELOG.md'), 'utf8');
  const entry = changelogEntry(changelog, '**Close the gate-rules-second-pass digest**');
  for (const token of ['human-closed', 'rerun=yes', 'base=<tree>', 'closed=human:']) {
    assert.ok(entry.includes(token), `CHANGELOG entry must contain "${token}"`);
  }
});

// A tiny project for the mutation helper: one test that passes while data.txt says "ok".
function mutationFixture(t, data) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-mutation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'tests'));
  fs.writeFileSync(path.join(root, 'data.txt'), data);
  fs.writeFileSync(path.join(root, 'tests', 'data.test.mjs'), [
    "import { test } from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import fs from 'node:fs';",
    "test('row 1: data says ok', () => {",
    "  assert.equal(fs.readFileSync(new URL('../data.txt', import.meta.url), 'utf8').trim(), 'ok');",
    '});',
    '',
  ].join('\n'));
  return root;
}

test('row 14: the mutation helper reports no count on a red baseline, mutates only a copy, and counts N of M', (t) => {
  const red = mutationFixture(t, 'bad\n');
  const voided = runMutants({ root: red, targets: ['tests/data.test.mjs'], mutants: [] });
  assert.equal(voided.baseline, 'red');
  assert.equal(voided.count, null, 'a red baseline voids the count');

  const green = mutationFixture(t, 'ok\n');
  const res = runMutants({
    root: green,
    targets: ['tests/data.test.mjs'],
    mutants: [
      { label: 'data inverted', file: 'data.txt', find: 'ok', replace: 'no', target: 'tests/data.test.mjs' },
      { label: 'harmless', file: 'data.txt', find: 'ok', replace: 'ok', target: 'tests/data.test.mjs' },
    ],
  });
  assert.equal(res.baseline, 'green');
  assert.equal(res.count, '1 of 2');
  assert.deepEqual(res.results.map((r) => [r.label, r.killed]), [['data inverted', true], ['harmless', false]]);
  assert.deepEqual(res.results[0].rows, ['tests/data.test.mjs row 1'], 'a killed row is named with its file');
  assert.equal(fs.readFileSync(path.join(green, 'data.txt'), 'utf8'), 'ok\n', 'the working tree is never mutated');
});

test('row 15: the observe playbook renders human-closed×N and corrected×N', () => {
  const observe = oneLine(nonEmpty(payload('playbook', 'observe.md'), 'playbook/observe.md'));
  for (const token of ['human-closed×N', 'corrected×N']) {
    assert.ok(observe.includes(token), `playbook/observe.md must render ${token}`);
  }
});

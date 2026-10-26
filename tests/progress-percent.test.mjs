// Contract rows 1-12 of sdlc/changes/progress-percent/contract/tests.md: one progress figure per
// change in `status` and `status --json`, and the sentence every progress update follows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeTempProject, runCli, writeChange, PKG_ROOT } from './helpers.mjs';
import { payload, assertSentence } from './rule-pins.mjs';

const PROG = "Every progress update — a stage change, a wave started or finished, a task ticked — states the change's figure from `npx @warnyin/sdlc status`: `tasks <done>/<total> · <p>%`.";

const loadProgress = async () =>
  (await import(pathToFileURL(path.join(PKG_ROOT, 'lib', 'progress.mjs')).href)).progressOf;

const doc = (status, tasks) => `---\nid: x\ntier: standard\nstatus: ${status}\n---\n# Change: x\n\n## Why\nw\n${tasks === null ? '' : `\n## Tasks\n${tasks}\n`}`;
const tasksOf = (done, total) => Array.from({ length: total }, (_, i) => `- [${i < done ? 'x' : ' '}] T${i + 1}`).join('\n');

test('row 1: the percent follows the status, and while building the rounded ticked share', async () => {
  const progressOf = await loadProgress();
  for (const [status, percent] of [['new', 10], ['contracted', 25], ['verified', 90], ['shipped', 100]]) {
    assert.deepEqual(progressOf(doc(status, tasksOf(1, 3))), { done: 1, total: 3, percent }, `${status} with tasks`);
    assert.deepEqual(progressOf(doc(status, null)), { done: 0, total: 0, percent }, `${status} without tasks`);
  }
  const wrong = [];
  for (let total = 1; total <= 12; total++) {
    for (let done = 0; done <= total; done++) {
      const got = progressOf(doc('building', tasksOf(done, total))).percent;
      if (got !== Math.round(25 + (50 * done) / total)) wrong.push(`${done}/${total} → ${got}`);
    }
  }
  assert.deepEqual(wrong, [], 'building is Math.round(25 + 50·done/total) for every share');
  for (const [done, total, percent] of [[1, 4, 38], [2, 3, 58], [1, 8, 31]]) {
    assert.equal(progressOf(doc('building', tasksOf(done, total))).percent, percent, `${done}/${total}`);
  }
  assert.deepEqual(progressOf(doc('building', null)), { done: 0, total: 0, percent: 25 }, 'building with no tasks');
});

const MIXED = [
  '---', 'id: x', 'tier: standard', 'status: building', '---', '# Change: x', '',
  '## Assumptions', '- [x] a', '',
  '## Tasks', '- [x] T1', '- [X] T2', '* [x] T3', '  - [ ] sub', '```', '- [x] fake', '```', '',
  '## Tasks (fix 1)', '- [ ] F1', '',
  '## Notes', '- [ ] later', '',
  '### Tasks', '- [x] h3', '',
];

test('row 2: only unfenced checkboxes under ## Tasks headings count, summed', async () => {
  const progressOf = await loadProgress();
  assert.deepEqual(progressOf(MIXED.join('\n')), { done: 3, total: 5, percent: 55 });
});

test('row 3: CRLF reads the same', async () => {
  const progressOf = await loadProgress();
  assert.deepEqual(progressOf(MIXED.join('\r\n')), { done: 3, total: 5, percent: 55 });
});

test('row 4: no figure for an unknown status or a change.md without frontmatter', async () => {
  const progressOf = await loadProgress();
  assert.deepEqual(progressOf(doc('bogus', tasksOf(1, 2))), { done: 1, total: 2, percent: null });
  assert.deepEqual(progressOf(`# Change: x\n\n## Tasks\n${tasksOf(1, 2)}\n`), { done: 1, total: 2, percent: null });
});

function projectWith(t, changes) {
  const root = makeTempProject(t);
  assert.equal(runCli(root, ['init', '--tool', 'claude']).status, 0);
  for (const [id, status, tasks] of changes) {
    writeChange(root, id, { status, body: `# Change: Title ${id}\n\n## Why\nw\n${tasks === null ? '' : `\n## Tasks\n${tasks}\n`}` });
  }
  return root;
}
const lineFor = (stdout, id) => stdout.split(/\r?\n/).find((l) => l.startsWith(`${id}  `));
const jsonFor = (root, id) => JSON.parse(runCli(root, ['status', '--json']).stdout).changes.find((x) => x.id === id);

test('row 5: the status line carries the figure right after the title', (t) => {
  const root = projectWith(t, [['half', 'building', tasksOf(2, 4)]]);
  const res = runCli(root, ['status']);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(lineFor(res.stdout, 'half'), 'half  [standard/building]  Title half · tasks 2/4 · 50%');
});

test('row 6: status --json adds progress after the existing keys', (t) => {
  const c = jsonFor(projectWith(t, [['half', 'building', tasksOf(2, 4)]]), 'half');
  assert.deepEqual(c.progress, { done: 2, total: 4, percent: 50 });
  assert.deepEqual(Object.keys(c).slice(0, 8), ['id', 'tier', 'status', 'title', 'blockedBy', 'spawnedFrom', 'parked', 'waitedOnBy']);
  assert.equal(Object.keys(c).indexOf('progress'), 8);
});

test('row 7: a change with no tasks shows the percent alone', (t) => {
  const root = projectWith(t, [['fresh', 'new', null]]);
  assert.ok(lineFor(runCli(root, ['status']).stdout, 'fresh')?.endsWith('Title fresh · 10%'));
  assert.deepEqual(jsonFor(root, 'fresh').progress, { done: 0, total: 0, percent: 10 });
});

test('row 8: a missing change.md or an unknown status carries no figure', (t) => {
  const root = projectWith(t, [['odd', 'bogus', tasksOf(1, 2)]]);
  fs.mkdirSync(path.join(root, 'sdlc', 'changes', 'empty'));
  const out = runCli(root, ['status']).stdout;
  assert.ok(lineFor(out, 'odd')?.endsWith('Title odd'), lineFor(out, 'odd'));
  assert.ok(lineFor(out, 'empty')?.endsWith('(missing change.md)'), lineFor(out, 'empty'));
  assert.equal(jsonFor(root, 'odd').progress.percent, null);
  assert.equal(jsonFor(root, 'empty').progress.percent, null);
});

for (const [row, file] of [[9, 'auto.md'], [10, 'build.md'], [11, 'next.md']]) {
  test(`row ${row}: ${file} states the progress-update sentence`, () => {
    assertSentence(payload('playbook', file), PROG, `payload/playbook/${file}`);
  });
}

test('row 12: lib/progress.mjs reaches only node: modules and ./ siblings, statically or dynamically', () => {
  const p = path.join(PKG_ROOT, 'lib', 'progress.mjs');
  assert.ok(fs.existsSync(p), 'lib/progress.mjs exists');
  const src = fs.readFileSync(p, 'utf8');
  const specs = [...src.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g)].map((m) => m[1]);
  assert.ok(specs.length > 0, 'the scan found the module imports');
  for (const s of specs) assert.ok(s.startsWith('node:') || s.startsWith('./'), `reaches "${s}"`);
});

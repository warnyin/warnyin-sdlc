// Contract rows 1–5 of fence-close-marker: a code fence closes only on a line of its own
// character, at least as long, with nothing else on it — for runbook.md and grill.md alike.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, writeChange, writeContractTests, STANDARD_BODY } from './helpers.mjs';
import { validateChange } from '../lib/validate.mjs';

const BT = '```';
const TL = '~~~';
const SECTIONS = ['Pre-checks', 'Config & Secrets', 'Steps', 'Migration order', 'Verify', 'Rollback'];
const section = (name) => `## ${name}\n- done for ${name}\n`;

function deployChange(root, id, runbook) {
  const dir = path.join(root, 'sdlc', 'changes', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'change.md'),
    `---\nid: ${id}\ntier: standard\nstatus: contracted\nlenses: [deploy@builtin]\n---\n${STANDARD_BODY}`);
  writeContractTests(dir);
  fs.writeFileSync(path.join(dir, 'runbook.md'), runbook);
  return dir;
}

const five = SECTIONS.filter((s) => s !== 'Rollback').map(section).join('\n');
const runbookErrors = (dir) => validateChange(dir).filter((i) => i.level === 'error' && /runbook/i.test(i.msg));
const namesRollback = (dir) => runbookErrors(dir).some((i) => i.msg.includes('Rollback'));

test('row 1: a ~~~ line inside a ``` fence does not close it (runbook)', (t) => {
  const root = makeTempProject(t);
  const dir = deployChange(root, 'mixed', `${five}\n${BT}\n${TL}\n## Rollback\n- quoted\n${BT}\n`);
  assert.ok(namesRollback(dir), `Rollback inside the fence must not count, got ${JSON.stringify(runbookErrors(dir))}`);
});

test('row 2: a ~~~ line inside a ``` fence does not close it (grill.md)', (t) => {
  const root = makeTempProject(t);
  assert.equal(runCli(root, ['init', '--tool', 'claude']).status, 0);
  const id = 'grill-mixed';
  const dir = writeChange(root, id, { status: 'verified', body: STANDARD_BODY });
  writeContractTests(dir);
  fs.writeFileSync(path.join(dir, 'grill.md'), [
    '# Grill', '', '## Delegation', '- Delegated by: x · 2026-10-08', '', '## Priorities', '1. requirement', '',
    BT, TL, '## Mandate', '- May decide alone: clarification', BT, '', '## Decisions', '',
  ].join('\n'));
  const res = runCli(root, ['validate', id]);
  assert.equal(res.status, 1, res.stdout + res.stderr);
  assert.match(res.stdout + res.stderr, /missing required section "## Mandate"/);
});

test('row 3: a shorter run of the same marker does not close a longer opener', (t) => {
  const root = makeTempProject(t);
  const dir = deployChange(root, 'longer', `${five}\n${BT}\`\n${BT}\n## Rollback\n- quoted\n${BT}\`\n`);
  assert.ok(namesRollback(dir), `Rollback inside the four-backtick fence must not count, got ${JSON.stringify(runbookErrors(dir))}`);
});

test('row 4: an opener with an info string closes on a bare marker', (t) => {
  const root = makeTempProject(t);
  const all = SECTIONS.map(section).join('\n');
  const dir = deployChange(root, 'info', `${BT}md\n- example\n${BT}\n\n${all}`);
  assert.deepEqual(runbookErrors(dir), []);
});

test('row 5: a marker line with trailing text does not close the fence', (t) => {
  const root = makeTempProject(t);
  const dir = deployChange(root, 'trailing', `${five}\n${BT}\n${BT} text\n## Rollback\n- quoted\n`);
  assert.ok(namesRollback(dir), `Rollback after a non-closing marker must not count, got ${JSON.stringify(runbookErrors(dir))}`);
});

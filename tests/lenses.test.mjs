// Contract rows 12–20 of dynamic-expert-lenses: the `lenses` frontmatter a change records,
// the catalog that defines each lens, and the playbooks that choose and consume them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeTempProject, runCli, PKG_ROOT } from './helpers.mjs';
import { CAPS, countEffectiveLines } from '../lib/caps.mjs';
import { validateChange } from '../lib/validate.mjs';

const BODY = `# Change: lenses

## Why
Exercise lens validation.

## Delta: demo

### ADDED Requirement: Demo
The system SHALL demo.

#### Scenario: demo
- WHEN demo
- THEN demo
`;

function writeLensChange(root, id, lensesFrontmatter) {
  const dir = path.join(root, 'sdlc', 'changes', id);
  fs.mkdirSync(dir, { recursive: true });
  const fm = lensesFrontmatter === null ? '' : `${lensesFrontmatter}\n`;
  fs.writeFileSync(path.join(dir, 'change.md'), `---\nid: ${id}\ntier: standard\nstatus: new\n${fm}---\n${BODY}`);
  return dir;
}

const lensIssues = (dir) => validateChange(dir).filter((i) => /lens/i.test(i.msg));
const readPayload = (rel) => fs.readFileSync(path.join(PKG_ROOT, 'payload', rel), 'utf8');
const loadLenses = async () => (await import(pathToFileURL(path.join(PKG_ROOT, 'lib', 'lenses.mjs')).href)).LENSES;

test('row 12: well-formed lenses (inline array and - item list) pass validation', async (t) => {
  // Red until the catalog exists: accepting lenses without knowing the catalog proves nothing.
  const LENSES = await loadLenses();
  assert.deepEqual([...LENSES].sort(), ['api', 'data', 'ux-ui']);

  const root = makeTempProject(t);
  const inline = writeLensChange(root, 'inline',
    'lenses: [ux-ui@builtin, api@project:frontend-patterns, data@user:db-skill]');
  const list = writeLensChange(root, 'listed',
    'lenses:\n  - ux-ui@builtin\n  - api@project:frontend-patterns\n  - data@user:db-skill');
  assert.deepEqual(lensIssues(inline), []);
  assert.deepEqual(lensIssues(list), []);

  const res = runCli(root, ['validate', 'inline']);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.doesNotMatch(res.stdout + res.stderr, /lens/i);
});

test('row 13: an unknown lens, a malformed source or a repeated lens is an error naming the entry', (t) => {
  const root = makeTempProject(t);
  const bad = [
    ['unknown', '[vibes@builtin]', 'vibes@builtin'],
    ['nosource', '[ux-ui]', 'ux-ui'],
    ['badsource', '[ux-ui@github:x]', 'ux-ui@github:x'],
    ['emptyname', '[ux-ui@project:]', 'ux-ui@project:'],
    ['traversal', '[ux-ui@user:../x]', 'ux-ui@user:../x'],
    ['uppercase', '[UX-UI@builtin]', 'UX-UI@builtin'],
    ['twice', '[ux-ui@builtin, ux-ui@user:x]', 'ux-ui'],
    ['dotdot', '[ux-ui@user:..]', 'ux-ui@user:..'],
    ['scalar', 'ux-ui@builtin', 'ux-ui@builtin'],
  ];
  for (const [id, value, named] of bad) {
    const dir = writeLensChange(root, id, `lenses: ${value}`);
    const errors = lensIssues(dir).filter((i) => i.level === 'error');
    assert.ok(errors.length > 0, `${value} must be rejected`);
    assert.ok(errors.some((i) => i.msg.includes(named)), `${value}: error must name "${named}", got ${JSON.stringify(errors)}`);
  }
  const res = runCli(root, ['validate', 'unknown']);
  assert.equal(res.status, 1, res.stdout + res.stderr);
  assert.match(res.stdout + res.stderr, /vibes@builtin/);
});

test('row 14: no lenses key and an empty list raise no lens issue', (t) => {
  const root = makeTempProject(t);
  assert.deepEqual(lensIssues(writeLensChange(root, 'absent', null)), []);
  assert.deepEqual(lensIssues(writeLensChange(root, 'empty', 'lenses: []')), []);
});

test('row 15: catalog headings equal LENSES exactly, and each lens has all four parts', async () => {
  const LENSES = await loadLenses();
  assert.ok(Object.isFrozen(LENSES), 'LENSES is the canonical, frozen list');
  const catalog = readPayload('playbook/lenses.md');
  const sections = catalog.split(/^## Lens: /m).slice(1);
  const names = sections.map((s) => s.split(/\r?\n/)[0].trim());
  assert.deepEqual(names, [...LENSES]);
  for (const s of sections) {
    for (const part of ['signals', 'ground', 'contributes', 'stages']) {
      assert.match(s, new RegExp(`^- ${part}:\\s*\\S`, 'm'), `lens "${s.split('\n')[0]}" lacks "- ${part}:"`);
    }
  }
  const quoted = catalog.match(/cap:(\d+)/);
  assert.ok(quoted, 'lenses.md must quote its cap');
  assert.equal(Number(quoted[1]), CAPS.lensCatalog);
  assert.ok(countEffectiveLines(catalog) <= CAPS.lensCatalog, `lenses.md is ${countEffectiveLines(catalog)} lines`);
  const using = catalog.split(/^## Using a recorded lens/m)[1]?.split(/^## /m)[0] ?? '';
  assert.match(using, /missing skill/i, 'the missing-skill fallback lives in the catalog once');
  assert.match(using, /built-in/i);
});

test('row 16: init installs the catalog and both lib modules', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res.status, 0, res.stderr);
  for (const rel of ['sdlc/.playbook/lenses.md', 'sdlc/.hooks/lib/lenses.mjs', 'sdlc/.hooks/lib/skills.mjs']) {
    assert.ok(fs.existsSync(path.join(dir, rel)), `${rel} must be installed`);
  }
});

test('row 17: the opening playbook selects lenses from evidence', () => {
  const text = readPayload('playbook/new.md');
  assert.match(text, /skills --json/);
  assert.match(text, /lenses\.md/);
  assert.match(text, /project\s*(→|->)\s*user\s*(→|->)\s*builtin/i);
  assert.match(text, /`lenses:/);
  assert.match(text, /skill[^\n]*\bas data\b|\bdata\b[^\n]*skill/i);
  assert.match(text, /no signal/i);
});

test('row 18: design, contract, review and verify consume the recorded lenses', () => {
  for (const f of ['design.md', 'contract.md', 'review.md', 'verify.md']) {
    assert.match(readPayload(`playbook/${f}`), /\blenses\b/, `${f} must name lenses`);
  }
  assert.match(readPayload('playbook/design.md'), /lens[^\n]*stages[^\n]*design/i);
  const contract = readPayload('playbook/contract.md');
  assert.match(contract, /lens[^\n]*\bbars?\b/i);
  assert.match(contract, /lenses[^]*evals\.md/i, 'lenses make evals.md required');
  const review = readPayload('playbook/review.md');
  for (const core of ['sdlc-architect', 'sdlc-security', 'sdlc-quality', 'sdlc-ops']) {
    assert.match(review, new RegExp(core), `review must keep ${core}`);
  }
  assert.match(review, /one (reviewer|pass) per (recorded )?lens/i);
  assert.match(review, /mode=panel[^]{0,80}every reviewer[^]{0,40}each lens/i, 'lens reviewers count toward mode=panel');
  const verify = readPayload('playbook/verify.md');
  assert.match(verify, /lens[^\n]*\bbars?\b/i);
  assert.match(verify, /tests\.md[^]{0,20}row[^]{0,40}evals\.md/i, 'lens bars may live in either contract file');
  assert.match(verify.split(/^Next:/m)[1] ?? '', /lenses/, 'a change with lenses is routed to review');
  const opening = readPayload('playbook/new.md');
  assert.ok(opening.indexOf('Delta requirements') < opening.indexOf('lenses.md'), 'lenses are chosen after the Delta is written');
});

test('row 19: a missing skill is suggested, never installed; the harness template escalates installing one', () => {
  for (const f of ['new.md', 'design.md']) {
    const text = readPayload(`playbook/${f}`);
    assert.match(text, /suggest/i, `${f} must say suggest`);
    assert.match(text, /never (fetch|install)/i, `${f} must say never install`);
  }
  const harness = readPayload('templates/harness.md');
  const policy = harness.split(/^## Autonomy policy/m)[1] ?? '';
  assert.match(policy, /install(ing)? (a |new )?(skill|agent)/i);
});

test('row 20: new lib modules import only node:* or sibling lib modules', () => {
  for (const mod of ['lenses.mjs', 'skills.mjs']) {
    const text = fs.readFileSync(path.join(PKG_ROOT, 'lib', mod), 'utf8');
    for (const m of text.matchAll(/^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gm)) {
      assert.ok(m[1].startsWith('node:') || /^\.\/[\w.-]+\.mjs$/.test(m[1]), `lib/${mod} imports "${m[1]}"`);
      if (mod === 'lenses.mjs') assert.fail(`lib/lenses.mjs must import nothing, found "${m[1]}"`);
    }
  }
});

// Contract rows 1–19 of sdlc/changes/deploy-runbook/contract/tests.md: the `deploy` lens, the
// runbook a deploy change carries (required, six sections, cap), the stage playbooks that write,
// review, link and skip it, and archive. Every row is one test named `row N: ...`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeTempProject, runCli, writeContractTests, PKG_ROOT } from './helpers.mjs';
import { CAPS, countEffectiveLines } from '../lib/caps.mjs';
import { validateChange } from '../lib/validate.mjs';

const BODY = `# Change: deploy runbook

## Why
Exercise deploy-lens validation.

## Delta: demo

### ADDED Requirement: Demo
The system SHALL demo.

#### Scenario: demo
- WHEN demo
- THEN demo
`;

const FENCE = '```';
const TILDE = '~~~';

// Six sections, in contract order. Bodies are plain bullets so a missing section is the only defect.
const SECTIONS = [
  ['Pre-checks', '- migration dry-run passed on uat'],
  ['Config & Secrets', '- DATABASE_URL: secret, named here, value kept in the vault'],
  ['Steps', '- dev, uat, prod: deploy build 2.4.0 in that order'],
  ['Migration order', '- run migration 0042 before the new app starts'],
  ['Verify', '- GET /health returns 200 in every environment'],
  ['Rollback', '- redeploy build 2.3.1; migration 0042 is backward compatible'],
];

const h2 = (name) => `## ${name}`;

function renderRunbook(sections = SECTIONS, heading = h2) {
  return ['# Runbook', '', ...sections.flatMap(([name, body]) => [heading(name), body, ''])].join('\n');
}

function writeDeployChange(root, id, { status = 'contracted', lenses = '[deploy@builtin]', runbook, tests = true } = {}) {
  const dir = path.join(root, 'sdlc', 'changes', id);
  fs.mkdirSync(dir, { recursive: true });
  const fm = lenses === null ? '' : `lenses: ${lenses}\n`;
  fs.writeFileSync(path.join(dir, 'change.md'),
    `---\nid: ${id}\ntier: standard\nstatus: ${status}\n${fm}---\n${BODY}`);
  if (tests) writeContractTests(dir);
  if (runbook !== undefined) fs.writeFileSync(path.join(dir, 'runbook.md'), runbook);
  return dir;
}

const lensIssues = (dir) => validateChange(dir).filter((i) => /lens/i.test(i.msg));
const runbookIssues = (dir) => validateChange(dir).filter((i) => /runbook/i.test(i.msg));
const runbookErrors = (dir) => runbookIssues(dir).filter((i) => i.level === 'error');
const readPayload = (rel) => fs.readFileSync(path.join(PKG_ROOT, 'payload', rel), 'utf8');
const loadLenses = async () => (await import(pathToFileURL(path.join(PKG_ROOT, 'lib', 'lenses.mjs')).href)).LENSES;

// True when a level-2 heading outside fences names the section: case-folded text equals the name,
// or is followed by a space or "(". `## Verification` does not count as Verify.
function hasSection(text, name) {
  let fenced = false;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trimStart();
    if (t.startsWith(FENCE) || t.startsWith(TILDE)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const m = line.match(/^## (.*)$/);
    if (!m) continue;
    const head = m[1].trim().toLowerCase();
    const want = name.toLowerCase();
    if (head === want || head.startsWith(`${want} `) || head.startsWith(`${want}(`)) return true;
  }
  return false;
}

// Replaces every `<…>` outside HTML comments with plain text — a template an author filled in.
function fillPlaceholders(text) {
  return text.split(/(<!--[^]*?-->)/).map((part, i) => (i % 2 ? part : part.replace(/<[^<>\n]+>/g, 'filled'))).join('');
}

// The `## Lens: <name>` block of lenses.md, bounded by the next level-2 heading.
function lensSection(text, name) {
  const lines = text.split(/\r?\n/);
  const start = lines.indexOf(`## Lens: ${name}`);
  if (start === -1) return null;
  const next = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines.slice(start, next === -1 ? undefined : next).join('\n');
}

// One `- key:` bullet of a lens block, bounded by the next `- word:` bullet.
function bulletBlock(section, key) {
  const lines = section.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`- ${key}:`));
  if (start === -1) return null;
  const next = lines.findIndex((l, i) => i > start && /^- [a-z]+:/.test(l));
  return lines.slice(start, next === -1 ? undefined : next).join('\n');
}

// A numbered step of a playbook, bounded by the next numbered step.
function stepBlock(text, startRe) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => startRe.test(l));
  if (start === -1) return null;
  const next = lines.findIndex((l, i) => i > start && /^\d+[a-z]?\. /.test(l));
  return lines.slice(start, next === -1 ? undefined : next).join('\n');
}

test('row 1: LENSES lists deploy, and a deploy@builtin change raises no lens issue', async (t) => {
  const LENSES = await loadLenses();
  assert.deepEqual([...LENSES].sort(), ['api', 'data', 'deploy', 'ux-ui']);
  const root = makeTempProject(t);
  const dir = writeDeployChange(root, 'deploy-new', { status: 'new', tests: false });
  assert.deepEqual(lensIssues(dir), []);
});

test('row 2: the catalog has a deploy lens with its four parts, runbook.md contribution and cap 70', () => {
  const catalog = readPayload('playbook/lenses.md');
  const section = lensSection(catalog, 'deploy');
  assert.ok(section, 'lenses.md must contain "## Lens: deploy"');
  for (const part of ['signals', 'ground', 'contributes', 'stages']) {
    assert.ok(bulletBlock(section, part), `the deploy lens lacks "- ${part}:"`);
  }
  const signals = bulletBlock(section, 'signals');
  assert.match(signals, /migration/i);
  assert.match(signals, /environment/i);
  assert.match(signals, /secret|flag/i);
  assert.match(bulletBlock(section, 'contributes'), /runbook\.md/);
  assert.match(bulletBlock(section, 'contributes'), /contract —/, 'deploy must give contract bars, which verify requires of every lens');
  assert.match(bulletBlock(section, 'stages'), /\bcontract\b/);
  assert.equal(CAPS.lensCatalog, 70);
  const quoted = catalog.match(/cap:(\d+)/);
  assert.ok(quoted, 'lenses.md must quote its cap');
  assert.equal(Number(quoted[1]), CAPS.lensCatalog);
  assert.ok(countEffectiveLines(catalog) <= CAPS.lensCatalog, `lenses.md is ${countEffectiveLines(catalog)} lines`);
});

test('row 3: a deploy change without runbook.md fails validate at contracted, building and verified', (t) => {
  const root = makeTempProject(t);
  const lensForms = ['deploy@builtin', 'deploy@project:x', 'deploy@user:x'];
  let k = 0;
  for (const status of ['contracted', 'building', 'verified']) {
    for (const lens of lensForms) {
      const id = `r3-${k++}`;
      writeDeployChange(root, id, { status, lenses: `[${lens}]` });
      const res = runCli(root, ['validate', id]);
      assert.equal(res.status, 1, `${status} ${lens}: ${res.stdout}${res.stderr}`);
      assert.match(res.stdout + res.stderr, /runbook\.md/, `${status} ${lens} must name runbook.md`);
    }
  }
});

test('row 4: a deploy change at status new with no runbook.md raises no runbook issue', (t) => {
  const root = makeTempProject(t);
  // Control: the same change at contracted must get a runbook error, so the no-issue result below is real.
  const contracted = writeDeployChange(root, 'contracted-none', { status: 'contracted' });
  assert.ok(runbookErrors(contracted).length > 0, 'a contracted deploy change without runbook.md must get a runbook error');
  const dir = writeDeployChange(root, 'new-none', { status: 'new', tests: false });
  assert.deepEqual(runbookIssues(dir), []);
});

test('row 5: a contracted deploy change with six sections has no runbook issue; each removed section is named', (t) => {
  const root = makeTempProject(t);
  for (const [name] of SECTIONS) {
    const id = `no-${name.replace(/\W+/g, '-').toLowerCase()}`;
    const dir = writeDeployChange(root, id, { runbook: renderRunbook(SECTIONS.filter((s) => s[0] !== name)) });
    const errs = runbookErrors(dir);
    assert.ok(errs.some((i) => i.msg.includes(name)),
      `without "${name}" the runbook must give an error naming it, got ${JSON.stringify(errs)}`);
  }
  const full = writeDeployChange(root, 'full', { runbook: renderRunbook() });
  assert.deepEqual(runbookIssues(full), []);
});

test('row 6: a Rollback or Verify heading that does not count is reported by name', (t) => {
  const root = makeTempProject(t);
  const without = (name) => SECTIONS.filter((s) => s[0] !== name);
  const cases = [
    ['fence', renderRunbook(without('Rollback')) + `${FENCE}\n## Rollback\n- redeploy\n${FENCE}\n`, 'Rollback'],
    ['tilde', renderRunbook(without('Rollback')) + `${TILDE}\n## Rollback\n- redeploy\n${TILDE}\n`, 'Rollback'],
    ['level3', renderRunbook(without('Rollback')) + '### Rollback\n- redeploy\n', 'Rollback'],
    ['verification', renderRunbook(SECTIONS, (n) => (n === 'Verify' ? '## Verification' : h2(n))), 'Verify'],
  ];
  for (const [id, text, name] of cases) {
    const dir = writeDeployChange(root, `h-${id}`, { runbook: text });
    const errs = runbookErrors(dir);
    assert.ok(errs.some((i) => i.msg.includes(name)),
      `${id}: runbook must give an error naming ${name}, got ${JSON.stringify(errs)}`);
  }
});

test('row 7: case-folded and suffixed headings count as their sections', (t) => {
  const root = makeTempProject(t);
  const variant = { 'Pre-checks': '## pre-checks', 'Config & Secrets': '## CONFIG & SECRETS',
    'Steps': '## Steps (dev → uat → prod)', 'Migration order': '## migration order',
    'Verify': '## verify (smoke)', 'Rollback': '## ROLLBACK' };
  const heading = (n) => variant[n];
  // Control: the variant headings with Rollback dropped must still name Rollback.
  const control = writeDeployChange(root, 'variant-control',
    { runbook: renderRunbook(SECTIONS.filter((s) => s[0] !== 'Rollback'), heading) });
  assert.ok(runbookErrors(control).some((i) => i.msg.includes('Rollback')),
    'the variant runbook without Rollback must give an error naming Rollback');
  const dir = writeDeployChange(root, 'variant', { runbook: renderRunbook(SECTIONS, heading) });
  assert.deepEqual(runbookErrors(dir), []);
});

test('row 8: CAPS.runbook is 60; 60 effective lines pass and 61 is an error naming 61 and 60', (t) => {
  assert.equal(CAPS.runbook, 60);
  const root = makeTempProject(t);
  const build = (target) => {
    const base = renderRunbook();
    const pad = Array.from({ length: target - countEffectiveLines(base) }, (_, i) => `- pad ${i + 1}`);
    // Frontmatter, a single-line comment and blank lines are not effective lines.
    return `---\nid: x\n---\n<!-- cap:60 -->\n\n${base}${pad.join('\n')}\n`;
  };
  const at60 = build(60);
  assert.equal(countEffectiveLines(at60), 60, 'precondition: fixture is exactly 60 effective lines');
  assert.deepEqual(runbookErrors(writeDeployChange(root, 'at-60', { runbook: at60 })), []);
  const at61 = build(61);
  assert.equal(countEffectiveLines(at61), 61, 'precondition: fixture is exactly 61 effective lines');
  const errs = runbookErrors(writeDeployChange(root, 'at-61', { runbook: at61 }));
  assert.ok(errs.some((i) => i.msg.includes('61') && i.msg.includes('60')),
    `61 lines must give a runbook error with 61 and 60, got ${JSON.stringify(errs)}`);
});

test('row 9: a change without the deploy lens (api, or no lenses) needs no runbook', (t) => {
  const root = makeTempProject(t);
  // Control: a contracted deploy change without a runbook does get a runbook error.
  const deploy = writeDeployChange(root, 'deploy-control', { status: 'contracted' });
  assert.ok(runbookErrors(deploy).length > 0, 'a contracted deploy change without runbook.md must get a runbook error');
  const api = writeDeployChange(root, 'api-only', { status: 'contracted', lenses: '[api@builtin]' });
  assert.deepEqual(runbookIssues(api), []);
  const none = writeDeployChange(root, 'no-lenses', { status: 'contracted', lenses: null });
  assert.deepEqual(runbookIssues(none), []);
  const stray = writeDeployChange(root, 'api-stray', { status: 'contracted', lenses: '[api@builtin]',
    runbook: renderRunbook(SECTIONS.filter((x) => x[0] === 'Steps')) });
  assert.deepEqual(runbookIssues(stray), [], 'without the deploy lens a runbook is not checked');
});

test('row 10: the runbook template quotes CAPS.runbook, has six sections, and a copy validates clean', (t) => {
  const text = readPayload('templates/runbook.md');
  const quoted = text.match(/cap:(\d+)/);
  assert.ok(quoted, 'runbook template must quote cap:<n>');
  assert.equal(Number(quoted[1]), CAPS.runbook);
  for (const [name] of SECTIONS) {
    assert.ok(hasSection(text, name), `runbook template lacks a "## ${name}" section`);
  }
  assert.match(text, /\bnamed\b/);
  assert.match(text, /never their values/i);
  assert.match(text, /expand\/contract/i);
  assert.match(text, /IRREVERSIBLE/);
  const root = makeTempProject(t);
  const unedited = writeDeployChange(root, 'from-template', { runbook: text });
  assert.ok(runbookErrors(unedited).some((i) => /placeholder/i.test(i.msg)),
    `an unedited template copy must give a placeholder error, got ${JSON.stringify(runbookErrors(unedited))}`);
  const filled = writeDeployChange(root, 'filled-template', { runbook: fillPlaceholders(text) });
  assert.deepEqual(runbookErrors(filled), []);
});

test('row 11: init installs the runbook template into the playbook templates', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'sdlc/.playbook/templates/runbook.md')),
    'sdlc/.playbook/templates/runbook.md must be installed');
});

test('row 12: archive of a verified deploy change with a valid runbook keeps runbook.md', (t) => {
  const root = makeTempProject(t);
  assert.equal(runCli(root, ['init', '--tool', 'claude']).status, 0);
  const dir = writeDeployChange(root, 'deploy-ship', { status: 'verified', runbook: renderRunbook() });
  const res = runCli(root, ['archive', 'deploy-ship']);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const archived = fs.readdirSync(path.join(root, 'sdlc/changes/archive')).find((n) => n.endsWith('-deploy-ship'));
  assert.ok(archived, 'archived folder exists with date prefix');
  assert.ok(fs.existsSync(path.join(root, 'sdlc/changes/archive', archived, 'runbook.md')),
    'the archived folder must contain runbook.md');
  assert.ok(!fs.existsSync(dir), 'the live change folder must be gone after archive');
});

test('row 13: design.md names the deploy lens and writes runbook.md from the template', () => {
  const text = readPayload('playbook/design.md');
  assert.match(text, /runbook\.md/);
  assert.match(text, /templates\/runbook\.md/);
  assert.match(text, /\bdeploy\b/);
  assert.match(text, /named/);
  assert.match(text, /never valued/i);
});

test('row 14: review.md and sdlc-ops both name runbook.md; sdlc-ops checks steps, verify, rollback and secret values', () => {
  const review = readPayload('playbook/review.md');
  const ops = readPayload('adapters/claude/agents/sdlc-ops.md');
  assert.match(review, /runbook\.md/);
  assert.match(ops, /runbook\.md/);
  assert.match(ops, /\bsteps\b/i);
  assert.match(ops, /\bverify\b/i);
  assert.match(ops, /\brollback\b/i);
  assert.match(ops, /secret value/i);
});

test('row 15: the ship digest step links runbook.md when the change has one', () => {
  const block = stepBlock(readPayload('playbook/ship.md'), /^4\. \*\*Digest\*\*/);
  assert.ok(block, 'ship.md must have a "4. **Digest**" step');
  assert.ok(block.split('\n').some((l) => /link/i.test(l) && /runbook\.md/.test(l)),
    'the digest step must say to link runbook.md on one line');
});

test('row 16: new.md records one Assumptions line when a deploy signal is present without the deploy lens', () => {
  const block = stepBlock(readPayload('playbook/new.md'), /^4b\. /);
  assert.ok(block, 'new.md must have the "4b." lenses step');
  assert.match(block, /deploy signal/i);
  assert.ok(block.includes('## Assumptions'), 'the step must name "## Assumptions"');
  assert.match(block, /one line/i);
});

test('row 17: the conventions skill lists deploy, runbook.md and cap 60; the ledger has a runbook.md row quoting 60', () => {
  const skill = readPayload('adapters/claude/skills/sdlc-conventions/SKILL.md');
  assert.ok(skill.includes('<ux-ui|api|data|deploy>'), 'the skill lens list must read <ux-ui|api|data|deploy>');
  const skillLines = skill.split(/\r?\n/);
  assert.ok(skillLines.some((l) => l.includes('runbook.md')), 'the skill layout must name runbook.md');
  const cap = new RegExp(`\\b${CAPS.runbook}\\b`);
  assert.ok(skillLines.some((l) => /runbook/i.test(l) && cap.test(l)), 'the skill must give the runbook cap');
  const ledger = fs.readFileSync(path.join(PKG_ROOT, 'docs', 'design.md'), 'utf8').split(/\r?\n/);
  assert.ok(ledger.some((l) => /^\|\s*`[^`]*runbook\.md`/.test(l) && cap.test(l)),
    'docs/design.md must have a runbook.md table row quoting its cap');
});

test('row 18: runbook.md as a directory does not throw and is reported as an error naming runbook.md', (t) => {
  const root = makeTempProject(t);
  const dir = writeDeployChange(root, 'dir-runbook', { status: 'contracted' });
  fs.mkdirSync(path.join(dir, 'runbook.md'));
  let issues;
  assert.doesNotThrow(() => { issues = validateChange(dir); });
  assert.ok(issues.some((i) => i.level === 'error' && i.msg.includes('runbook.md')),
    `a runbook.md directory must give an error naming runbook.md, got ${JSON.stringify(issues)}`);
});

test('row 19: archive of a verified deploy change without runbook.md fails and leaves everything in place', (t) => {
  const root = makeTempProject(t);
  assert.equal(runCli(root, ['init', '--tool', 'claude']).status, 0);
  const dir = writeDeployChange(root, 'deploy-noop', { status: 'verified' });
  const res = runCli(root, ['archive', 'deploy-noop']);
  assert.notEqual(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout + res.stderr, /runbook\.md/, 'archive must name runbook.md as the reason');
  assert.ok(fs.existsSync(dir), 'the change folder must stay in place');
  assert.ok(!fs.existsSync(path.join(root, 'sdlc/specs/demo/spec.md')), 'no spec may be written');
});

test('row 20: a <…> placeholder in a section is an error; inside code, a comment or a fence it is not', (t) => {
  const root = makeTempProject(t);
  const withStep = SECTIONS.map(([n, b]) => [n, n === 'Steps' ? '1. <step>' : b]);
  const errs = runbookErrors(writeDeployChange(root, 'ph-step', { runbook: renderRunbook(withStep) }));
  assert.ok(errs.some((i) => /placeholder/i.test(i.msg) && i.msg.includes('<step>')),
    `a <step> placeholder must give an error naming it, got ${JSON.stringify(errs)}`);
  const quoted = SECTIONS.map(([n, b]) => [n, n === 'Config & Secrets'
    ? `- \`<NAME>\` stays literal\n<!-- <NAME> in a comment -->\n${FENCE}\n<NAME>\n${FENCE}` : b]);
  assert.deepEqual(runbookErrors(writeDeployChange(root, 'ph-quoted', { runbook: renderRunbook(quoted) })), []);
});

test('row 21: a runbook.md that is a link is refused as not a regular file', (t) => {
  const root = makeTempProject(t);
  const outside = path.join(root, 'outside-runbook.md');
  fs.writeFileSync(outside, renderRunbook());
  const dir = writeDeployChange(root, 'linked', { status: 'contracted' });
  try {
    fs.symlinkSync(outside, path.join(dir, 'runbook.md'), 'file');
  } catch (err) {
    t.skip(`cannot create a symlink here (${err.code})`);
    return;
  }
  const errs = runbookErrors(dir);
  assert.ok(errs.some((i) => /regular file/i.test(i.msg)),
    `a linked runbook.md must be refused, got ${JSON.stringify(errs)}`);
});

test('row 22: hasLens is the one lens-entry parser, and the validator uses it', async () => {
  const mod = await import(pathToFileURL(path.join(PKG_ROOT, 'lib', 'lenses.mjs')).href);
  assert.equal(typeof mod.hasLens, 'function', 'lib/lenses.mjs must export hasLens');
  assert.equal(mod.hasLens(['api@builtin', 'deploy@user:x'], 'deploy'), true);
  assert.equal(mod.hasLens('deploy@builtin', 'deploy'), false);
  assert.equal(mod.hasLens(undefined, 'deploy'), false);
  assert.equal(mod.hasLens(['deployx@builtin'], 'deploy'), false);
  const src = fs.readFileSync(path.join(PKG_ROOT, 'lib', 'validate.mjs'), 'utf8');
  assert.match(src, /hasLens\(/);
});

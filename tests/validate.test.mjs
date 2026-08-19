import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, writeChange, writeContractTests, STANDARD_BODY } from './helpers.mjs';
import { validateChange, validateContext } from '../scripts/validate.mjs';

function initProject(t) {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  return dir;
}

test('validate CLI: clean project exits 0', (t) => {
  const dir = initProject(t);
  const res = runCli(dir, ['validate']);
  assert.equal(res.status, 0, res.stdout + res.stderr);
});

test('change cap: exceeding the tier cap is an error', (t) => {
  const dir = initProject(t);
  const filler = Array.from({ length: 45 }, (_, i) => `- filler line ${i}`).join('\n');
  const changeDir = writeChange(dir, 'big-vibe', { tier: 'vibe', body: `# Change: Big\n${filler}\n` });
  const issues = validateChange(changeDir);
  assert.ok(issues.some((i) => i.level === 'error' && /cap for vibe: 40/.test(i.msg)), JSON.stringify(issues));
});

test('clarification markers: warn while status=new, error afterwards', (t) => {
  const dir = initProject(t);
  const body = `# Change: X\n\n## Why\nneed [NEEDS CLARIFICATION: what?]\n\n## Delta: auth\n\n### ADDED Requirement: R\nThe system SHALL r.\n\n#### Scenario: s\n- WHEN a\n- THEN b\n`;
  const newDir = writeChange(dir, 'c-new', { status: 'new', body });
  assert.ok(validateChange(newDir).some((i) => i.level === 'warn' && /CLARIFICATION/.test(i.msg)));

  const buildingDir = writeChange(dir, 'c-building', { status: 'building', body });
  writeContractTests(buildingDir);
  assert.ok(validateChange(buildingDir).some((i) => i.level === 'error' && /CLARIFICATION/.test(i.msg)));
});

test('contract gates: contracted standard change requires tests.md; deep also requires evals.md', (t) => {
  const dir = initProject(t);
  const noContract = writeChange(dir, 'no-contract', { status: 'contracted', body: STANDARD_BODY });
  assert.ok(validateChange(noContract).some((i) => /requires contract\/tests\.md/.test(i.msg)));

  const deepDir = writeChange(dir, 'deep-one', { tier: 'deep', status: 'contracted', body: STANDARD_BODY });
  writeContractTests(deepDir);
  assert.ok(validateChange(deepDir).some((i) => /requires contract\/evals\.md/.test(i.msg)));
});

test('frontmatter legality: bad tier/status/id mismatch are errors', (t) => {
  const dir = initProject(t);
  const changeDir = writeChange(dir, 'bad-meta', { tier: 'huge', status: 'wip', body: '# Change: X\n## Why\ny\n' });
  const issues = validateChange(changeDir);
  assert.ok(issues.some((i) => /tier must be one of/.test(i.msg)));
  assert.ok(issues.some((i) => /status must be one of/.test(i.msg)));
});

test('context: constitution over cap and always-budget breach are errors', (t) => {
  const dir = initProject(t);
  const sdlcRoot = path.join(dir, 'sdlc');
  const big = '# Constitution\n' + Array.from({ length: 35 }, (_, i) => `- rule ${i}`).join('\n');
  fs.writeFileSync(path.join(sdlcRoot, 'context/constitution.md'), big);
  let issues = validateContext(sdlcRoot);
  assert.ok(issues.some((i) => /constitution\.md is 36 lines \(cap 30\)/.test(i.msg)), JSON.stringify(issues));

  const steering = `---\nname: db\ninclusion: always\n---\n# Steering: db\n` +
    Array.from({ length: 30 }, (_, i) => `- convention ${i}`).join('\n');
  fs.writeFileSync(path.join(sdlcRoot, 'context/steering/db.md'), steering);
  issues = validateContext(sdlcRoot);
  assert.ok(issues.some((i) => /always-loaded budget/.test(i.msg)), JSON.stringify(issues));
});

test('context: steering with inclusion paths but no pathMatch is an error', (t) => {
  const dir = initProject(t);
  const sdlcRoot = path.join(dir, 'sdlc');
  fs.writeFileSync(path.join(sdlcRoot, 'context/steering/api.md'),
    '---\nname: api\ninclusion: paths\n---\n# Steering: api\n- x\n');
  const issues = validateContext(sdlcRoot);
  assert.ok(issues.some((i) => /requires pathMatch/.test(i.msg)));
});

test('strict mode: MODIFIED against missing spec requirement becomes an error', (t) => {
  const dir = initProject(t);
  const body = STANDARD_BODY.replace('### ADDED Requirement: Two-factor login', '### MODIFIED Requirement: Ghost');
  const changeDir = writeChange(dir, 'mod-ghost', { body });
  const specsDir = path.join(dir, 'sdlc', 'specs');
  const lax = validateChange(changeDir, { specsDir });
  assert.ok(lax.some((i) => i.level === 'warn' && /Ghost/.test(i.msg)));
  const strict = validateChange(changeDir, { specsDir, strict: true });
  assert.ok(strict.some((i) => i.level === 'error' && /Ghost/.test(i.msg)));
});

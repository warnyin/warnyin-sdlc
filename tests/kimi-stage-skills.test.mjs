import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { makeTempProject, runCli, PKG_ROOT } from './helpers.mjs';
import { parseManifest, isPrunablePath } from '../lib/manifest.mjs';
import { parseFrontmatter } from '../lib/frontmatter.mjs';
import { renderKimiSkill, kimiStageStubs } from '../bin/cli.mjs';

const STUB_DIR = path.join(PKG_ROOT, 'payload/adapters/claude/commands/sdlc');
// Derived at run time, never hardcoded: a stage added for Claude must show up here by itself,
// which is the whole point of rendering both adapters from one source.
const stages = () => fs.readdirSync(STUB_DIR).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
const stubDescription = (stage) =>
  parseFrontmatter(fs.readFileSync(path.join(STUB_DIR, `${stage}.md`), 'utf8')).data.description;

// row 1 — one skill per stage, same description, same playbook
test('row 1: a fresh kimi install exposes every Claude stage as a skill', (t) => {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'kimi']).status, 0);

  const skillsDir = path.join(dir, '.kimi-code', 'skills');
  const installed = fs.readdirSync(skillsDir).sort();
  assert.deepEqual(installed, stages().map((s) => `sdlc-${s}`).sort(),
    'exactly one skill per Claude stage stub — no more, no fewer');

  for (const stage of stages()) {
    const file = path.join(skillsDir, `sdlc-${stage}`, 'SKILL.md');
    const raw = fs.readFileSync(file, 'utf8');
    const { data, body } = parseFrontmatter(raw);
    assert.equal(data.description, stubDescription(stage), `${stage}: description must match the Claude stub`);
    assert.match(body, new RegExp(`sdlc/\\.playbook/${stage}\\.md`), `${stage}: must name the same playbook`);
    assert.match(body, /\$ARGUMENTS/, `${stage}: must pass the user's arguments through`);
  }
});

// row 2 — required frontmatter, and stages are manual-only
test('row 2: every skill carries the frontmatter Kimi requires and is manual-only', (t) => {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'kimi']).status, 0);

  for (const stage of stages()) {
    const { data } = parseFrontmatter(
      fs.readFileSync(path.join(dir, '.kimi-code/skills', `sdlc-${stage}`, 'SKILL.md'), 'utf8'));
    assert.equal(data.name, `sdlc-${stage}`, 'name is what /skill:<name> resolves');
    assert.ok(data.description && data.description.length > 0, `${stage}: description is required by Kimi`);
    assert.equal(String(data.disableModelInvocation), 'true',
      `${stage}: a stage runs because a person asked — ship merges specs and archives`);
  }
});

// row 3 — the renderer, checked against a source it does NOT read
// Review caught the original assertion here as circular: comparing kimiStageStubs() to a
// directory listing of the same directory can never fail. What is independent is the playbook
// tree — every stage the renderer emits must point at a playbook that actually exists, which
// catches a stub renamed or pointing nowhere.
test('row 3: every rendered stage points at a playbook that exists', () => {
  const rendered = kimiStageStubs();
  assert.ok(rendered.length > 0, 'the renderer found stubs at all');
  for (const { stage, playbook, description } of rendered) {
    const onDisk = path.join(PKG_ROOT, 'payload', playbook.replace(/^sdlc\/\.playbook\//, 'playbook/'));
    assert.ok(fs.existsSync(onDisk), `${stage}: points at ${playbook}, which does not exist`);
    assert.ok(description.trim().length > 0, `${stage}: Kimi requires a non-empty description`);
  }

  // Drive it directly: a stage the renderer has never seen still produces a well-formed skill,
  // so adding a stage for Claude cannot leave Kimi behind.
  const made = renderKimiSkill('brand-new', 'A stage invented by this test', 'sdlc/.playbook/brand-new.md');
  const { data, body } = parseFrontmatter(made);
  assert.equal(data.name, 'sdlc-brand-new');
  assert.equal(data.description, 'A stage invented by this test');
  assert.equal(String(data.disableModelInvocation), 'true');
  assert.match(body, /sdlc\/\.playbook\/brand-new\.md/);
});

// row 4 — the narrow allowlist: a user's own skill is outside the delete surface BY SCOPE
test('row 4: only our own sdlc-* skill files are prunable', () => {
  assert.equal(isPrunablePath('.kimi-code/skills/sdlc-new/SKILL.md'), true, 'ours');
  assert.equal(isPrunablePath('.kimi-code/skills/my-own/SKILL.md'), false,
    "a user's own skill must never be a prune candidate at all");
  assert.equal(isPrunablePath('.kimi-code/skills/sdlc-new/notes.md'), false,
    'only the SKILL.md we write, not anything else a user drops beside it');
});

// row 5 — a real deselect prunes ours and spares theirs
test('row 5: deselecting kimi reclaims our skills and leaves the user\'s alone', (t) => {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'claude,kimi']).status, 0);

  const mine = path.join(dir, '.kimi-code/skills/my-own/SKILL.md');
  fs.mkdirSync(path.dirname(mine), { recursive: true });
  fs.writeFileSync(mine, '---\nname: my-own\ndescription: mine\n---\nmine\n');

  const ours = path.join(dir, '.kimi-code/skills/sdlc-new/SKILL.md');
  assert.ok(fs.existsSync(ours), 'precondition: our skill installed');

  assert.equal(runCli(dir, ['update', '--tool', 'claude']).status, 0);

  assert.ok(!fs.existsSync(ours), 'our skill is reclaimed when the tool is deselected');
  const manifest = parseManifest(fs.readFileSync(path.join(dir, 'sdlc/.state/manifest'), 'utf8'));
  assert.equal([...manifest.keys()].filter((p) => p.startsWith('.kimi-code/')).length, 0,
    'and its manifest entries go with it');
  assert.ok(fs.existsSync(mine), "the user's own skill survives — it was never in scope");
  // prune walks up removing empty dirs after deleting; with a skill of the user's still there,
  // their directory must not be swept with ours.
  assert.ok(fs.existsSync(path.join(dir, '.kimi-code/skills')), 'their skills directory stands');
});

// row 6 — a file the user wrote at our path is not taken over
test('row 6: a hand-written file at our skill path is preserved and unclaimed', (t) => {
  const dir = makeTempProject(t);
  const mine = path.join(dir, '.kimi-code/skills/sdlc-new/SKILL.md');
  fs.mkdirSync(path.dirname(mine), { recursive: true });
  const content = '---\nname: sdlc-new\ndescription: my own version\n---\nmine, predating sdlc\n';
  fs.writeFileSync(mine, content);

  assert.equal(runCli(dir, ['init', '--tool', 'kimi']).status, 0);

  assert.equal(fs.readFileSync(mine, 'utf8'), content, 'left byte-identical');
  const manifest = parseManifest(fs.readFileSync(path.join(dir, 'sdlc/.state/manifest'), 'utf8'));
  assert.ok(!manifest.has('.kimi-code/skills/sdlc-new/SKILL.md'), 'never claimed');
});

// row 7 — ownership is recorded
test('row 7: every installed skill is recorded in the manifest', (t) => {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'kimi']).status, 0);
  const manifest = parseManifest(fs.readFileSync(path.join(dir, 'sdlc/.state/manifest'), 'utf8'));
  for (const stage of stages()) {
    assert.ok(manifest.has(`.kimi-code/skills/sdlc-${stage}/SKILL.md`), `${stage} is owned`);
  }
});

// row 8 — the summary tells the truth about what landed
test('row 8: the install summary names the skills it installed', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'kimi']);
  assert.equal(res.status, 0);
  const out = res.stdout + res.stderr;
  assert.match(out, new RegExp(`${stages().length}\\s+skills in \\.kimi-code/skills/`),
    'must name the kimi skills line specifically — a bare "N skills" also matches .claude/');
});

// row 9 — owned means refreshable, the lesson from the manifest-carryover bug
test('row 9: a stale skill is refreshed by update, not called user-modified', (t) => {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'kimi']).status, 0);

  const rel = '.kimi-code/skills/sdlc-new/SKILL.md';
  const file = path.join(dir, rel);
  const current = fs.readFileSync(file, 'utf8');
  const stale = current + '\nSTALE RENDERING\n';
  fs.writeFileSync(file, stale);

  const mPath = path.join(dir, 'sdlc/.state/manifest');
  const m = parseManifest(fs.readFileSync(mPath, 'utf8'));
  m.set(rel, createHash('sha256').update(stale).digest('hex'));
  fs.writeFileSync(mPath, [...m.entries()].map(([p, h]) => `${h}  ${p}`).join('\n') + '\n');

  const res = runCli(dir, ['update']);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(fs.readFileSync(file, 'utf8'), current, 'refreshed back to the current rendering');
  assert.ok(!(res.stdout + res.stderr).includes(`kept (user-modified): ${rel}`));
});

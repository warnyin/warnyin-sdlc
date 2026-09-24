import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { makeTempProject, runCli, PKG_ROOT } from './helpers.mjs';
import { detectTools, toolName } from '../bin/detect.mjs';
import { parseManifest } from '../lib/manifest.mjs';
import { TOOLS, normalizeEol } from '../bin/cli.mjs';

// ========== Contract Row 1 ==========
// Integration: fresh project · init --tool kimi → .kimi-code/AGENTS.md exists, no placeholder, manifest records it
test('kimi adapter: fresh init --tool kimi installs .kimi-code/AGENTS.md and records in manifest', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'kimi']);
  assert.equal(res.status, 0, res.stderr);

  const agentsPath = path.join(dir, '.kimi-code', 'AGENTS.md');
  assert.ok(fs.existsSync(agentsPath), '.kimi-code/AGENTS.md should exist');

  const content = fs.readFileSync(agentsPath, 'utf8');
  assert.ok(!content.includes('{{RULES_CARD}}'), 'placeholder should be substituted');
  assert.match(content, /sdlc\/\.playbook/, 'must point at the stage playbook, like every other lite adapter');

  const manifest = parseManifest(fs.readFileSync(path.join(dir, 'sdlc', '.state', 'manifest'), 'utf8'));
  assert.ok(manifest.has('.kimi-code/AGENTS.md'), 'manifest should record .kimi-code/AGENTS.md as owned');
});

// ========== Contract Row 2 ==========
// Unit: read .kimi-code/AGENTS.md · rules-card matches payload/playbook/rules-card.md trimmed, byte for byte
test('kimi adapter: installed AGENTS.md contains rules-card matching the payload template', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'kimi']);

  const agentsContent = normalizeEol(fs.readFileSync(path.join(dir, '.kimi-code', 'AGENTS.md'), 'utf8'));
  const card = normalizeEol(fs.readFileSync(path.join(PKG_ROOT, 'payload', 'playbook', 'rules-card.md'), 'utf8').trim());

  assert.ok(agentsContent.includes(card), 'rules-card body must match payload/playbook/rules-card.md byte for byte');
});

// ========== Contract Row 3 ==========
// Integration: hand-written .kimi-code/AGENTS.md · init --tool kimi → file unchanged, manifest doesn't claim it
test('kimi adapter: hand-written .kimi-code/AGENTS.md is preserved and not claimed', (t) => {
  const dir = makeTempProject(t);
  fs.mkdirSync(path.join(dir, '.kimi-code'), { recursive: true });
  const userContent = '# My own Kimi agents\nCustom content here\n';
  fs.writeFileSync(path.join(dir, '.kimi-code', 'AGENTS.md'), userContent);

  const res = runCli(dir, ['init', '--tool', 'kimi']);
  assert.equal(res.status, 0, res.stderr);

  const afterContent = fs.readFileSync(path.join(dir, '.kimi-code', 'AGENTS.md'), 'utf8');
  assert.equal(afterContent, userContent, 'hand-written file should be unchanged');

  const manifest = parseManifest(fs.readFileSync(path.join(dir, 'sdlc', '.state', 'manifest'), 'utf8'));
  assert.ok(!manifest.has('.kimi-code/AGENTS.md'), 'manifest should not claim user-written file');
});

// ========== Contract Row 4 ==========
// Integration: inited with --tool kimi · delete .kimi-code/ · update runs → reinstalled, driven by config.yaml
test('kimi adapter: update reinstalls .kimi-code/AGENTS.md when deleted, reading tools from config.yaml', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'kimi']);

  const agentsPath = path.join(dir, '.kimi-code', 'AGENTS.md');
  assert.ok(fs.existsSync(agentsPath), 'precondition: AGENTS.md exists after init');

  // Delete the .kimi-code directory
  fs.rmSync(path.join(dir, '.kimi-code'), { recursive: true, force: true });
  assert.ok(!fs.existsSync(agentsPath), 'AGENTS.md deleted');

  // Run update — should reinstall from config.yaml
  const res = runCli(dir, ['update']);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(agentsPath), 'AGENTS.md should be reinstalled by update');
});

// ========== Contract Row 5 ==========
// Unit: only .kimi-code directory · detectTools runs → returns exactly ['kimi']
test('kimi adapter: detectTools identifies .kimi-code directory presence as kimi', () => {
  // This is a unit test on the detectTools function — we'll need a temp dir
  // but the test is really about the detection logic, not the CLI
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsdlc-kimi-'));
  try {
    fs.mkdirSync(path.join(tempDir, '.kimi-code'), { recursive: true });
    const tools = detectTools(tempDir).sort();
    assert.deepEqual(tools, ['kimi'], 'detectTools should find kimi via .kimi-code directory');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// ========== Contract Row 6 ==========
// Integration: .kimi-code exists · init interactive no --tool → "Kimi Code" offered pre-selected as detected
test('kimi adapter: init detects and pre-selects kimi in interactive mode', (t) => {
  const dir = makeTempProject(t);
  fs.mkdirSync(path.join(dir, '.kimi-code'), { recursive: true });

  // detectTools + toolName are exactly what resolveTools (bin/cli.mjs) feeds the picker's
  // preSelected/note fields; driving the real interactive multiSelect would need injected
  // stdin keystrokes, which this suite doesn't do for any tool (see init-ux.test.mjs, where
  // the picker's reducer is tested on a hand-built choices array instead).
  const tools = detectTools(dir).sort();
  assert.ok(tools.includes('kimi'), 'detectTools should identify kimi from .kimi-code directory');
  assert.equal(toolName('kimi'), 'Kimi Code', 'the picker label for kimi must read "Kimi Code"');
});

// ========== Contract Row 7 ==========
// Integration: no .kimi-code · init --tool kimi → installs successfully even without pre-existing marker
test('kimi adapter: init --tool kimi works without pre-existing .kimi-code directory', (t) => {
  const dir = makeTempProject(t);
  assert.ok(!fs.existsSync(path.join(dir, '.kimi-code')), 'precondition: no .kimi-code yet');

  const res = runCli(dir, ['init', '--tool', 'kimi']);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(path.join(dir, '.kimi-code', 'AGENTS.md')), 'should install AGENTS.md');
});

// ========== Contract Row 8 ==========
// Unit: TOOLS and --tool parsing · --tool kimi and --tool all · both succeed, all includes kimi, unknown-tool error lists kimi
test('kimi adapter: TOOLS array includes kimi and --tool parsing accepts it', (t) => {
  const dir = makeTempProject(t);

  // Test 1: --tool kimi should work
  const res1 = runCli(dir, ['init', '--tool', 'kimi']);
  assert.equal(res1.status, 0, res1.stderr);

  // Test 2: --tool all should include kimi
  const dir2 = makeTempProject(t);
  const res2 = runCli(dir2, ['init', '--tool', 'all']);
  assert.equal(res2.status, 0, res2.stderr);
  assert.ok(fs.existsSync(path.join(dir2, '.kimi-code', 'AGENTS.md')), 'all should install kimi');

  // Test 3: TOOLS constant should include 'kimi' (this is from bin/cli.mjs)
  assert.ok(TOOLS.includes('kimi'), 'TOOLS export should include kimi');
});

// ========== Contract Row 8 Part 2 ==========
// Unit: unknown-tool error message should mention kimi as a valid choice
test('kimi adapter: invalid --tool error message includes kimi in the valid choices list', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'unknown-tool']);
  assert.notEqual(res.status, 0, 'an unknown tool must fail, not silently succeed');
  assert.match(res.stderr, /unknown tool/i);
  assert.ok(res.stderr.includes('kimi'), 'the valid-choices list in the error must name kimi');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli } from './helpers.mjs';
import { parseManifest } from '../lib/manifest.mjs';

// ========== Contract Row 1 ==========
// Integration: given project inited with --tool claude, when init --tool kimi runs,
// config.yaml records tools: [claude, kimi], and both remain after a following plain update
test('init-tools-sync: adding a tool via second init updates config.yaml and survives update', (t) => {
  const dir = makeTempProject(t);
  const configPath = path.join(dir, 'sdlc', 'config.yaml');

  // First init with claude
  const res1 = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res1.status, 0, `first init failed: ${res1.stderr}`);
  assert.ok(fs.existsSync(path.join(dir, '.claude')), 'claude should be installed');
  assert.match(fs.readFileSync(configPath, 'utf8'), /tools: \[claude\]/, 'config should record claude');

  // Second init with kimi (on same project)
  const res2 = runCli(dir, ['init', '--tool', 'kimi']);
  assert.equal(res2.status, 0, `second init failed: ${res2.stderr}`);
  assert.ok(fs.existsSync(path.join(dir, '.kimi-code')), 'kimi should be installed');
  const configAfterKimi = fs.readFileSync(configPath, 'utf8');
  assert.match(configAfterKimi, /tools: \[claude, kimi\]/, 'config should record both claude and kimi after second init');

  // Plain update should keep both tool directories
  const updateRes = runCli(dir, ['update']);
  assert.equal(updateRes.status, 0, `update failed: ${updateRes.stderr}`);
  assert.ok(fs.existsSync(path.join(dir, '.claude')), 'claude should survive update');
  assert.ok(fs.existsSync(path.join(dir, '.kimi-code')), 'kimi should survive update (not pruned as obsolete)');
});

// ========== Contract Row 2 ==========
// Integration: given project inited with --tool claude, when init --tool claude runs again,
// config.yaml's tools: line is byte-identical (no duplicate, no reorder)
test('init-tools-sync: re-running init for same tool leaves config.yaml unchanged', (t) => {
  const dir = makeTempProject(t);
  const configPath = path.join(dir, 'sdlc', 'config.yaml');

  // First init with claude
  const res1 = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res1.status, 0, `first init failed: ${res1.stderr}`);
  const configBefore = fs.readFileSync(configPath, 'utf8');
  assert.match(configBefore, /tools: \[claude\]/, 'precondition: config records claude');

  // Second init with same tool
  const res2 = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res2.status, 0, `second init failed: ${res2.stderr}`);
  const configAfter = fs.readFileSync(configPath, 'utf8');

  // The tools: line must be identical (byte-for-byte) — no duplicate, no reorder
  assert.match(configAfter, /tools: \[claude\]/, 'config should still record only claude');
  const lineAfter = configAfter.split(/\r?\n/).find((l) => l.startsWith('tools:'));
  const lineBefore = configBefore.split(/\r?\n/).find((l) => l.startsWith('tools:'));
  assert.equal(lineAfter, lineBefore, 'tools: line should be byte-identical after re-running init');
});

// ========== Contract Row 3 ==========
// Integration: given project with .cursor/ present (detected) and config recording tools: [cursor],
// when init runs with cursor deselected (using --tool none to simulate interactive deselect),
// .cursor/ is untouched and config still records cursor
test('init-tools-sync: interactively deselecting a detected tool does not remove it or its record', (t) => {
  const dir = makeTempProject(t);
  const configPath = path.join(dir, 'sdlc', 'config.yaml');
  const cursorPath = path.join(dir, '.cursor');

  // Simulate a prior init that installed cursor: create .cursor/ and a config recording it
  runCli(dir, ['init', '--tool', 'cursor']);
  assert.ok(fs.existsSync(cursorPath), 'precondition: .cursor/ should exist');
  assert.match(fs.readFileSync(configPath, 'utf8'), /tools: \[cursor\]/, 'precondition: config should record cursor');

  // Now init with --tool none (simulates user unchecking everything in the picker)
  const res = runCli(dir, ['init', '--tool', 'none']);
  assert.equal(res.status, 0, `init --tool none failed: ${res.stderr}`);

  // Cursor directory and record must be untouched (only init --tool none can request "no tools", not deselect)
  assert.ok(fs.existsSync(cursorPath), '.cursor/ should still exist after deselecting it');
  assert.match(fs.readFileSync(configPath, 'utf8'), /tools: \[cursor\]/, 'config should still record cursor after deselecting in picker');
});

// ========== Contract Row 4 ==========
// Integration: given config.yaml with no tools: line at all,
// when init --tool kimi runs, no tools: line is added (file unchanged except for other init writes)
test('init-tools-sync: a config predating the tools: key is left unchanged', (t) => {
  const dir = makeTempProject(t);
  const configPath = path.join(dir, 'sdlc', 'config.yaml');

  // First init to create sdlc structure
  runCli(dir, ['init', '--tool', 'claude']);
  const configWithTools = fs.readFileSync(configPath, 'utf8');

  // Strip the tools: line to simulate a pre-tools-key config
  const configWithoutTools = configWithTools.split(/\r?\n/).filter((l) => !l.startsWith('tools:')).join('\n');
  fs.writeFileSync(configPath, configWithoutTools);

  const configBefore = fs.readFileSync(configPath, 'utf8');
  assert.ok(!configBefore.includes('tools:'), 'precondition: config should have no tools: line');

  // Run init with a different tool
  const res = runCli(dir, ['init', '--tool', 'kimi']);
  assert.equal(res.status, 0, `init --tool kimi failed: ${res.stderr}`);

  const configAfter = fs.readFileSync(configPath, 'utf8');
  // Config should not gain a tools: line (leaving the gap as-is, matching update's behavior)
  assert.ok(!configAfter.includes('tools:'), 'config should still have no tools: line (gap left unfixed)');
  // The summary must not claim a write that never happened (review caught this: persistToolsLine
  // no-ops here, so printInitSummary must not say "(recorded ...)").
  assert.doesNotMatch(res.stdout, /\(recorded/, 'summary must not claim tools were recorded when the write was a no-op');
});

// ========== Contract Row 5 ==========
// Integration: given fresh project (no config.yaml yet),
// when init --tool claude,kimi runs, config.yaml is seeded with exactly tools: [claude, kimi]
test('init-tools-sync: fresh install with multiple tools seeds config.yaml correctly', (t) => {
  const dir = makeTempProject(t);
  const configPath = path.join(dir, 'sdlc', 'config.yaml');

  assert.ok(!fs.existsSync(configPath), 'precondition: no config.yaml yet');

  const res = runCli(dir, ['init', '--tool', 'claude,kimi']);
  assert.equal(res.status, 0, `init failed: ${res.stderr}`);
  assert.ok(fs.existsSync(configPath), 'config.yaml should be created');

  const config = fs.readFileSync(configPath, 'utf8');
  assert.match(config, /tools: \[claude, kimi\]/, 'config should be seeded with both tools');
  // Verify both tool directories exist
  assert.ok(fs.existsSync(path.join(dir, '.claude')), 'claude should be installed');
  assert.ok(fs.existsSync(path.join(dir, '.kimi-code')), 'kimi should be installed');
});

// ========== Contract Row 6 ==========
// Unit: given the shared tools-line-rewrite helper,
// when called with a tools: line present vs. absent, then it rewrites the first and is a no-op for the second.
// The helper (persistToolsLine) does not exist yet; this test will fail with import error until T1 lands.
test('init-tools-sync: persistToolsLine helper rewrites tools: line or is no-op if absent', async (t) => {
  // This test imports a function that does not exist yet and will fail with an import/export error.
  // Once T1 extracts persistToolsLine into bin/cli.mjs and exports it, this test will run.
  // It tests the unit behavior: given a config path and tools list, the helper updates the line
  // if present, or does nothing if the line does not exist.

  let persistToolsLine;
  try {
    // Try to import the function that will be extracted in T1
    const m = await import('../bin/cli.mjs');
    persistToolsLine = m.persistToolsLine;
  } catch (err) {
    assert.fail(`persistToolsLine not yet exported from bin/cli.mjs: ${err.message}`);
  }

  const dir = makeTempProject(t);
  const configPath = path.join(dir, 'sdlc', 'config.yaml');

  // Ensure the sdlc directory exists
  fs.mkdirSync(path.join(dir, 'sdlc'), { recursive: true });

  // Case 1: config WITH a tools: line
  fs.writeFileSync(configPath, 'some-key: value\ntools: [claude]\nother: line\n');
  persistToolsLine(configPath, ['claude', 'kimi']);
  const afterRewrite = fs.readFileSync(configPath, 'utf8');
  assert.match(afterRewrite, /tools: \[claude, kimi\]/, 'should rewrite tools: line when present');
  assert.match(afterRewrite, /some-key: value/, 'should preserve other lines when rewriting');
  assert.match(afterRewrite, /other: line/, 'should preserve other lines when rewriting');

  // Case 2: config WITHOUT a tools: line
  const configNoTools = 'some-key: value\nother: line\n';
  fs.writeFileSync(configPath, configNoTools);
  persistToolsLine(configPath, ['kimi']);
  const afterNoOp = fs.readFileSync(configPath, 'utf8');
  assert.equal(afterNoOp, configNoTools, 'should be a no-op when tools: line is absent');

  // Case 3: verify update's existing behavior is unchanged
  // cmdUpdate's existing inline regex is: raw.replace(/^tools:.*$/m, `tools: [${tools.join(', ')}]`)
  // The extracted helper must maintain that exact behavior.
  fs.writeFileSync(configPath, 'tools: [old]\n');
  persistToolsLine(configPath, ['new', 'list']);
  const afterUpdate = fs.readFileSync(configPath, 'utf8');
  assert.match(afterUpdate, /^tools: \[new, list\]$/m, 'should match cmdUpdate\'s existing regex behavior');

  // Case 4: the REAL config.yaml shape carries a trailing inline comment on the tools: line
  // (payload/templates/config.yaml: `tools: []            # filled by \`warnyin-sdlc init\``).
  // Verified live: `update --tool` already strips that comment today — the extracted helper
  // must reproduce that exact pre-existing behavior, not fix it and not make it worse.
  const realShape = "# @warnyin/sdlc project config — machine-read; keep minimal.\n"
    + "language: en\n"
    + "tools: [claude]            # filled by `warnyin-sdlc init`\n"
    + "# Optional price table for cost reporting (USD per 1M tokens).\n";
  fs.writeFileSync(configPath, realShape);
  persistToolsLine(configPath, ['claude', 'kimi']);
  const afterRealShape = fs.readFileSync(configPath, 'utf8');
  assert.match(afterRealShape, /^tools: \[claude, kimi\]$/m, 'rewrites the real template shape the same way cmdUpdate always has');
  assert.ok(!afterRealShape.includes('filled by'), 'reproduces the existing comment-stripping behavior, not a new one');
  assert.match(afterRealShape, /# Optional price table/, 'lines other than tools: are untouched');

  // Case 5 (review): `recorded` values come from the project's own config.yaml, unvalidated —
  // unlike CLI-sourced tool names, they could contain `$`-patterns. A string-replacement (not
  // a replacer function) would let `$&`/`$\`` be interpreted by String.replace and mangle the
  // surrounding file instead of writing the literal text.
  fs.writeFileSync(configPath, "tools: [claude]\nother: line\n");
  persistToolsLine(configPath, ["$&weird", "$`tool", "kimi"]);
  const afterDollar = fs.readFileSync(configPath, 'utf8');
  assert.equal(afterDollar, "tools: [$&weird, $`tool, kimi]\nother: line\n",
    'a tool name containing $-patterns is written literally, not interpreted as a replacement pattern');
});

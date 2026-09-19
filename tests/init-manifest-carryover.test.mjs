import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { makeTempProject, runCli } from './helpers.mjs';
import { parseManifest } from '../lib/manifest.mjs';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ========== Contract Row 1 ==========
// Integration: given project inited with --tool claude, when init --tool kimi runs,
// then every .claude/ entry is still in the manifest, .kimi-code/AGENTS.md is added,
// and no .claude/ file was rewritten
test('init-manifest-carryover: row 1 - second init keeps first tool entries in manifest', (t) => {
  const dir = makeTempProject(t);

  // First init with claude
  const res1 = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res1.status, 0, `first init failed: ${res1.stderr}`);

  const manifestPath = path.join(dir, 'sdlc', '.state', 'manifest');
  const manifest1 = parseManifest(fs.readFileSync(manifestPath, 'utf8'));

  // Count .claude/ entries
  const claudeEntries1 = [...manifest1.keys()].filter(p => p.startsWith('.claude/'));
  assert.ok(claudeEntries1.length > 0, 'precondition: claude init should record .claude/ entries');

  // Read a sample claude file to verify it exists
  const sampleClaudeFile = claudeEntries1[0];
  const sampleClaudePath = path.join(dir, sampleClaudeFile);
  assert.ok(fs.existsSync(sampleClaudePath), `precondition: ${sampleClaudeFile} should exist after init`);
  const claudeContentBefore = fs.readFileSync(sampleClaudePath, 'utf8');

  // Second init with kimi
  const res2 = runCli(dir, ['init', '--tool', 'kimi']);
  assert.equal(res2.status, 0, `second init failed: ${res2.stderr}`);

  // Check manifest after second init
  const manifest2 = parseManifest(fs.readFileSync(manifestPath, 'utf8'));

  // All .claude/ entries must still be there
  const claudeEntries2 = [...manifest2.keys()].filter(p => p.startsWith('.claude/'));
  assert.deepEqual(claudeEntries2, claudeEntries1, 'all .claude/ entries should survive second init');

  // .kimi-code/AGENTS.md must be added
  assert.ok(manifest2.has('.kimi-code/AGENTS.md'), '.kimi-code/AGENTS.md should be in manifest after kimi init');

  // The sample claude file should not be rewritten (content unchanged)
  const claudeContentAfter = fs.readFileSync(sampleClaudePath, 'utf8');
  assert.equal(claudeContentAfter, claudeContentBefore, `${sampleClaudeFile} should not be rewritten`);
});

// ========== Contract Row 2 ==========
// Integration: given a project with one .claude/ file staged as ours-but-older
// (disk content differs from payload, manifest entry equals disk hash),
// when update runs, then the file is refreshed to current payload, counted as written,
// and no "kept (user-modified)" warning names it
test('init-manifest-carryover: row 2 - stale-but-owned file is refreshed by update after first init drops it', (t) => {
  const dir = makeTempProject(t);

  // First init with claude
  const res1 = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res1.status, 0, `first init failed: ${res1.stderr}`);

  const manifestPath = path.join(dir, 'sdlc', '.state', 'manifest');
  const claudeFile = '.claude/commands/sdlc/new.md';
  const claudePath = path.join(dir, claudeFile);
  const currentPayloadContent = fs.readFileSync(claudePath, 'utf8');

  // Stage it as ours-but-older BEFORE the second init — the order matters. Staging afterwards
  // would re-add the very manifest entry the bug deletes, hiding the failure: update would then
  // refresh the file even unfixed. This is the state a framework version bump leaves behind:
  // disk content differs from the current payload, and the manifest records that disk hash.
  const staleContent = currentPayloadContent + '\nSTALE PAYLOAD VERSION\n';
  fs.writeFileSync(claudePath, staleContent);
  const staged = parseManifest(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(staged.has(claudeFile), `precondition: ${claudeFile} is recorded after the first init`);
  staged.set(claudeFile, sha(staleContent));
  fs.writeFileSync(manifestPath, [...staged.entries()].map(([p, h]) => `${h}  ${p}`).join('\n') + '\n');

  // Second init for a different tool — this is what drops the entry when unfixed.
  const res2 = runCli(dir, ['init', '--tool', 'kimi']);
  assert.equal(res2.status, 0, `second init failed: ${res2.stderr}`);

  // config.yaml lists both tools by now, so update DOES visit this file either way — being
  // visited is not what is under test. installFile still refuses to refresh unless the old
  // manifest records the file's current hash, so the carried-forward entry is the only thing
  // standing between "refreshed" and "frozen and blamed on the user".
  const updateRes = runCli(dir, ['update']);
  assert.equal(updateRes.status, 0, `update failed: ${updateRes.stderr}`);
  const out = updateRes.stdout + updateRes.stderr;

  // Half the bug: the file freezes at its old payload version and is never refreshed again.
  const refreshedContent = fs.readFileSync(claudePath, 'utf8');
  assert.ok(!refreshedContent.includes('STALE PAYLOAD VERSION'), 'stale file should be refreshed by update');
  assert.equal(refreshedContent, currentPayloadContent, 'file should match current payload');

  // The other half: the user is told they edited a file they never touched.
  assert.ok(!out.includes(`kept (user-modified): ${claudeFile}`),
    `update must not call ${claudeFile} user-modified when it was only an older payload version`);
});

// ========== Contract Row 3 ==========
// Integration: given a project inited with --tool claude,
// when init --tool kimi runs, then the printed summary counts describe only this run,
// not the .claude/ tree it carried forward
test('init-manifest-carryover: row 3 - install summary counts only what this run touched', (t) => {
  const dir = makeTempProject(t);

  // First init with claude
  const res1 = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res1.status, 0, `first init failed: ${res1.stderr}`);

  // printInitSummary prints "<n> commands, <n> skills and <n> agents in .claude/" — and only
  // when those counts are non-zero. It counts ctx.manifest.keys(), which is why the fix must
  // merge at WRITE time instead of seeding ctx.manifest: seeding it would make this run report
  // a .claude/ tree it never installed. Positive control first, so the negative below cannot
  // pass vacuously.
  const firstSummary = res1.stdout + res1.stderr;
  assert.match(firstSummary, /\d+ commands, \d+ skills and \d+ agents in \.claude\//,
    'positive control: the claude install does report its counts');

  const res2 = runCli(dir, ['init', '--tool', 'kimi']);
  assert.equal(res2.status, 0, `second init failed: ${res2.stderr}`);
  const secondSummary = res2.stdout + res2.stderr;

  assert.match(secondSummary, /Rules for Kimi Code/, 'the kimi run reports what it did install');
  assert.doesNotMatch(secondSummary, /commands, \d+ skills and \d+ agents in \.claude\//,
    'a run that installed only kimi must not report claude counts it merely carried forward');
});

// ========== Contract Row 4 ==========
// Integration: given a project inited with --tool claude,
// when init --tool none runs, then the manifest is unchanged
test('init-manifest-carryover: row 4 - init --tool none preserves all entries', (t) => {
  const dir = makeTempProject(t);

  // First init with claude
  const res1 = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res1.status, 0, `first init failed: ${res1.stderr}`);

  const manifestPath = path.join(dir, 'sdlc', '.state', 'manifest');
  const manifestBefore = parseManifest(fs.readFileSync(manifestPath, 'utf8'));
  const entriesBefore = new Set(manifestBefore.keys());

  // Run init --tool none
  const res2 = runCli(dir, ['init', '--tool', 'none']);
  assert.equal(res2.status, 0, `init --tool none failed: ${res2.stderr}`);

  // Manifest should be completely unchanged
  const manifestAfter = parseManifest(fs.readFileSync(manifestPath, 'utf8'));
  const entriesAfter = new Set(manifestAfter.keys());

  assert.deepEqual(entriesAfter, entriesBefore, 'manifest should be unchanged after init --tool none');

  // All hashes should match too
  for (const [path, hash] of manifestBefore.entries()) {
    assert.equal(manifestAfter.get(path), hash, `hash for ${path} should be unchanged`);
  }
});

// ========== Contract Row 5 ==========
// Integration: given a project inited with --tool claude whose
// .claude/commands/sdlc/new.md has been deleted, when init --tool kimi runs,
// then that entry is still in the manifest, and a later update writes the file back
test('init-manifest-carryover: row 5 - deleted file entry survives and is restored by update', (t) => {
  const dir = makeTempProject(t);

  // First init with claude
  const res1 = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res1.status, 0, `first init failed: ${res1.stderr}`);

  // Delete a claude file
  const deletedFile = '.claude/commands/sdlc/new.md';
  const deletedPath = path.join(dir, deletedFile);
  assert.ok(fs.existsSync(deletedPath), `precondition: ${deletedFile} should exist after init`);
  fs.rmSync(deletedPath);
  assert.ok(!fs.existsSync(deletedPath), `precondition: ${deletedFile} should be deleted`);

  // Second init with kimi
  const res2 = runCli(dir, ['init', '--tool', 'kimi']);
  assert.equal(res2.status, 0, `second init failed: ${res2.stderr}`);

  // The entry should still be in the manifest
  const manifestPath = path.join(dir, 'sdlc', '.state', 'manifest');
  const manifest = parseManifest(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(manifest.has(deletedFile), `${deletedFile} entry should survive in manifest even though file is deleted`);

  // Now run update, which should restore the file from the payload
  const updateRes = runCli(dir, ['update']);
  assert.equal(updateRes.status, 0, `update failed: ${updateRes.stderr}`);

  // File should be restored
  assert.ok(fs.existsSync(deletedPath), `${deletedFile} should be restored by update`);
});

// ========== Contract Row 6 ==========
// Integration: given a project inited with --tool claude,kimi,
// when update --tool claude runs, then kimi's entry is dropped and its file pruned.
// This is a regression guard — the fix for carryover must NOT affect update's wholesale replace.
test('init-manifest-carryover: row 6 - update --tool prunes deselected tools (regression guard)', (t) => {
  const dir = makeTempProject(t);

  // Init with both tools
  const res1 = runCli(dir, ['init', '--tool', 'claude,kimi']);
  assert.equal(res1.status, 0, `init failed: ${res1.stderr}`);

  const manifestPath = path.join(dir, 'sdlc', '.state', 'manifest');
  const manifest1 = parseManifest(fs.readFileSync(manifestPath, 'utf8'));

  // Both tools should be in manifest
  assert.ok([...manifest1.keys()].some(p => p.startsWith('.claude/')), 'precondition: claude files in manifest');
  assert.ok(manifest1.has('.kimi-code/AGENTS.md'), 'precondition: kimi file in manifest');

  // Run update --tool claude (deselecting kimi)
  const res2 = runCli(dir, ['update', '--tool', 'claude']);
  assert.equal(res2.status, 0, `update --tool claude failed: ${res2.stderr}`);

  // Kimi's entry should be gone from manifest
  const manifest2 = parseManifest(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(!manifest2.has('.kimi-code/AGENTS.md'), '.kimi-code/AGENTS.md should be removed from manifest by update --tool');

  // Kimi's file should be pruned
  const kimiPath = path.join(dir, '.kimi-code', 'AGENTS.md');
  assert.ok(!fs.existsSync(kimiPath), '.kimi-code/AGENTS.md file should be pruned');

  // Claude entries should still be there
  const claudeEntries2 = [...manifest2.keys()].filter(p => p.startsWith('.claude/'));
  assert.ok(claudeEntries2.length > 0, 'claude files should still be in manifest');
});

// ========== Contract Row 7 (added during review) ==========
// Integration: the path this fix genuinely widens. Row 6 installs both tools in ONE init, so it
// passed before the fix too. Here the second tool arrives by a SEPARATE init — pre-fix that
// disowned claude, so a later deselect pruned nothing and left orphans nothing could refresh or
// remove. Owning them again is the other half of ownership: refresh and prune come together.
test('init-manifest-carryover: row 7 - a tool owned via a second init is prunable when later deselected', (t) => {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'claude']).status, 0);
  assert.equal(runCli(dir, ['init', '--tool', 'kimi']).status, 0);

  const manifestPath = path.join(dir, 'sdlc', '.state', 'manifest');
  const claudeBefore = [...parseManifest(fs.readFileSync(manifestPath, 'utf8')).keys()]
    .filter((p) => p.startsWith('.claude/'));
  assert.ok(claudeBefore.length > 0, 'precondition: claude is owned after the second init');
  assert.ok(claudeBefore.length < 50, 'precondition: under the prune blast cap, so no --force is needed');

  const res = runCli(dir, ['update', '--tool', 'kimi']);
  assert.equal(res.status, 0, `update --tool kimi failed: ${res.stderr}`);

  const after = parseManifest(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal([...after.keys()].filter((p) => p.startsWith('.claude/')).length, 0,
    'deselecting claude drops its entries');
  for (const rel of claudeBefore) {
    assert.ok(!fs.existsSync(path.join(dir, rel)), `pruned from disk too: ${rel}`);
  }
  assert.ok(after.has('.kimi-code/AGENTS.md'), 'the still-selected tool is untouched');
  assert.ok(fs.existsSync(path.join(dir, '.kimi-code', 'AGENTS.md')));
});

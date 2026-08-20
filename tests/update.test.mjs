import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { makeTempProject, runCli } from './helpers.mjs';
import { parseManifest, computeStale, isSafeRelPath, isPrunablePath } from '../lib/manifest.mjs';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

test('update: refreshes payload files we own, keeps user-modified ones', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);

  const ours = path.join(dir, 'sdlc/.playbook/new.md');
  const original = fs.readFileSync(ours, 'utf8');
  fs.writeFileSync(ours, original + '\nSTALE PAYLOAD DRIFT\n'); // simulate old-version payload
  // put the old hash into the manifest so it counts as "ours, unmodified"
  const manifestPath = path.join(dir, 'sdlc/.state/manifest');
  const manifest = parseManifest(fs.readFileSync(manifestPath, 'utf8'));
  manifest.set('sdlc/.playbook/new.md', sha(original + '\nSTALE PAYLOAD DRIFT\n'));
  fs.writeFileSync(manifestPath, [...manifest.entries()].map(([p, h]) => `${h}  ${p}`).join('\n') + '\n');

  const userFile = path.join(dir, 'sdlc/.playbook/principles.md');
  fs.writeFileSync(userFile, '# my own principles\n'); // user-modified (hash won't match manifest)

  const res = runCli(dir, ['update']);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(fs.readFileSync(ours, 'utf8').includes('STALE PAYLOAD DRIFT'), false, 'ours refreshed');
  assert.equal(fs.readFileSync(userFile, 'utf8'), '# my own principles\n', 'user file kept');
  assert.match(res.stderr + res.stdout, /kept \(user-modified\): sdlc\/\.playbook\/principles\.md/);
});

test('update: prunes stale payload files (in manifest, gone from payload) with hash guard', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);

  // Simulate a file the previous version shipped but the new payload dropped.
  const staleRel = 'sdlc/.playbook/legacy-stage.md';
  const staleAbs = path.join(dir, staleRel);
  fs.writeFileSync(staleAbs, '# legacy\n');
  const manifestPath = path.join(dir, 'sdlc/.state/manifest');
  fs.appendFileSync(manifestPath, `${sha('# legacy\n')}  ${staleRel}\n`);

  // And one the user modified since — must survive.
  const modRel = 'sdlc/.playbook/legacy-modified.md';
  fs.writeFileSync(path.join(dir, modRel), '# modified by user\n');
  fs.appendFileSync(manifestPath, `${'0'.repeat(64)}  ${modRel}\n`);

  const res = runCli(dir, ['update']);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(!fs.existsSync(staleAbs), 'stale unmodified payload file pruned');
  assert.ok(fs.existsSync(path.join(dir, modRel)), 'modified file kept');
  assert.match(res.stderr, /prune kept \(modified\)/);
  assert.match(res.stdout, /pruned: 1/);
});

test('manifest guards: traversal, absolute, control chars, out-of-scope', () => {
  assert.equal(isSafeRelPath('../evil'), false);
  assert.equal(isSafeRelPath('/abs/path'), false);
  assert.equal(isSafeRelPath('C:/win'), false);
  assert.equal(isSafeRelPath('a/../b'), false);
  assert.equal(isSafeRelPath('sdlc/.playbook/x.md'), true);

  assert.equal(isPrunablePath('sdlc/specs/auth/spec.md'), false, 'living specs never prunable');
  assert.equal(isPrunablePath('sdlc/changes/x/change.md'), false);
  assert.equal(isPrunablePath('.claude/agents/other-agent.md'), false);
  assert.equal(isPrunablePath('.claude/agents/sdlc-builder.md'), true);
  assert.equal(isPrunablePath('.claude/skills/delta-spec-format/SKILL.md'), true);
  assert.equal(isPrunablePath('.claude/skills/users-own-skill/SKILL.md'), false);

  const old = new Map([
    ['sdlc/.playbook/a.md', 'x'.repeat(64)],
    ['sdlc/specs/auth/spec.md', 'y'.repeat(64)],
  ]);
  const { stale, rejected } = computeStale(old, new Set());
  assert.equal(stale.length, 1);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0].reason, /scope/);
});

test('multi-tool init: cursor + windsurf files, marker adapters idempotent', (t) => {
  const dir = makeTempProject(t);
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Existing agents file\n');
  const res = runCli(dir, ['init', '--tool', 'claude,cursor,windsurf,agents-md,gemini']);
  assert.equal(res.status, 0, res.stderr);

  const cursor = fs.readFileSync(path.join(dir, '.cursor/rules/sdlc.mdc'), 'utf8');
  assert.match(cursor, /alwaysApply: true/);
  assert.match(cursor, /sdlc rules card/);
  assert.ok(!cursor.includes('{{RULES_CARD}}'), 'placeholder substituted');
  assert.ok(fs.existsSync(path.join(dir, '.windsurf/rules/sdlc.md')));

  const agentsMd = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  assert.match(agentsMd, /^# Existing agents file/, 'user content preserved');
  assert.match(agentsMd, /<!-- sdlc:start -->/);

  // Idempotent: second init must not duplicate the marker block.
  runCli(dir, ['init', '--tool', 'agents-md']);
  const again = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  assert.equal(again.match(/<!-- sdlc:start -->/g).length, 1);

  assert.ok(fs.existsSync(path.join(dir, 'GEMINI.md')));
});

test('update: reads tools from config.yaml', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude,cursor']);
  fs.rmSync(path.join(dir, '.cursor'), { recursive: true });
  const res = runCli(dir, ['update']);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(path.join(dir, '.cursor/rules/sdlc.mdc')), 'cursor adapter reinstalled from config tools');
});

// `npm run setup:dogfood` and any "re-run init to upgrade" habit is init-then-update.
// A keep used to drop the file's manifest entry, which disarmed update's refresh
// branch (`disk hash === old manifest hash`) permanently — the file froze at the
// old payload version and every later update called it user-modified.
test('init before update: a keep must not cost the file its ownership record', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);

  const rel = 'sdlc/.playbook/new.md';
  const abs = path.join(dir, rel);
  const stale = fs.readFileSync(abs, 'utf8') + '\nSTALE PAYLOAD DRIFT\n';
  fs.writeFileSync(abs, stale);
  const manifestPath = path.join(dir, 'sdlc/.state/manifest');
  const manifest = parseManifest(fs.readFileSync(manifestPath, 'utf8'));
  manifest.set(rel, sha(stale)); // ours, unmodified — just an older payload version
  fs.writeFileSync(manifestPath, [...manifest.entries()].map(([p, h]) => `${h}  ${p}`).join('\n') + '\n');

  const initRes = runCli(dir, ['init', '--tool', 'claude']);
  const afterInit = parseManifest(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(afterInit.has(rel), 'init must carry the entry forward when it keeps a file');
  assert.ok(initRes.stderr.includes(`kept (ours, older version`),
    'a file matching its recorded hash was not edited by anyone — do not say it was');
  assert.ok(!initRes.stderr.includes(`kept (user-modified): ${rel}`), initRes.stderr);

  const res = runCli(dir, ['update']);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(!fs.readFileSync(abs, 'utf8').includes('STALE PAYLOAD DRIFT'), 'update must still refresh it');
});

test('a kept user-modified file stays owned, so prune never even considers it stale', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);

  const rel = 'sdlc/.playbook/principles.md';
  fs.writeFileSync(path.join(dir, rel), '# my own principles\n');
  const res = runCli(dir, ['update']);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(res.stderr.includes(`kept (user-modified): ${rel}`), res.stderr);

  const manifest = parseManifest(fs.readFileSync(path.join(dir, 'sdlc/.state/manifest'), 'utf8'));
  assert.ok(manifest.has(rel), 'the file is still ours; only its content is theirs');
  const { stale } = computeStale(manifest, new Set(manifest.keys()));
  assert.deepEqual(stale, [], 'a kept file must never be a prune candidate');
  assert.equal(fs.readFileSync(path.join(dir, rel), 'utf8'), '# my own principles\n');
});

test('a file that was never ours is not adopted into the manifest by a keep', (t) => {
  const dir = makeTempProject(t);
  // The user's own cursor rules file, written before sdlc ever ran here.
  fs.mkdirSync(path.join(dir, '.cursor/rules'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.cursor/rules/sdlc.mdc'), '# mine, predating sdlc\n');

  runCli(dir, ['init', '--tool', 'cursor']);
  const manifest = parseManifest(fs.readFileSync(path.join(dir, 'sdlc/.state/manifest'), 'utf8'));
  assert.ok(!manifest.has('.cursor/rules/sdlc.mdc'), 'never installed by us, never claimed');
  assert.equal(fs.readFileSync(path.join(dir, '.cursor/rules/sdlc.mdc'), 'utf8'), '# mine, predating sdlc\n');
});

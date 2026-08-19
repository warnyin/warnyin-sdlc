import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mergeHookSettings, removeHookSettings, sdlcHookEntries } from '../lib/settings-merge.mjs';
import { makeTempProject, runCli } from './helpers.mjs';

test('mergeHookSettings: adds all sdlc hooks and is idempotent', () => {
  const once = mergeHookSettings({});
  const twice = mergeHookSettings(once);
  assert.deepEqual(twice, once);
  for (const event of Object.keys(sdlcHookEntries())) {
    assert.ok(twice.hooks[event]?.length, `missing ${event}`);
  }
});

test('mergeHookSettings: preserves user hooks and unrelated settings; does not mutate input', () => {
  const userSettings = {
    permissions: { allow: ['Bash(ls:*)'] },
    hooks: {
      PreToolUse: [
        { matcher: 'Bash', hooks: [{ type: 'command', command: 'my-own-guard.sh' }] },
      ],
    },
  };
  const frozen = JSON.parse(JSON.stringify(userSettings));
  const merged = mergeHookSettings(userSettings);
  assert.deepEqual(userSettings, frozen, 'input must not be mutated');
  assert.deepEqual(merged.permissions, userSettings.permissions);
  const pre = merged.hooks.PreToolUse;
  assert.ok(pre.some((e) => e.hooks[0].command === 'my-own-guard.sh'), 'user hook kept');
  assert.ok(pre.some((e) => e.hooks[0].command.includes('sdlc/.hooks/')), 'our hook added');
});

test('removeHookSettings: strips only our entries', () => {
  const merged = mergeHookSettings({
    hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'mine.sh' }] }] },
  });
  const removed = removeHookSettings(merged);
  assert.equal(removed.hooks.PreToolUse.length, 1);
  assert.equal(removed.hooks.PreToolUse[0].hooks[0].command, 'mine.sh');
  assert.ok(!removed.hooks.SessionStart);
});

test('init: writes hooks into .claude/settings.json without touching user keys', (t) => {
  const dir = makeTempProject(t);
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude/settings.json'),
    JSON.stringify({ model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'mine.sh' }] }] } }));
  const res = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res.status, 0, res.stderr);
  const settings = JSON.parse(fs.readFileSync(path.join(dir, '.claude/settings.json'), 'utf8'));
  assert.equal(settings.model, 'opus');
  assert.equal(settings.hooks.Stop.length, 2);
  assert.ok(settings.hooks.SessionStart[0].hooks[0].command.includes('inject-context.mjs'));
});

test('init: aborts on corrupt settings.json instead of destroying it', (t) => {
  const dir = makeTempProject(t);
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude/settings.json'), '{ not json');
  const res = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /not valid JSON/);
  assert.equal(fs.readFileSync(path.join(dir, '.claude/settings.json'), 'utf8'), '{ not json');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli } from './helpers.mjs';
import { detectTools, ADAPTER_PATHS } from '../bin/detect.mjs';
import { colorEnabled, createStyle, summarizeInstall, startHints } from '../bin/ui.mjs';
import { initState, visibleChoices, reduceKey, renderLines } from '../bin/multiselect.mjs';

const ALL_TOOLS = ['claude', 'cursor', 'windsurf', 'copilot', 'cline', 'gemini', 'agents-md'];
const ANSI = new RegExp(String.fromCharCode(27) + '\\[');

// ---------- tool detection ----------

test('detectTools: finds tools already present in the project', (t) => {
  const dir = makeTempProject(t);
  fs.mkdirSync(path.join(dir, '.cursor'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.github'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.github', 'copilot-instructions.md'), '# hi\n');
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# agents\n');

  assert.deepEqual(detectTools(dir).sort(), ['agents-md', 'copilot', 'cursor']);
});

test('detectTools: empty project detects nothing', (t) => {
  assert.deepEqual(detectTools(makeTempProject(t)), []);
});

test('ADAPTER_PATHS: every supported tool has a user-visible install path', () => {
  for (const tool of ALL_TOOLS) assert.ok(ADAPTER_PATHS[tool], `no adapter path for ${tool}`);
});

// ---------- color gating ----------

test('colorEnabled: honours NO_COLOR, FORCE_COLOR and TTY', () => {
  assert.equal(colorEnabled({}, true), true);
  assert.equal(colorEnabled({}, false), false, 'non-TTY must stay plain');
  assert.equal(colorEnabled({ NO_COLOR: '1' }, true), false);
  assert.equal(colorEnabled({ FORCE_COLOR: '1' }, false), true);
  assert.equal(colorEnabled({ NO_COLOR: '1', FORCE_COLOR: '1' }, true), false, 'NO_COLOR wins');
});

test('createStyle: disabled style is the identity function', () => {
  const plain = createStyle(false);
  assert.equal(plain.bold('x'), 'x');
  assert.equal(plain.green('x'), 'x');
  assert.match(createStyle(true).green('x'), ANSI);
});

// ---------- summary ----------

test('summarizeInstall: counts payload artifacts by kind', () => {
  const keys = [
    '.claude/commands/sdlc/new.md',
    '.claude/commands/sdlc/ship.md',
    '.claude/skills/delta-spec-format/SKILL.md',
    '.claude/agents/sdlc-builder.md',
    'sdlc/.hooks/guard-writes.mjs',
    'sdlc/.hooks/lib/caps.mjs',
    'sdlc/.playbook/new.md',
    'sdlc/.playbook/templates/change-deep.md',
    '.cursor/rules/sdlc.mdc',
  ];
  const s = summarizeInstall(keys, ['claude', 'cursor']);
  assert.equal(s.commands, 2);
  assert.equal(s.skills, 1);
  assert.equal(s.agents, 1);
  assert.equal(s.hooks, 1, 'hook lib/ must not inflate the hook count');
  assert.equal(s.playbook, 1);
  assert.equal(s.templates, 1);
  assert.deepEqual(s.adapters, [
    { tool: 'claude', path: '.claude/' },
    { tool: 'cursor', path: '.cursor/rules/sdlc.mdc' },
  ]);
});

test('startHints: gives a per-tool first command', () => {
  const claude = startHints(['claude']).join('\n');
  assert.match(claude, /\/sdlc:init/);
  assert.match(claude, /\/sdlc:new/);
  const cursor = startHints(['cursor']).join('\n');
  assert.doesNotMatch(cursor, /\/sdlc:init/, 'cursor has no slash commands');
  assert.match(cursor, /sdlc/);
  assert.ok(startHints([]).length > 0, 'tool-less install still needs a next step');
});

// ---------- multi-select prompt (pure reducer) ----------

const CHOICES = [
  { value: 'claude', name: 'Claude Code', preSelected: true },
  { value: 'cursor', name: 'Cursor' },
  { value: 'windsurf', name: 'Windsurf' },
];

test('multiselect: pre-selects detected tools', () => {
  assert.deepEqual(initState(CHOICES).selected, ['claude']);
});

test('multiselect: arrows move the cursor and wrap', () => {
  let s = initState(CHOICES);
  s = reduceKey(s, { name: 'down' });
  assert.equal(s.cursor, 1);
  s = reduceKey(reduceKey(s, { name: 'down' }), { name: 'down' });
  assert.equal(s.cursor, 0, 'wraps past the end');
  s = reduceKey(s, { name: 'up' });
  assert.equal(s.cursor, 2, 'wraps before the start');
});

test('multiselect: space toggles, and never mutates the previous state', () => {
  const before = initState(CHOICES);
  const after = reduceKey(reduceKey(before, { name: 'down' }), { name: 'space' });
  assert.deepEqual(after.selected, ['claude', 'cursor']);
  assert.deepEqual(before.selected, ['claude'], 'reducer must be immutable');
  const off = reduceKey(after, { name: 'space' });
  assert.deepEqual(off.selected, ['claude']);
});

test('multiselect: typing filters the list and ctrl+a toggles the visible set', () => {
  let s = reduceKey(initState(CHOICES), { name: 'w', sequence: 'w' });
  assert.equal(s.filter, 'w');
  assert.deepEqual(visibleChoices(s).map((c) => c.value), ['windsurf']);
  assert.equal(s.cursor, 0, 'filtering resets the cursor');

  s = reduceKey(s, { name: 'a', ctrl: true });
  assert.deepEqual(s.selected, ['claude', 'windsurf'], 'ctrl+a selects only what is visible');
  s = reduceKey(s, { name: 'a', ctrl: true });
  assert.deepEqual(s.selected, ['claude'], 'ctrl+a again clears the visible set');

  s = reduceKey(s, { name: 'backspace' });
  assert.equal(s.filter, '');
  assert.equal(visibleChoices(s).length, 3);
});

test('multiselect: enter requires at least one tool, ctrl+c cancels', () => {
  let s = reduceKey(initState(CHOICES), { name: 'space' });
  assert.deepEqual(s.selected, []);
  s = reduceKey(s, { name: 'return' });
  assert.equal(s.status, 'idle');
  assert.match(s.error, /at least one/i);

  s = reduceKey(s, { name: 'space' });
  assert.equal(s.error, null, 'the error clears once the input is valid again');
  s = reduceKey(s, { name: 'return' });
  assert.equal(s.status, 'done');

  assert.equal(reduceKey(initState(CHOICES), { name: 'c', ctrl: true }).status, 'cancelled');
});

test('multiselect: renders the cursor, checkboxes and a key hint', () => {
  const lines = renderLines(reduceKey(initState(CHOICES), { name: 'down' }), createStyle(false));
  const text = lines.join('\n');
  assert.match(text, /Claude Code/);
  assert.match(lines[1], /^ {2}\S/, 'unfocused rows are not pointed at');
  assert.match(text, /space/i);
  assert.match(text, /enter/i);
  assert.doesNotMatch(text, ANSI, 'plain style emits no escapes');
});

// ---------- CLI surface ----------

test('init --tool all: installs every adapter and records them', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'all']);
  assert.equal(res.status, 0, res.stderr);

  for (const rel of [
    '.claude/settings.json',
    '.cursor/rules/sdlc.mdc',
    '.windsurf/rules/sdlc.md',
    '.github/copilot-instructions.md',
    '.clinerules',
    'GEMINI.md',
    'AGENTS.md',
  ]) {
    assert.ok(fs.existsSync(path.join(dir, rel)), `missing ${rel}`);
  }
  const config = fs.readFileSync(path.join(dir, 'sdlc/config.yaml'), 'utf8');
  for (const tool of ALL_TOOLS) assert.match(config, new RegExp(tool));
});

test('init --tool none: scaffolds sdlc/ without touching any agent tool', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'none']);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'sdlc/.playbook')));
  assert.ok(!fs.existsSync(path.join(dir, '.claude')), 'no adapter should be installed');
  assert.match(fs.readFileSync(path.join(dir, 'sdlc/config.yaml'), 'utf8'), /tools: \[\]/);
});

test('init: --tools is accepted as an alias for --tool', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tools', 'cursor']);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(path.join(dir, '.cursor/rules/sdlc.mdc')));
});

test('init: non-interactive without --tool still defaults to claude', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(fs.readFileSync(path.join(dir, 'sdlc/config.yaml'), 'utf8'), /tools: \[claude\]/);
});

test('init: prints a summary with counts and per-tool next steps', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'claude']);
  assert.match(res.stdout, /Setup Complete/i);
  assert.match(res.stdout, /commands/i);
  assert.match(res.stdout, /skills/i);
  assert.match(res.stdout, /sdlc\/\.playbook/);
  assert.match(res.stdout, /Getting started/i);
  assert.match(res.stdout, /\/sdlc:init/);
});

test('init: re-running reports refreshed state instead of claiming a fresh install', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const res = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /unchanged/i);
});

test('init: emits no ANSI escapes when stdout is not a TTY', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'claude']);
  assert.doesNotMatch(res.stdout, ANSI);
});

test('update: an explicit "tools: []" is honoured, not treated as an unset default', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'none']);
  const res = runCli(dir, ['update']);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(!fs.existsSync(path.join(dir, '.claude')), 'update must not resurrect an unwanted tool');
});

test('update: a config predating the tools key still falls back to claude', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const configPath = path.join(dir, 'sdlc/config.yaml');
  const stripped = fs.readFileSync(configPath, 'utf8').split(/\r?\n/).filter((l) => !l.startsWith('tools:')).join('\n');
  fs.writeFileSync(configPath, stripped);
  const res = runCli(dir, ['update']);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(path.join(dir, '.claude/commands/sdlc/new.md')));
});

test('init: rejects "all" combined with a named tool', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'all,cursor']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /cannot be combined/);
});

test('init: --tool with no value fails instead of silently installing nothing', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /requires a value/);
});

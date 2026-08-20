import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, PKG_ROOT } from './helpers.mjs';

const COMMANDS = ['init', 'auto', 'new', 'design', 'contract', 'build', 'verify',
  'review', 'ship', 'observe', 'converge', 'steer', 'next'];
const SKILLS = ['delta-spec-format', 'contract-writing', 'sdlc-conventions'];
const AGENTS = ['sdlc-architect', 'sdlc-security', 'sdlc-quality', 'sdlc-ops',
  'sdlc-contractor', 'sdlc-evaluator', 'sdlc-builder', 'sdlc-learner'];
const HOOKS = ['_shared.mjs', 'journal.mjs', 'inject-context.mjs', 'guard-writes.mjs',
  'validate-artifact.mjs', 'session-summary.mjs'];

test('init installs the full claude adapter: commands, skills, agents, playbook, hooks', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res.status, 0, res.stderr);

  for (const c of COMMANDS) {
    assert.ok(fs.existsSync(path.join(dir, `.claude/commands/sdlc/${c}.md`)), `command ${c}`);
  }
  for (const s of SKILLS) {
    assert.ok(fs.existsSync(path.join(dir, `.claude/skills/${s}/SKILL.md`)), `skill ${s}`);
  }
  for (const a of AGENTS) {
    assert.ok(fs.existsSync(path.join(dir, `.claude/agents/${a}.md`)), `agent ${a}`);
  }
  for (const h of HOOKS) {
    assert.ok(fs.existsSync(path.join(dir, `sdlc/.hooks/${h}`)), `hook ${h}`);
  }
  assert.ok(fs.existsSync(path.join(dir, 'sdlc/.hooks/lib/validate.mjs')), 'hook lib mirror');
});

test('every command stub points at a playbook file that exists in the payload', () => {
  const cmdDir = path.join(PKG_ROOT, 'payload/adapters/claude/commands/sdlc');
  for (const f of fs.readdirSync(cmdDir)) {
    const text = fs.readFileSync(path.join(cmdDir, f), 'utf8');
    const m = text.match(/sdlc\/\.playbook\/([a-z-]+\.md)/);
    assert.ok(m, `${f}: no playbook reference`);
    assert.ok(fs.existsSync(path.join(PKG_ROOT, 'payload/playbook', m[1])),
      `${f} references missing playbook ${m[1]}`);
  }
});

test('every playbook stage named in README exists, and command stubs stay thin (≤15 body lines)', () => {
  const playbookDir = path.join(PKG_ROOT, 'payload/playbook');
  const readme = fs.readFileSync(path.join(playbookDir, 'README.md'), 'utf8');
  for (const m of readme.matchAll(/\/sdlc:([a-z]+)/g)) {
    assert.ok(fs.existsSync(path.join(playbookDir, `${m[1]}.md`)), `playbook ${m[1]}.md missing`);
  }
  const cmdDir = path.join(PKG_ROOT, 'payload/adapters/claude/commands/sdlc');
  for (const f of fs.readdirSync(cmdDir)) {
    const body = fs.readFileSync(path.join(cmdDir, f), 'utf8').split('---').slice(2).join('---');
    const lines = body.split('\n').filter((l) => l.trim()).length;
    assert.ok(lines <= 15, `${f}: command body has ${lines} lines (thin-adapter rule: ≤15)`);
  }
});

test('agents declare model + tools frontmatter; reviewers are read-only', () => {
  const agentsDir = path.join(PKG_ROOT, 'payload/adapters/claude/agents');
  const readOnly = ['sdlc-architect', 'sdlc-security', 'sdlc-quality', 'sdlc-ops',
    'sdlc-evaluator', 'sdlc-learner'];
  for (const f of fs.readdirSync(agentsDir)) {
    const text = fs.readFileSync(path.join(agentsDir, f), 'utf8');
    assert.match(text, /^model: (haiku|sonnet|opus)$/m, `${f}: model`);
    assert.match(text, /^tools: /m, `${f}: tools`);
    const name = f.replace('.md', '');
    if (readOnly.includes(name)) {
      assert.ok(!/tools: .*(Write|Edit|Bash)/.test(text), `${f} must be read-only`);
    }
  }
});

test('auto resumes from live state and defers the status mapping to next.md', () => {
  const playbookDir = path.join(PKG_ROOT, 'payload/playbook');
  const auto = fs.readFileSync(path.join(playbookDir, 'auto.md'), 'utf8');
  const next = fs.readFileSync(path.join(playbookDir, 'next.md'), 'utf8');

  // auto must consult live state before assuming a change has to be opened.
  assert.match(auto, /sdlc status/, 'auto must read status before choosing an entry stage');
  assert.match(auto, /RESUME/, 'auto must name the resume path explicitly');
  assert.match(auto, /never rewrites an existing `change\.md`/,
    'a resumed change keeps the tier and Delta it was triaged with');

  // Single source of truth: the status -> stage table lives in next.md only.
  assert.match(auto, /`next\.md` §2/, 'auto must defer to next.md for the mapping');
  assert.ok(/^2\. For each active change map status/m.test(next),
    'next.md §2 must still be the status -> command mapping auto points at');
  assert.doesNotMatch(auto, /`contracted` →/, 'the mapping must not be duplicated into auto.md');
});

test('the auto command stub advertises that it takes a change id too', () => {
  const stub = fs.readFileSync(
    path.join(PKG_ROOT, 'payload/adapters/claude/commands/sdlc/auto.md'), 'utf8');
  assert.match(stub, /argument-hint: "<title\|change-id>"/);
});

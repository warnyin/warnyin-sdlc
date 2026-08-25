import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, PKG_ROOT } from './helpers.mjs';

const CMD_REL = '.claude/commands/sdlc/feedback.md';
const PLAYBOOK_REL = 'sdlc/.playbook/feedback.md';
const PLAYBOOK_SRC = path.join(PKG_ROOT, 'payload/playbook/feedback.md');
const STUB_SRC = path.join(PKG_ROOT, 'payload/adapters/claude/commands/sdlc/feedback.md');

const playbook = () => fs.readFileSync(PLAYBOOK_SRC, 'utf8');

// row 1
test('feedback: init installs the command and its playbook', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(path.join(dir, CMD_REL)), 'command stub');
  assert.ok(fs.existsSync(path.join(dir, PLAYBOOK_REL)), 'playbook');
});

// row 2
test('feedback: update adds it to a project installed before this change', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  // simulate a pre-feedback install: drop both files and their manifest entries
  fs.rmSync(path.join(dir, CMD_REL));
  fs.rmSync(path.join(dir, PLAYBOOK_REL));
  const manifestPath = path.join(dir, 'sdlc/.state/manifest');
  fs.writeFileSync(manifestPath, fs.readFileSync(manifestPath, 'utf8')
    .split('\n').filter((l) => !l.endsWith('feedback.md')).join('\n'));
  const mine = '# Constitution — mine\n- my rule\n';
  fs.writeFileSync(path.join(dir, 'sdlc/context/constitution.md'), mine);

  const res = runCli(dir, ['update']);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(path.join(dir, CMD_REL)), 'command stub after update');
  assert.ok(fs.existsSync(path.join(dir, PLAYBOOK_REL)), 'playbook after update');
  assert.equal(fs.readFileSync(path.join(dir, 'sdlc/context/constitution.md'), 'utf8'), mine);
});

// row 3
test('feedback: the stub stays thin and points at a playbook that ships', () => {
  const stub = fs.readFileSync(STUB_SRC, 'utf8');
  const body = stub.split('---').slice(2).join('---');
  assert.ok(body.split('\n').filter((l) => l.trim()).length <= 15, 'stub body ≤15 lines');
  const m = stub.match(/sdlc\/\.playbook\/([a-z-]+\.md)/);
  assert.ok(m, 'stub references a playbook');
  assert.ok(fs.existsSync(path.join(PKG_ROOT, 'payload/playbook', m[1])), 'playbook exists');
});

// row 4
test('feedback: the playbook names every context field it must collect', () => {
  const t = playbook();
  for (const re of [/version/i, /node/i, /\bOS\b|operating system/i, /tool|adapter/i,
    /change id|active change/i, /status|stage/i]) {
    assert.match(t, re, `context field ${re}`);
  }
});

// row 5
test('feedback: an unreadable context field degrades to unknown, never a failure', () => {
  assert.match(playbook(), /unknown/i);
  assert.match(playbook(), /(continue|proceed|never abort|do not abort)/i);
});

// row 6
test('feedback: file contents that may hold private data are never copied in', () => {
  const t = playbook();
  for (const re of [/constitution/i, /steering/i, /\.env/i, /credential|secret/i]) {
    assert.match(t, re, `must name ${re} as off-limits`);
  }
  assert.match(t, /never (copy|include|paste)|do not (copy|include|paste)/i);
});

// row 7
test('feedback: paths are relativised and secret-shaped strings are placeheld out loud', () => {
  const t = playbook();
  assert.match(t, /absolute path/i);
  assert.match(t, /relative/i);
  assert.match(t, /<redacted>/);
  assert.match(t, /tell|say|report|inform/i, 'the human is told what was removed');
});

// row 8
test('feedback: redact -> show -> send is an ordered, unskippable sequence', () => {
  const t = playbook();
  const iRedact = t.search(/redact/i);
  const iShow = t.search(/show (the )?(full )?draft|display the (full )?draft/i);
  const iSend = t.search(/gh issue create/);
  assert.ok(iRedact > -1 && iShow > -1 && iSend > -1, 'all three steps present');
  assert.ok(iRedact < iShow && iShow < iSend, 'stated in order');
  assert.match(t, /no (network|request|call).*(before|until)|never .*(before|until) .*approv/i);
});

// row 9
test('feedback: anything other than approval revises and re-asks', () => {
  const t = playbook();
  assert.match(t, /approv/i);
  assert.match(t, /(revise|edit|amend).*(ask again|re-ask|ask)/i);
});

// row 10
test('feedback: the body travels over stdin, never as an inline shell argument', () => {
  const t = playbook();
  assert.match(t, /--body-file -/);
  assert.match(t, /stdin/i);
  assert.match(t, /never .*--body\b|not .*inline/i);
});

// row 11
test('feedback: the destination repo is pinned and the host is checked', () => {
  const t = playbook();
  assert.match(t, /--repo warnyin\/warnyin-sdlc/);
  assert.match(t, /github\.com/);
  assert.match(t, /gh auth status/);
});

// row 12
test('feedback: a missing or logged-out gh is a normal branch with a usable URL', () => {
  const t = playbook();
  assert.match(t, /issues\/new\?/);
  assert.match(t, /(not an error|normal|fine|expected)/i);
});

// row 13
test('feedback: the repo issue forms ask for the same environment fields', () => {
  const dir = path.join(PKG_ROOT, '.github/ISSUE_TEMPLATE');
  const bug = fs.readFileSync(path.join(dir, 'bug.yml'), 'utf8');
  const feature = fs.readFileSync(path.join(dir, 'feature.yml'), 'utf8');
  for (const re of [/version/i, /node/i, /\bOS\b|operating system/i, /tool|adapter/i, /stage|change/i]) {
    assert.match(bug, re, `bug form field ${re}`);
  }
  assert.match(feature, /version/i, 'feature form asks for version too');
  assert.ok(fs.existsSync(path.join(dir, 'config.yml')), 'config.yml');
});

// row 16
test('feedback: the payload ships and .github never enters the package', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.files.includes('payload'), 'payload ships');
  assert.ok(!pkg.files.some((f) => f.startsWith('.github')), '.github must not ship');
  assert.ok(fs.existsSync(PLAYBOOK_SRC) && fs.existsSync(STUB_SRC), 'payload files exist');
});

// row 17
test('feedback: an existing thread is offered before a duplicate is drafted', () => {
  const t = playbook();
  assert.match(t, /gh issue list/);
  assert.match(t, /(duplicate|already (been )?(reported|filed)|existing (issue|thread))/i);
});

// row 18
test('feedback: the fallback URL is encoded and capped', () => {
  const t = playbook();
  assert.match(t, /encode/i);
  assert.match(t, /(truncat|cap|too long|shorten)/i);
});

// row 19
test('feedback: the stage is discoverable from both READMEs', () => {
  const pbReadme = fs.readFileSync(path.join(PKG_ROOT, 'payload/playbook/README.md'), 'utf8');
  const repoReadme = fs.readFileSync(path.join(PKG_ROOT, 'README.md'), 'utf8');
  assert.match(pbReadme, /\/sdlc:feedback/);
  assert.match(repoReadme, /\/sdlc:feedback/);
});

// row 20 — the title reaches the shell as an argument, so it is human text on a command line
test('feedback: the title is authored under an allow-list, never pasted raw', () => {
  const t = playbook();
  assert.match(t, /title/i);
  assert.match(t, /80/);
  assert.match(t, /(never paste|not paste|write it yourself|author)/i);
});

// row 21 — the duplicate search takes human text onto a command line as well
test('feedback: duplicate-search keywords are agent-authored, not the raw sentence', () => {
  const t = playbook();
  assert.match(t, /gh issue list/);
  assert.match(t, /(choose|author|write).*keyword|keyword.*yourself/i);
  assert.match(t, /never the reporter's raw|not the reporter's|never .*raw sentence/i);
});

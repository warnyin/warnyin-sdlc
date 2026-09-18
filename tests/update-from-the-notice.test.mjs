// Contract rows for update-from-the-notice: sdlc/changes/update-from-the-notice/contract/tests.md.
// Black-box: a real install, the real CLI and the real SessionStart hook in mkdtemp dirs.
// Notice rows need no registry stub — a FRESH cache means `isCheckDue` is false, so the hook
// makes no request at all and still renders the line from what the cache holds.
// Doctrine rows assert on what payload/playbook/update.md REQUIRES, never on a source file
// merely containing a word. Changelog rows derive every expectation from the package's own
// CHANGELOG.md at run time, so a release cannot break them and no branch can skip an assertion.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { makeTempProject, runCli, PKG_ROOT } from './helpers.mjs';

const PKG_VERSION = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')).version;
const oneLine = (s) => s.replace(/\s+/g, ' ');
const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');

// ---------- payload doctrine ----------

const playbook = () => fs.readFileSync(path.join(PKG_ROOT, 'payload/playbook/update.md'), 'utf8');
const commandStub = () => fs.readFileSync(path.join(PKG_ROOT, 'payload/adapters/claude/commands/sdlc/update.md'), 'utf8');

// ---------- the package's own changelog ----------

// `## X.Y.Z` headings, in the order the file lists them. Rows derive versions from this and
// never hardcode one, so cutting a release does not turn this file red.
// Same heading rule as `parseChangelog`: a `\b` here would read `## 0.10.0-beta` as `0.10.0`
// and let the oracle disagree with the code it is checking.
function changelogVersions(text = fs.readFileSync(path.join(PKG_ROOT, 'CHANGELOG.md'), 'utf8')) {
  return [...text.matchAll(/^##\s+(\d+\.\d+\.\d+)\s*(?:\(|$)/gm)].map((m) => m[1]);
}

// ---------- project ----------

function project(t, { installed } = {}) {
  const dir = makeTempProject(t);
  const init = runCli(dir, ['init', '--tool', 'claude'], { env: { NO_UPDATE_NOTIFIER: '1' } });
  assert.equal(init.status, 0, init.stderr);
  if (installed !== undefined) {
    fs.writeFileSync(path.join(dir, 'sdlc/.hooks/version.json'), JSON.stringify({ version: installed }));
  }
  return dir;
}

// Every file under a directory as path -> sha-ish content, for byte-identical assertions.
function snapshot(root) {
  const out = new Map();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else out.set(path.relative(root, p), fs.readFileSync(p));
    }
  };
  if (fs.existsSync(root)) walk(root);
  return out;
}

function assertUnchanged(before, after, what) {
  assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort(), `${what}: file list changed`);
  for (const [rel, buf] of before) {
    assert.ok(after.get(rel).equals(buf), `${what}: ${rel} was rewritten`);
  }
}

// ---------- SessionStart with a fresh cache (no network, no stub) ----------

// Seeding is separate from running so a row can snapshot the tree AFTER the setup it chose
// and still catch the hook writing something of its own.
function seed(dir, { installed, latest }) {
  fs.writeFileSync(path.join(dir, 'sdlc/.hooks/version.json'), JSON.stringify({ version: installed }));
  fs.writeFileSync(
    path.join(dir, 'sdlc/.state/update-check.json'),
    JSON.stringify({ checkedAt: new Date().toISOString(), latest }),
  );
  return dir;
}

function runSessionStart(dir) {
  const env = { ...process.env };
  for (const k of ['CI', 'NO_UPDATE_NOTIFIER', 'CLAUDE_CODE_SESSION_ID']) delete env[k];
  // A registry URL that nothing listens on: if a request is ever attempted the row still
  // cannot silently reach the real npm.
  env.WARNYIN_SDLC_REGISTRY_URL = 'http://127.0.0.1:1';
  const res = spawnSync(process.execPath, [path.join(dir, 'sdlc/.hooks/inject-context.mjs')], {
    cwd: dir, encoding: 'utf8', env,
  });
  if (res.error) throw res.error;
  return res;
}

const firstLine = (res) => res.stdout.split(/\r?\n/)[0] ?? '';

describe('update-from-the-notice', () => {
  // ---------- A newer published version is announced at session start ----------

  it('row 1: the notice is one leading line naming both versions and the command, and writes nothing', (t) => {
    const dir = seed(project(t), { installed: '0.9.0', latest: '0.10.0' });
    const hooksBefore = snapshot(path.join(dir, 'sdlc/.hooks'));
    const manifestBefore = fs.readFileSync(path.join(dir, 'sdlc/.state/manifest'));

    const res = runSessionStart(dir);
    assert.equal(res.status, 0, res.stderr);

    const line = firstLine(res);
    assert.match(line, /0\.9\.0/, 'the installed version is not named');
    assert.match(line, /0\.10\.0/, 'the available version is not named');
    assert.match(line, /npx @warnyin\/sdlc@latest update/, 'the update command is not named');
    assert.equal(res.stdout.split(/\r?\n/).filter((l) => /0\.10\.0/.test(l)).length, 1,
      'the notice spans more than one line');

    assertUnchanged(hooksBefore, snapshot(path.join(dir, 'sdlc/.hooks')), 'sdlc/.hooks');
    assert.ok(fs.readFileSync(path.join(dir, 'sdlc/.state/manifest')).equals(manifestBefore),
      'the manifest changed while merely announcing an update');
  });

  it('row 2: the notice directs the agent to offer the decision, and no longer forbids acting', (t) => {
    const dir = project(t);
    const line = oneLine(firstLine(runSessionStart(seed(dir, { installed: '0.9.0', latest: '0.10.0' }))));

    assert.match(line, /offer|choice|choose|decide|ask/i, 'the line does not direct the agent to offer the decision');
    assert.doesNotMatch(line, /do not run it yourself|don't run it yourself/i,
      'the line still tells the agent not to run the command');
  });

  it('row 3: no notice when the project is current or ahead [regression]', (t) => {
    const dir = project(t);
    for (const latest of ['0.10.0', '0.9.0']) {
      const res = runSessionStart(seed(dir, { installed: '0.10.0', latest }));
      assert.equal(res.status, 0, res.stderr);
      assert.doesNotMatch(res.stdout, /is available/, `a notice appeared for latest=${latest}`);
    }
  });

  // ---------- The notice is answered by picking, not by retyping ----------

  it('row 4: the playbook requires three options, apply first and marked recommended', () => {
    const text = oneLine(playbook());
    assert.match(text, /\*\*apply now\*\*/i, 'no "apply now" option is labelled');
    assert.match(text, /\*\*see what changes\*\*/i, 'no "see what changes" option is labelled');
    assert.match(text, /\*\*not now\*\*/i, 'no "not now" option is labelled');
    assert.match(text, /\*\*apply now\*\*[^.]{0,40}recommend/i, 'apply is not the marked recommendation');
    assert.ok(text.indexOf('**apply now**') < text.indexOf('**not now**'), 'apply is not offered first');
  });

  it('row 5: the choice goes through the picker where there is one, inline options where there is none', () => {
    const text = oneLine(playbook());
    assert.match(text, /AskUserQuestion/, 'the question picker is not named');
    assert.match(text, /(inline|letter|number)[^.]{0,80}(option|answer)/i,
      'no fallback for a tool without a picker');
  });

  it('row 6: the choice is offered by the agent on the first reply, never from a hook', () => {
    const text = oneLine(playbook());
    assert.match(text, /(first reply|first response|first turn)/i);
    assert.match(text, /(never|not)[^.]{0,40}from a hook/i,
      'the playbook does not rule out the choice coming from a hook');
    assert.match(text, /(agent|you)[^.]{0,80}(offer|present|ask)/i,
      'it does not say whose job the offer is');
  });

  it('row 7: seeing what changed writes nothing and re-offers the same choice', () => {
    const text = oneLine(playbook());
    assert.match(text, /see what changes[\s\S]{0,400}?(writes nothing|changes nothing|installs nothing)/i,
      'the preview option is not stated to write nothing');
    assert.match(text, /(re-?offer|offer[^.]{0,20}again)[^.]{0,80}(choice|decision|option)/i,
      'the choice itself is not re-offered after the preview');
    assert.match(text, /(decision|choice)[^.]{0,40}(stays|remains|still)[^.]{0,20}open/i,
      'the decision is not stated to stay open');
  });

  it('row 8: the choice is presented once per session', () => {
    const text = oneLine(playbook());
    assert.match(text, /(choice|offer|it)[^.]{0,80}once per session/i,
      'nothing says the CHOICE is presented once per session');
    assert.match(text, /(no later reply|never|not)[^.]{0,80}(again|re-?offer|raise)/i,
      'it does not say a later reply must not raise it again');
  });

  it('row 9: an unattended run is not consent — no choice, no update', () => {
    const text = oneLine(playbook());
    assert.match(text, /unattended/i, 'unattended runs are not addressed');
    assert.match(text, /unattended[\s\S]{0,200}?(is not consent|not consent)/i,
      'it does not say an unattended run is not consent');
    assert.match(text, /unattended[\s\S]{0,300}?(never|not)[^.]{0,80}(offered|presented|updated|update)/i,
      'an unattended run is not ruled out from being offered the choice or updating');
  });

  it('row 10: an active change past new is reported and deferring recommended', () => {
    const text = oneLine(playbook());
    assert.match(text, /active change/i, 'an in-flight change is not considered');
    assert.match(text, /defer|not now|wait/i);
    assert.match(text, /playbook/i, 'it does not say the contracted playbooks are what gets replaced');
  });

  it('row 11: the playbook and command install, are manifested, and rewrite no user-owned file', (t) => {
    const dir = project(t);
    const pbRel = 'sdlc/.playbook/update.md';
    const cmdRel = '.claude/commands/sdlc/update.md';
    assert.ok(fs.existsSync(path.join(dir, pbRel)), `${pbRel} was not installed`);
    assert.ok(fs.existsSync(path.join(dir, cmdRel)), `${cmdRel} was not installed`);

    const manifest = fs.readFileSync(path.join(dir, 'sdlc/.state/manifest'), 'utf8');
    assert.match(manifest, /sdlc\/\.playbook\/update\.md/, 'the playbook is not manifested');
    assert.match(manifest, /commands\/sdlc\/update\.md/, 'the command is not manifested');

    // A project installed before this change: drop both files, keep a user-owned edit, update.
    fs.rmSync(path.join(dir, pbRel));
    fs.rmSync(path.join(dir, cmdRel));
    const constitution = path.join(dir, 'sdlc/context/constitution.md');
    fs.writeFileSync(constitution, '# Constitution — mine\n- do not touch this\n');
    const res = runCli(dir, ['update'], { env: { NO_UPDATE_NOTIFIER: '1' } });
    assert.equal(res.status, 0, res.stderr);
    assert.ok(fs.existsSync(path.join(dir, pbRel)), 'update did not restore the playbook');
    assert.ok(fs.existsSync(path.join(dir, cmdRel)), 'update did not restore the command');
    assert.equal(fs.readFileSync(constitution, 'utf8'), '# Constitution — mine\n- do not touch this\n');
  });

  it("row 12: a user's own hook in .claude/settings.json survives update", (t) => {
    const dir = project(t);
    const settingsPath = path.join(dir, '.claude/settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    settings.hooks ??= {};
    (settings.hooks.SessionStart ??= []).push({
      hooks: [{ type: 'command', command: 'node my-own-hook.mjs' }],
    });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    const res = runCli(dir, ['update'], { env: { NO_UPDATE_NOTIFIER: '1' } });
    assert.equal(res.status, 0, res.stderr);

    const after = JSON.stringify(JSON.parse(fs.readFileSync(settingsPath, 'utf8')));
    assert.match(after, /node my-own-hook\.mjs/, "the user's own hook was dropped by update");
  });

  it('row 13: the command stub is <=15 non-blank lines and names a playbook that exists', () => {
    const body = commandStub().replace(/^---\n[\s\S]*?\n---\n/, '');
    const lines = body.split(/\r?\n/).filter((l) => l.trim() !== '');
    assert.ok(lines.length <= 15, `command stub is ${lines.length} non-blank lines`);
    const named = commandStub().match(/sdlc\/\.playbook\/([\w-]+\.md)/);
    assert.ok(named, 'the stub names no playbook');
    assert.ok(fs.existsSync(path.join(PKG_ROOT, 'payload/playbook', named[1])),
      `the stub names ${named[1]}, which is not in the payload`);
  });

  // ---------- Applied only on an explicit pick, and reports what it did ----------

  it('row 14: nothing runs before an answer, and deferring changes nothing', () => {
    const text = oneLine(playbook());
    assert.match(text, /(before|until)[^.]{0,80}(answer|pick|chooses|choice)/i,
      'the playbook does not forbid acting before an answer');
    assert.match(text, /(not now|defer)[^.]{0,80}(nothing|no file|unchanged)/i,
      'deferring is not stated to change nothing');
  });

  it('row 15: the report must carry written, pruned, warnings and kept-because-edited', () => {
    const text = oneLine(playbook());
    for (const [re, what] of [
      [/written|wrote/i, 'the written count'],
      [/prune/i, 'the pruned count'],
      [/warning/i, 'the warnings'],
      [/kept|edited|modified/i, 'files kept because they were edited'],
    ]) assert.match(text, re, `the required report does not mention ${what}`);
  });

  it('row 16: --force is never passed by the agent; a capped prune is handed back', () => {
    const text = oneLine(playbook());
    assert.match(text, /--force/, '--force is not addressed at all');
    assert.match(text, /(never|not|without)[^.]{0,60}--force/i, 'the agent is not forbidden from passing --force');
    assert.match(text, /(blast cap|cap|exceed)/i, 'the blast cap is not mentioned');
  });

  it('row 17: a no-op update reports a written count below the payload total, plus pruned', (t) => {
    const dir = project(t);
    const res = runCli(dir, ['update'], { env: { NO_UPDATE_NOTIFIER: '1' } });
    assert.equal(res.status, 0, res.stderr);

    const written = res.stdout.match(/written:\s*(\d+)/i);
    const total = res.stdout.match(/payload files:\s*(\d+)/i);
    const pruned = res.stdout.match(/pruned:\s*(\d+)/i);
    assert.ok(written, 'update does not report a written count');
    assert.ok(total, 'update no longer reports the payload-file total');
    assert.ok(pruned, 'update does not report a pruned count');
    assert.ok(Number(written[1]) < Number(total[1]),
      `a no-op update claims ${written[1]} of ${total[1]} files written`);
  });

  it('row 18: a hand-edited payload file is kept, warned about, and not counted as written', (t) => {
    const dir = project(t);
    const victim = path.join(dir, 'sdlc/.playbook/new.md');
    const mine = '# mine now\n';
    fs.writeFileSync(victim, mine);

    const res = runCli(dir, ['update'], { env: { NO_UPDATE_NOTIFIER: '1' } });
    assert.equal(res.status, 0, res.stderr);
    assert.equal(fs.readFileSync(victim, 'utf8'), mine, 'the hand-edited file was overwritten');

    const out = `${res.stdout}\n${res.stderr}`;
    assert.match(out, /new\.md/, 'no warning names the kept file');
    const written = out.match(/written:\s*(\d+)/i);
    assert.ok(written, 'update does not report a written count');
    assert.equal(Number(written[1]), 0, 'the kept file was counted as written');
  });

  it('row 19: an over-cap prune does nothing and names --force [regression]', (t) => {
    const dir = project(t);
    const manifestPath = path.join(dir, 'sdlc/.state/manifest');
    const lines = fs.readFileSync(manifestPath, 'utf8').split(/\r?\n/).filter(Boolean);
    const stale = [];
    for (let i = 0; i < 60; i++) {
      const rel = `sdlc/.playbook/ghost-${i}.md`;
      const body = `# ghost ${i}\n`;
      fs.writeFileSync(path.join(dir, rel), body);
      const hash = spawnSync(process.execPath, ['-e',
        `const c=require('node:crypto');process.stdout.write(c.createHash('sha256').update(${JSON.stringify(body)}).digest('hex'))`,
      ], { encoding: 'utf8' }).stdout;
      stale.push(`${hash}  ${rel}`);
    }
    fs.writeFileSync(manifestPath, [...lines, ...stale].join('\n') + '\n');

    const res = runCli(dir, ['update'], { env: { NO_UPDATE_NOTIFIER: '1' } });
    assert.equal(res.status, 0, res.stderr);
    assert.ok(fs.existsSync(path.join(dir, 'sdlc/.playbook/ghost-0.md')), 'an over-cap prune deleted files');
    assert.match(`${res.stdout}\n${res.stderr}`, /--force/, 'the skip does not name --force');
  });

  // ---------- The framework's own source is never updated from a published copy ----------

  it('row 20: refuseSelfUpdate refuses only own-package-from-a-foreign-tree', async (t) => {
    const { refuseSelfUpdate } = await import('../bin/cli.mjs');
    assert.equal(typeof refuseSelfUpdate, 'function', 'refuseSelfUpdate is not exported from bin/cli.mjs');

    const own = (dir) => {
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '@warnyin/sdlc' }));
      return dir;
    };
    const foreign = own(makeTempProject(t));
    assert.ok(refuseSelfUpdate(foreign, PKG_ROOT), 'own package from a foreign tree must be refused');
    assert.ok(!refuseSelfUpdate(foreign, foreign), 'the same tree is how setup:dogfood works');

    const other = makeTempProject(t);
    fs.writeFileSync(path.join(other, 'package.json'), JSON.stringify({ name: 'someone-else' }));
    assert.ok(!refuseSelfUpdate(other, PKG_ROOT), 'another package must not be refused');

    const bare = makeTempProject(t);
    assert.ok(!refuseSelfUpdate(bare, PKG_ROOT), 'a project with no package.json must not be refused');

    const broken = makeTempProject(t);
    fs.writeFileSync(path.join(broken, 'package.json'), '{ not json');
    assert.ok(!refuseSelfUpdate(broken, PKG_ROOT), 'an unparsable package.json must not be refused');
  });

  it('row 21: update on the framework itself refuses before writing anything', (t) => {
    const dir = project(t);
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '@warnyin/sdlc' }));
    const before = snapshot(path.join(dir, 'sdlc'));

    const res = runCli(dir, ['update'], { env: { NO_UPDATE_NOTIFIER: '1' } });
    assert.notEqual(res.status, 0, 'the refusal exited successfully');
    assert.match(`${res.stdout}\n${res.stderr}`, /npm run setup:dogfood/,
      'the refusal does not name the regeneration command');
    assertUnchanged(before, snapshot(path.join(dir, 'sdlc')), 'sdlc/ after a refused update');
  });

  // ---------- What a newer version changes is reportable without installing it ----------

  it('row 22: changelog --since prints exactly the entries above it and writes nothing', (t) => {
    const versions = changelogVersions();
    assert.ok(versions.length >= 3, 'the changelog has too few entries for this row');
    const since = versions[2];
    const expected = versions.slice(0, 2);

    const dir = project(t);
    const before = snapshot(dir);
    const res = runCli(dir, ['changelog', '--since', since], { env: { NO_UPDATE_NOTIFIER: '1' } });
    assert.equal(res.status, 0, res.stderr);

    assert.deepEqual(changelogVersions(res.stdout), expected,
      `expected exactly ${expected.join(', ')} newest-first`);
    assertUnchanged(before, snapshot(dir), 'the project after changelog');
  });

  it('row 23: --since an unknown version prints what is above it and states the gap', (t) => {
    const dir = project(t);
    const res = runCli(dir, ['changelog', '--since', '0.0.1'], { env: { NO_UPDATE_NOTIFIER: '1' } });
    assert.equal(res.status, 0, res.stderr);
    const shown = changelogVersions(res.stdout);
    assert.deepEqual(shown, changelogVersions().slice(0, shown.length),
      'the entries printed above an unknown version are not the newest ones');
    assert.ok(shown.length > 0, 'nothing at all was printed above an unknown version');
    assert.match(res.stdout, /0\.0\.1/, 'the unknown version is not named');
    assert.match(res.stdout, /(no entry|not found|unknown|gap)/i, 'the gap is not stated');
  });

  it('row 24: --since at or above the package version prints no entry and says so', (t) => {
    const dir = project(t);
    for (const since of [PKG_VERSION, '999.0.0']) {
      const res = runCli(dir, ['changelog', '--since', since], { env: { NO_UPDATE_NOTIFIER: '1' } });
      assert.equal(res.status, 0, res.stderr);
      assert.deepEqual(changelogVersions(res.stdout), [], `entries were printed for --since ${since}`);
      assert.match(res.stdout, /(not behind|up to date|current|nothing)/i,
        `--since ${since} does not say the project is not behind`);
    }
  });

  it('row 25: the slicer orders by parsed version and skips an unparsable heading', async () => {
    const { sliceChangelog } = await import('../bin/changelog.mjs');
    assert.equal(typeof sliceChangelog, 'function', 'sliceChangelog is not exported from bin/changelog.mjs');

    const outOfOrder = '# Changelog\n\n## 0.9.0\n- old\n\n## 0.11.0\n- new\n\n## 0.10.0\n- middle\n';
    assert.deepEqual(
      changelogVersions(sliceChangelog(outOfOrder, { since: '0.9.0', upTo: '0.11.0' })),
      ['0.11.0', '0.10.0'],
      'file order was used instead of parsed version order',
    );

    const malformed = '# Changelog\n\n## Unreleased\n- wip\n\n## 0.11.0\n- new\n';
    assert.deepEqual(
      changelogVersions(sliceChangelog(malformed, { since: '0.10.0', upTo: '0.11.0' })),
      ['0.11.0'],
      'an unparsable heading was not skipped',
    );
  });

  it('row 26: a package with no CHANGELOG.md says so and exits 0', async () => {
    const { sliceChangelog } = await import('../bin/changelog.mjs');
    const out = sliceChangelog(null, { since: '0.10.0', upTo: PKG_VERSION });
    assert.match(String(out), /(no changelog|not available|none)/i,
      'a missing changelog does not produce a plain explanation');
  });

  it('row 27: with no --since the default comes from version.json, else the own entry alone', (t) => {
    const versions = changelogVersions();
    assert.ok(versions.length >= 2, 'the changelog has too few entries for this row');
    const dir = project(t, { installed: versions[1] });

    const fromVersionJson = runCli(dir, ['changelog'], { env: { NO_UPDATE_NOTIFIER: '1' } });
    assert.equal(fromVersionJson.status, 0, fromVersionJson.stderr);
    assert.deepEqual(changelogVersions(fromVersionJson.stdout), [versions[0]],
      'the default --since did not come from sdlc/.hooks/version.json');

    fs.writeFileSync(path.join(dir, 'sdlc/.hooks/version.json'), '{ not json');
    const corrupt = runCli(dir, ['changelog'], { env: { NO_UPDATE_NOTIFIER: '1' } });
    assert.equal(corrupt.status, 0, corrupt.stderr);
    assert.deepEqual(changelogVersions(corrupt.stdout), [PKG_VERSION],
      'an unparsable version.json should fall back to the package entry alone');

    const bare = makeTempProject(t);
    const noProject = runCli(bare, ['changelog'], { env: { NO_UPDATE_NOTIFIER: '1' } });
    assert.equal(noProject.status, 0, noProject.stderr);
    assert.deepEqual(changelogVersions(noProject.stdout), [PKG_VERSION],
      'outside a project the package entry alone should print');
  });

  it('row 28: HELP and the README list changelog with --since', () => {
    const cli = fs.readFileSync(path.join(PKG_ROOT, 'bin/cli.mjs'), 'utf8');
    const help = cli.match(/const HELP = `([\s\S]*?)`;/);
    assert.ok(help, 'the HELP template literal could not be located in bin/cli.mjs');
    assert.match(help[1], /changelog/, 'HELP does not list changelog');
    assert.match(help[1], /--since/, 'HELP does not document --since');

    const readme = fs.readFileSync(path.join(PKG_ROOT, 'README.md'), 'utf8');
    assert.match(readme, /changelog/, 'the README does not mention changelog');
  });

  // ---------- An update reports what it brought in ----------

  it('row 29: update prints exactly the entries between the recorded version and its own', (t) => {
    const versions = changelogVersions();
    assert.ok(versions.length >= 3, 'the changelog has too few entries for this row');
    const dir = project(t, { installed: versions[2] });

    const res = runCli(dir, ['update'], { env: { NO_UPDATE_NOTIFIER: '1' } });
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(changelogVersions(res.stdout), versions.slice(0, 2),
      'update did not report the entries it brought in');
  });

  it('row 30: update at the same version prints no changelog entry', (t) => {
    const dir = project(t, { installed: PKG_VERSION });
    const res = runCli(dir, ['update'], { env: { NO_UPDATE_NOTIFIER: '1' } });
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(changelogVersions(res.stdout), [], 'entries were printed for a same-version update');
  });

  it('row 31: a downgrade is named, not silent', (t) => {
    const dir = project(t, { installed: '999.0.0' });
    const res = runCli(dir, ['update'], { env: { NO_UPDATE_NOTIFIER: '1' } });

    const out = `${res.stdout}\n${res.stderr}`;
    assert.match(out, /999\.0\.0/, 'the version being left is not named');
    assert.match(out, new RegExp(PKG_VERSION.replace(/\./g, '\\.')), 'the version being installed is not named');
    assert.match(out, /(back|down|older|earlier)/i, 'a downgrade is not reported as one');
    assert.deepEqual(changelogVersions(res.stdout), [], 'a downgrade printed entries as if it were a gain');
  });

  it('row 33: a range past the bound prints the newest and names what it left out', async (t) => {
    const { MAX_ENTRIES, FULL_CHANGELOG_URL } = await import('../bin/changelog.mjs');
    const versions = changelogVersions();
    assert.ok(versions.length > MAX_ENTRIES, 'the changelog has too few entries for this row');
    const dir = project(t);

    const wide = runCli(dir, ['changelog', '--since', '0.0.1'], { env: { NO_UPDATE_NOTIFIER: '1' } });
    assert.equal(wide.status, 0, wide.stderr);
    const shown = changelogVersions(wide.stdout);
    // Pinned to the constant: "fewer than all" alone would pass with a bound of 17 of 18.
    assert.equal(shown.length, MAX_ENTRIES, `printed ${shown.length} entries, not the bound of ${MAX_ENTRIES}`);
    assert.ok(wide.stdout.includes(FULL_CHANGELOG_URL),
      'the omission points at nothing a person can open — the package CHANGELOG sits in the npx cache');
    assert.deepEqual(shown, versions.slice(0, shown.length), 'the newest entries were not the ones kept');
    const left = versions.length - shown.length;
    assert.match(wide.stdout, new RegExp(`\\b${left}\\b`), `the ${left} older entries left out are not counted`);

    // Within the bound, no such line — otherwise the row passes on a constant.
    const narrow = runCli(dir, ['changelog', '--since', versions[1]], { env: { NO_UPDATE_NOTIFIER: '1' } });
    assert.equal(narrow.status, 0, narrow.stderr);
    assert.deepEqual(changelogVersions(narrow.stdout), [versions[0]]);
    assert.doesNotMatch(narrow.stdout, /older entr/i, 'a complete range still claims entries were left out');
  });

  it('row 34: a since above every entry says nothing is above it', async () => {
    const { sliceChangelog } = await import('../bin/changelog.mjs');
    const out = String(sliceChangelog('# CL\n\n## 0.1.0\n- old\n', { since: '0.5.0', upTo: '9.9.9' }));
    assert.deepEqual(changelogVersions(out), [], 'entries were printed for a range with none');
    assert.doesNotMatch(out, /everything above it is shown/i,
      'it claims everything above was shown while showing nothing');
    assert.match(out, /nothing/i, 'it does not say there is nothing above that version');
  });

  it('row 35: a pre-release heading is not counted as its release version', async () => {
    const { sliceChangelog } = await import('../bin/changelog.mjs');
    const text = '# CL\n\n## 0.11.0\n- real\n\n## 0.10.0-beta\n- pre\n\n## 0.10.0\n- final\n';

    const all = String(sliceChangelog(text, { since: '0.9.0', upTo: '0.11.0' }));
    assert.deepEqual(changelogVersions(all), ['0.11.0', '0.10.0'],
      'the pre-release heading was treated as a released entry');

    const above = String(sliceChangelog(text, { since: '0.10.0', upTo: '0.11.0' }));
    assert.doesNotMatch(above, /0\.10\.0-beta/, 'a pre-release below the floor was printed anyway');
  });

  it('row 36: --force needs a terminal, or the documented override', (t) => {
    const dir = project(t);
    const manifestPath = path.join(dir, 'sdlc/.state/manifest');
    const base = fs.readFileSync(manifestPath, 'utf8').split(/\r?\n/).filter(Boolean);
    const ghosts = [];
    for (let i = 0; i < 60; i++) {
      const rel = `sdlc/.playbook/ghost-${i}.md`;
      const body = `# ghost ${i}\n`;
      fs.writeFileSync(path.join(dir, rel), body);
      ghosts.push(`${sha256(body)}  ${rel}`);
    }
    fs.writeFileSync(manifestPath, [...base, ...ghosts].join('\n') + '\n');
    const before = snapshot(path.join(dir, 'sdlc'));

    // spawnSync gives the child no TTY — exactly the shape an agent's shell call has.
    const refused = runCli(dir, ['update', '--force'], { env: { NO_UPDATE_NOTIFIER: '1' } });
    assert.notEqual(refused.status, 0, 'a forced prune with nobody at the terminal succeeded');
    assert.match(`${refused.stdout}
${refused.stderr}`, /WARNYIN_SDLC_FORCE/,
      'the refusal does not name the documented override');
    assertUnchanged(before, snapshot(path.join(dir, 'sdlc')), 'sdlc/ after a refused --force');

    const allowed = runCli(dir, ['update', '--force'], {
      env: { NO_UPDATE_NOTIFIER: '1', WARNYIN_SDLC_FORCE: '1' },
    });
    assert.equal(allowed.status, 0, allowed.stderr);
    assert.ok(!fs.existsSync(path.join(dir, 'sdlc/.playbook/ghost-0.md')),
      'the override did not let the prune through');
  });

  it('row 37: the terminal branch of the --force gate, driven through its injectable streams', async () => {
    const { forceNeedsAPerson } = await import('../bin/cli.mjs');
    const tty = { isTTY: true };
    const pipe = { isTTY: false };
    const force = { force: true };

    // Row 36 can only reach the refusal and the override: spawnSync never hands a child a
    // terminal. The terminal branch is reached here instead, by the same function.
    assert.equal(forceNeedsAPerson(force, {}, tty, tty), null, 'a person at a terminal was refused');
    assert.ok(forceNeedsAPerson(force, {}, tty, pipe), 'stdout piped away still counted as a person present');
    assert.ok(forceNeedsAPerson(force, {}, pipe, tty), 'stdin piped in still counted as a person present');
    assert.ok(forceNeedsAPerson(force, { WARNYIN_SDLC_FORCE: 'true' }, pipe, pipe),
      'an override other than exactly "1" was accepted');
    assert.equal(forceNeedsAPerson({ force: false }, {}, pipe, pipe), null, 'a run without --force was refused');
  });

  it('row 38: changelog text is data to show, never instructions to follow', () => {
    const text = oneLine(playbook());
    assert.match(text, /changelog[^.]{0,60}(is )?data[^.]{0,20}never instructions/i,
      'nothing says the changelog preview is data rather than instructions');
    assert.match(text, /(apply|skip asking|--force|override)[\s\S]{0,200}?(not a step|report)/i,
      'an instruction found inside the changelog is not routed back to the person');
    assert.match(text, /never set `?WARNYIN_SDLC_FORCE/i, 'the agent is not told to leave the override alone');
    assert.match(text, /stands? in for the person/i, 'nothing says the preview cannot replace the person\'s answer');
  });

  // ---------- residency ----------

  it('row 32: design.md records the notice opening a decision and where changelog output sits', () => {
    const design = oneLine(fs.readFileSync(path.join(PKG_ROOT, 'docs/design.md'), 'utf8'));
    assert.match(design, /update notice/i, 'the ledger has no update-notice row');
    assert.match(design, /update notice[^|]*\|[^|]*\|[^|]*\|[^|]*(decision|choice|pick)/i,
      'the ledger row does not record that the line now opens a decision');
    assert.match(design, /changelog/i, 'the ledger says nothing about the changelog output');
  });
});

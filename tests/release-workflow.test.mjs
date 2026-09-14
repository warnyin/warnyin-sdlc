// Contract rows for release-on-tag: sdlc/changes/release-on-tag/contract/tests.md.
// A real publish needs GitHub and npm, so these reach two things: the release check run
// black-box, and the workflow files read as text (zero deps — no YAML parser).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeTempProject, PKG_ROOT } from './helpers.mjs';

const CHECK = path.join(PKG_ROOT, '.github/scripts/release-check.mjs');
const RELEASE_YML = path.join(PKG_ROOT, '.github/workflows/release.yml');
const CI_YML = path.join(PKG_ROOT, '.github/workflows/ci.yml');
const PUBLISH_CMD = 'npm publish --provenance --access public';

// ---------- release-check.mjs, black-box ----------

// Every check row asserts the script exists first: a missing script also exits non-zero,
// and the "exits ≠ 0" rows would otherwise pass before anything was implemented.
function runCheck(t, { version = '1.2.3', pkgRaw, tag, npm = '11.5.1' } = {}) {
  assert.ok(fs.existsSync(CHECK), 'release-check.mjs missing');
  const dir = makeTempProject(t);
  const raw = pkgRaw === undefined ? JSON.stringify({ name: '@warnyin/sdlc', version }) : pkgRaw;
  if (raw !== null) fs.writeFileSync(path.join(dir, 'package.json'), raw);
  const env = { ...process.env };
  if (tag === undefined) delete env.GITHUB_REF_NAME;
  else env.GITHUB_REF_NAME = tag;
  const res = spawnSync(process.execPath, [CHECK], { cwd: dir, env, input: npm, encoding: 'utf8' });
  if (res.error) throw res.error;
  return { ...res, dir };
}

test('row 1: matching plain tag and npm ≥ 11.5.1 pass, naming the version', (t) => {
  const res = runCheck(t, { version: '0.10.0', tag: 'v0.10.0' });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /0\.10\.0/);
});

test('row 2: tag and package.json disagree → fails naming both', (t) => {
  const res = runCheck(t, { version: '0.9.0', tag: 'v0.10.0' });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /0\.10\.0/);
  assert.match(res.stderr, /0\.9\.0/);
});

test('row 3: tags that are not a plain vX.Y.Z fail even when package.json agrees', (t) => {
  const cases = [
    ['v1.0.0-rc.1', '1.0.0-rc.1'], ['vnext', '0.9.0'], ['0.9.0', '0.9.0'], ['v0.9', '0.9'],
    ['V0.9.0', '0.9.0'], ['v0.9.0 ', '0.9.0'], ['v0.9.0\n', '0.9.0'], ['v01.0.0', '01.0.0'],
  ];
  for (const [tag, version] of cases) {
    const res = runCheck(t, { version, tag });
    assert.notEqual(res.status, 0, `tag ${JSON.stringify(tag)} should fail`);
    assert.match(res.stderr, /tag/i, `tag ${JSON.stringify(tag)} should fail on the tag`);
  }
});

test('row 4: GITHUB_REF_NAME unset or empty fails', (t) => {
  for (const tag of [undefined, '']) {
    const res = runCheck(t, { tag });
    assert.notEqual(res.status, 0, `tag ${JSON.stringify(tag)} should fail`);
    assert.match(res.stderr, /GITHUB_REF_NAME/);
  }
});

test('row 5: shell metacharacters in the tag fail and execute nothing', (t) => {
  for (const tag of ['v1.2.3$(touch pwned)', 'v1.2.3;touch pwned', 'v1.2.3`touch pwned`']) {
    const res = runCheck(t, { version: '1.2.3', tag });
    assert.notEqual(res.status, 0, `tag ${JSON.stringify(tag)} should fail`);
    assert.equal(fs.existsSync(path.join(res.dir, 'pwned')), false, `tag ${JSON.stringify(tag)} ran a command`);
  }
});

test('row 6: missing or unparsable package.json fails with a message', (t) => {
  for (const pkgRaw of [null, 'not valid json {']) {
    const res = runCheck(t, { pkgRaw, tag: 'v1.0.0' });
    assert.notEqual(res.status, 0);
    const message = res.stderr.split('\n').find((l) => l.includes('package.json') && !/^\s+at /.test(l));
    assert.ok(message, `stderr should explain the package.json problem, got: ${res.stderr}`);
  }
});

test('row 11: npm below 11.5.1 or unreadable fails naming 11.5.1; 11.5.1 and above pass', (t) => {
  for (const npm of ['11.5.0', '10.9.9', 'garbage', '']) {
    const res = runCheck(t, { version: '1.2.3', tag: 'v1.2.3', npm });
    assert.notEqual(res.status, 0, `npm ${JSON.stringify(npm)} should fail`);
    assert.match(res.stderr, /11\.5\.1/);
  }
  for (const npm of ['11.5.1', '11.10.0\n', '12.0.0']) {
    const res = runCheck(t, { version: '1.2.3', tag: 'v1.2.3', npm });
    assert.equal(res.status, 0, `npm ${JSON.stringify(npm)} should pass: ${res.stderr}`);
  }
  assert.doesNotMatch(readYaml(RELEASE_YML), /npm\s+(install|i)\s+(-g|--global)/);
});

// ---------- workflow files, as text ----------

function readYaml(p) {
  assert.ok(fs.existsSync(p), `${path.relative(PKG_ROOT, p)} missing`);
  return fs.readFileSync(p, 'utf8');
}

const indentOf = (line) => line.search(/\S/);

// Comment lines may name the very keys a row forbids (ci.yml documents its gate rules).
const withoutComments = (yaml) => yaml.split(/\r?\n/).filter((l) => !l.trim().startsWith('#')).join('\n');

// Lines nested under the line at `idx`: everything after it until the first non-blank,
// non-comment line indented at or above it.
function childLines(lines, idx) {
  const base = indentOf(lines[idx]);
  const out = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() && !l.trim().startsWith('#') && indentOf(l) <= base) break;
    out.push(l);
  }
  return out;
}

function topBlock(yaml, key) {
  const lines = yaml.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.startsWith(`${key}:`));
  assert.ok(idx > -1, `no top-level ${key}:`);
  return [lines[idx], ...childLines(lines, idx)].join('\n');
}

function jobs(yaml) {
  const lines = topBlock(yaml, 'jobs').split('\n');
  const out = new Map();
  lines.forEach((l, i) => {
    const m = l.match(/^ {2}([\w-]+):\s*$/);
    if (m) out.set(m[1], [l, ...childLines(lines, i)].join('\n'));
  });
  assert.ok(out.size > 0, 'jobs: holds no jobs');
  return out;
}

function publishJob(yaml) {
  const hits = [...jobs(yaml)].filter(([, text]) => text.includes('npm publish'));
  assert.equal(hits.length, 1, 'exactly one job should run npm publish');
  return { name: hits[0][0], text: hits[0][1] };
}

// Every `run:` value, single-line or block scalar.
function runBlocks(yaml) {
  const lines = yaml.split(/\r?\n/);
  const out = [];
  lines.forEach((l, i) => {
    const m = l.match(/^\s*(?:-\s+)?run:\s*(.*)$/);
    if (!m) return;
    out.push(/^[|>][-+]?$/.test(m[1].trim()) ? childLines(lines, i).join('\n') : m[1]);
  });
  return out;
}

test('row 7: release.yml triggers only on push of v[0-9]+.[0-9]+.[0-9]+ tags', () => {
  const on = topBlock(readYaml(RELEASE_YML), 'on');
  assert.match(on, /^\s+push:/m);
  assert.match(on, /^\s+tags:/m);
  assert.ok(on.includes('v[0-9]+.[0-9]+.[0-9]+'), 'tag pattern missing');
  assert.doesNotMatch(on, /branches|pull_request|workflow_dispatch|workflow_run|schedule/);
});

test('row 8: ci.yml is callable and still runs on push to main and pull requests', () => {
  const on = topBlock(readYaml(CI_YML), 'on');
  assert.match(on, /^\s+workflow_call:/m);
  assert.match(on, /^\s+pull_request:/m);
  assert.match(on, /^\s+push:/m);
  assert.match(on, /branches:\s*\[\s*main\s*\]|branches:\s*\n\s+-\s*main\b/);
});

test('row 9: release runs ci.yml as a job and publish needs it', () => {
  const yaml = readYaml(RELEASE_YML);
  const gate = [...jobs(yaml)].find(([, text]) => /^\s+uses:\s*\.\/\.github\/workflows\/ci\.yml\s*$/m.test(text));
  assert.ok(gate, 'no job uses ./.github/workflows/ci.yml');
  const needs = publishJob(yaml).text.match(/^\s+needs:\s*(.+)$/m);
  assert.ok(needs, 'publish job has no needs:');
  assert.match(needs[1], new RegExp(`(^|[\\[\\s,])${gate[0]}([\\]\\s,]|$)`), `publish must need ${gate[0]}`);
});

test('row 10: the check precedes publish and no step can outlive a failed gate', () => {
  const yaml = readYaml(RELEASE_YML);
  const text = publishJob(yaml).text;
  const checkIdx = text.search(/npm --version \| node \.github\/scripts\/release-check\.mjs/);
  const publishIdx = text.indexOf(PUBLISH_CMD);
  assert.ok(checkIdx > -1, 'publish job does not pipe npm --version into release-check');
  const runs = runBlocks(text).map((b) => b.trim());
  assert.ok(runs.includes('npm --version | node .github/scripts/release-check.mjs'), 'release-check is not a bare step');
  assert.ok(runs.includes(PUBLISH_CMD), 'publish is not a bare step');
  assert.ok(publishIdx > -1, `publish job does not run ${PUBLISH_CMD}`);
  assert.ok(checkIdx < publishIdx, 'release-check must run before publish');
  // ci.yml is the gate too: an escape hatch there lets failed tests reach publish.
  for (const p of [RELEASE_YML, CI_YML]) {
    const text = withoutComments(readYaml(p));
    assert.doesNotMatch(text, /continue-on-error/, path.basename(p));
    assert.doesNotMatch(text, /^\s+if:.*\b(always|failure|cancelled)\s*\(/m, path.basename(p));
  }
});

test('row 12: no npm token or secret is referenced by either workflow', () => {
  for (const p of [RELEASE_YML, CI_YML]) {
    assert.doesNotMatch(readYaml(p), /NPM_TOKEN|NODE_AUTH_TOKEN|\bsecrets\b/, path.basename(p));
  }
});

test('row 13: workflow-level contents: read only; id-token: write once, in the publish job', () => {
  const yaml = readYaml(RELEASE_YML);
  const perms = topBlock(yaml, 'permissions').split('\n').slice(1).map((l) => l.trim()).filter(Boolean);
  assert.deepEqual(perms, ['contents: read']);
  assert.equal((yaml.match(/id-token:\s*write/g) ?? []).length, 1);
  assert.match(publishJob(yaml).text, /id-token:\s*write/);
});

test('row 14: no run block interpolates github/inputs/env expressions', () => {
  const blocks = runBlocks(readYaml(RELEASE_YML));
  assert.ok(blocks.length > 0, 'release.yml has no run steps');
  for (const b of blocks) assert.doesNotMatch(b, /\$\{\{\s*(github|inputs|env)\./, b);
});

test('row 15: publish runs on a GitHub-hosted ubuntu runner with no persisted git credentials', () => {
  const text = publishJob(readYaml(RELEASE_YML)).text;
  assert.match(text, /^\s+runs-on:\s*ubuntu-/m);
  assert.doesNotMatch(text, /self-hosted/);
  assert.match(text, /persist-credentials:\s*false/);
});

// Regression guard: green before implementation by design — .github/ is not in `files`.
test('row 16: the npm tarball carries nothing from .github/', () => {
  const res = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: PKG_ROOT, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  const files = JSON.parse(res.stdout)[0].files.map((f) => f.path);
  assert.ok(files.length > 0);
  assert.deepEqual(files.filter((f) => f.startsWith('.github/')), []);
});

test('row 17: README release section tells a maintainer how to set up and cut a release', () => {
  const readme = fs.readFileSync(path.join(PKG_ROOT, 'README.md'), 'utf8');
  const start = readme.search(/^#{2,3} .*Releas/m);
  assert.ok(start > -1, 'README has no release section');
  const level = readme.slice(start).match(/^#+/)[0].length;
  const bodyStart = readme.indexOf('\n', start) + 1;
  const after = readme.slice(bodyStart).search(new RegExp(`^#{1,${level}} `, 'm'));
  const section = after === -1 ? readme.slice(start) : readme.slice(start, bodyStart + after);
  assert.match(section, /release\.yml/);
  assert.match(section, /trusted publisher/i);
  assert.match(section, /npm publish/);
  assert.match(section, /ruleset/i);
  assert.match(section, /npm view/);
});

test('row 18: publish refuses a tagged commit that main does not contain', () => {
  const text = publishJob(readYaml(RELEASE_YML)).text;
  assert.match(text, /fetch-depth:\s*0\b/);
  // Exact run value: `|| true` or `; exit 0` appended to a gate would pass a substring match.
  const gates = runBlocks(text).map((b) => b.trim());
  assert.ok(gates.includes('git merge-base --is-ancestor "$GITHUB_SHA" origin/main'), 'ancestry check is not a bare step');
  const ancestryIdx = text.indexOf('git merge-base --is-ancestor "$GITHUB_SHA" origin/main');
  assert.ok(ancestryIdx > -1, 'publish job has no ancestry check against origin/main');
  assert.ok(ancestryIdx < text.indexOf(PUBLISH_CMD), 'ancestry check must run before publish');
});

test('row 19: ci.yml stays a safe gate — read-only, unconditional, same Node as publish', () => {
  const ci = readYaml(CI_YML);
  for (const m of ci.matchAll(/^(\s*)permissions:(.*)$/gm)) {
    const lines = ci.split(/\r?\n/);
    const idx = lines.findIndex((l) => l === m[0]);
    const granted = [m[2].trim(), ...childLines(lines, idx).map((l) => l.trim())].filter(Boolean);
    assert.deepEqual(granted, ['contents: read'], 'ci.yml may grant only contents: read');
  }
  for (const [name, text] of jobs(ci)) {
    assert.doesNotMatch(text, /^ {4}if:/m, `ci.yml job ${name} has a job-level if:`);
  }
  const nodeOf = (text) => text.match(/node-version:\s*['"]?(\d+)/)?.[1];
  const packNode = nodeOf(jobs(ci).get('pack-verify') ?? '');
  assert.ok(packNode, 'ci.yml pack-verify has no fixed node-version');
  assert.equal(packNode, nodeOf(publishJob(readYaml(RELEASE_YML)).text));
});

test('row 20: every action in the publish job is pinned to a commit SHA', () => {
  const uses = [...publishJob(readYaml(RELEASE_YML)).text.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)/gm)].map((m) => m[1]);
  assert.ok(uses.length > 0, 'publish job uses no actions');
  for (const u of uses) assert.match(u, /@[0-9a-f]{40}$/, u);
});

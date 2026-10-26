#!/usr/bin/env node
// Release tooling (outside the tarball) for bin/shipped-hashes.json, the ledger `update` reads to
// reclaim a payload file it lost track of (#11). For every `v*` tag, every version published to npm
// without a tag, and the working tree at package.json's version, it installs each tool with that
// version's own CLI into a temp project and records, per installed path, the sha256 of the content
// written there with `\r\n` → `\n`, the way `installFile` hashes disk content. A tool an old
// version does not know is skipped; from v0.22.0 on every tool must install.
//
//   npm run shipped-hashes          rebuild the ledger (tags fetched, network for npm, clean payload)
//   node .github/scripts/shipped-hashes.mjs --check
//                                   release gate: fail unless the ledger covers what this working
//                                   tree installs for every tool (no tags or network needed)
//
// WARNYIN_SDLC_SHIPPED_HASHES names another ledger file, as it does for the CLI.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const LEDGER = process.env.WARNYIN_SDLC_SHIPPED_HASHES || path.join(ROOT, 'bin', 'shipped-hashes.json');
const { TOOLS } = await import(new URL('../../bin/cli.mjs', import.meta.url));
const ALL_TOOLS_FROM = '0.22.0';

const sha = (s) => crypto.createHash('sha256').update(s.replace(/\r\n/g, '\n')).digest('hex');

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, ...opts });
  if (res.error) throw res.error;
  return res;
}

function semverKey(v) {
  return v.split('.').map((n) => n.padStart(6, '0')).join('.');
}

// An old CLI gets only what it needs to run: no tokens, no registry credentials.
const KEEP_ENV = ['PATH', 'Path', 'HOME', 'USERPROFILE', 'TEMP', 'TMP', 'TMPDIR', 'SystemRoot', 'APPDATA', 'LOCALAPPDATA'];
const cliEnv = () => ({
  ...Object.fromEntries(KEEP_ENV.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]])),
  NO_UPDATE_NOTIFIER: '1', NO_COLOR: '1', CI: '1',
});

// Extracts a tag's tree into `dir` without touching this repository's index or working tree. The
// archive stays a Buffer: decoding it as text would corrupt any non-UTF-8 byte in the tar stream.
function extractTag(tag, dir) {
  const archive = run('git', ['-c', 'core.autocrlf=false', 'archive', '--format=tar', tag], { cwd: ROOT, encoding: 'buffer' });
  if (archive.status !== 0) throw new Error(`git archive ${tag} failed: ${archive.stderr}`);
  const untar = run('tar', ['-x', '-C', dir], { input: archive.stdout });
  if (untar.status !== 0) throw new Error(`tar for ${tag} failed: ${untar.stderr}`);
}

// Installs one tool with the CLI at `cliPath` into a fresh project; adds its installed hashes.
function installedHashes(cliPath, tool, paths) {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-ledger-proj-'));
  try {
    const res = run(process.execPath, [cliPath, 'init', '--tool', tool], { cwd: proj, env: cliEnv(), input: '' });
    const manifest = path.join(proj, 'sdlc', '.state', 'manifest');
    if (res.status !== 0 || !fs.existsSync(manifest)) return false;
    for (const line of fs.readFileSync(manifest, 'utf8').split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const rel = line.slice(line.indexOf('  ') + 2);
      const file = path.join(proj, rel);
      if (!fs.existsSync(file)) continue;
      if (!paths.has(rel)) paths.set(rel, new Set());
      paths.get(rel).add(sha(fs.readFileSync(file, 'utf8')));
    }
    return true;
  } finally {
    fs.rmSync(proj, { recursive: true, force: true });
  }
}

function readLedger() {
  if (!fs.existsSync(LEDGER)) return { versions: [], paths: {} };
  return JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
}

// ---------- --check: the release gate ----------
if (process.argv.includes('--check')) {
  const ledger = readLedger();
  const current = new Map();
  for (const tool of TOOLS) {
    if (!installedHashes(path.join(ROOT, 'bin', 'cli.mjs'), tool, current)) {
      console.error(`shipped-hashes --check: the working-tree CLI failed to install ${tool}`);
      process.exit(1);
    }
  }
  const missing = [];
  for (const [rel, hashes] of current) {
    const listed = Object.hasOwn(ledger.paths ?? {}, rel) ? ledger.paths[rel] : [];
    for (const h of hashes) if (!listed.includes(h)) missing.push(`${rel} ${h}`);
  }
  if (missing.length) {
    console.error(`shipped-hashes --check: ${missing.length} installed file(s) not in the ledger — run \`npm run shipped-hashes\`:`);
    for (const m of missing.slice(0, 20)) console.error(`  ${m}`);
    process.exit(1);
  }
  console.log(`shipped-hashes --check: the ledger covers all ${current.size} installed paths`);
  process.exit(0);
}

// ---------- rebuild ----------

// The ledger is what a release ships, so unreleased edits to what gets installed must not enter it.
const dirty = run('git', ['status', '--porcelain', '--', 'payload', 'bin/cli.mjs', 'lib'], { cwd: ROOT }).stdout.trim();
if (dirty) throw new Error(`commit the payload first; uncommitted changes would enter the ledger:\n${dirty}`);

// npm without a shell: `npm run` sets npm_execpath to npm's own JS entry, which node runs directly.
function npm(args, opts = {}) {
  const entry = process.env.npm_execpath;
  if (!entry) throw new Error('run this through `npm run shipped-hashes` (npm_execpath is not set)');
  return run(process.execPath, [entry, ...args], opts);
}

// A version published to npm without a git tag is installed from its registry tarball.
function extractPublished(version, dir) {
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(version)) throw new Error(`unexpected version from the registry: ${version}`);
  const packed = npm(['pack', `@warnyin/sdlc@${version}`, '--pack-destination', dir, '--silent'], { cwd: dir });
  if (packed.status !== 0) throw new Error(`npm pack ${version} failed: ${packed.stderr}`);
  const tgz = fs.readdirSync(dir).find((f) => f.endsWith('.tgz'));
  const untar = run('tar', ['-xzf', tgz, '--strip-components=1'], { cwd: dir });
  if (untar.status !== 0) throw new Error(`tar for ${version} failed: ${untar.stderr}`);
}

const paths = new Map();
const versions = new Set();

function record(label, extract, version) {
  const pkg = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-ledger-pkg-'));
  try {
    extract(pkg);
    const installed = TOOLS.map((tool) => installedHashes(path.join(pkg, 'bin', 'cli.mjs'), tool, paths));
    const count = installed.filter(Boolean).length;
    // A failure looks like "tool unknown"; only an old version may legitimately skip one.
    if (semverKey(version) >= semverKey(ALL_TOOLS_FROM) && count !== TOOLS.length) {
      throw new Error(`${label} installed ${count}/${TOOLS.length} tools; every tool exists from ${ALL_TOOLS_FROM} on`);
    }
    if (count > 0) versions.add(version);
    console.log(`${label}: ${count}/${TOOLS.length} tools`);
  } finally {
    fs.rmSync(pkg, { recursive: true, force: true });
  }
}

const tags = run('git', ['tag', '-l', 'v*'], { cwd: ROOT }).stdout.split(/\r?\n/).filter(Boolean);
if (tags.length === 0) throw new Error('no v* tags: fetch them first (git fetch --tags)');
for (const tag of tags.sort((a, b) => semverKey(a.slice(1)).localeCompare(semverKey(b.slice(1))))) {
  record(tag, (dir) => extractTag(tag, dir), tag.slice(1));
}

const published = npm(['view', '@warnyin/sdlc', 'versions', '--json']);
if (published.status !== 0) throw new Error(`npm view failed: ${published.stderr}`);
const tagged = new Set(tags.map((t) => t.slice(1)));
for (const version of JSON.parse(published.stdout).filter((v) => !tagged.has(v))) {
  record(`npm ${version}`, (dir) => extractPublished(version, dir), version);
}

// The working tree is the version about to be released.
const current = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
for (const tool of TOOLS) {
  if (!installedHashes(path.join(ROOT, 'bin', 'cli.mjs'), tool, paths)) throw new Error(`current CLI failed for ${tool}`);
}
versions.add(current);

// Release history only grows: a deleted tag, a shallow clone or an unpublished version must not
// silently drop what an earlier run recorded.
const old = readLedger();
for (const v of old.versions ?? []) versions.add(v);
for (const [rel, hashes] of Object.entries(old.paths ?? {})) {
  if (!paths.has(rel)) paths.set(rel, new Set());
  for (const h of hashes) paths.get(rel).add(h);
}

const ledger = {
  versions: [...versions].sort((a, b) => semverKey(a).localeCompare(semverKey(b))),
  paths: Object.fromEntries([...paths.keys()].sort().map((p) => [p, [...paths.get(p)].sort()])),
};
fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1) + '\n');
console.log(`wrote ${path.relative(ROOT, LEDGER)}: ${ledger.versions.length} versions, ${paths.size} paths, `
  + `${[...paths.values()].reduce((n, s) => n + s.size, 0)} hashes`);

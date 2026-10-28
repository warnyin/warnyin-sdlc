// CLI-only git reader for the overlap warning: what other refs hold under sdlc/. Lives in bin/, not
// lib/: lib/ is copied into projects and imported by hooks, and a hook must never be one import
// away from spawning git.
//
// A ref name comes from a user-edited file and what a ref holds is untrusted. So: a name reaches git
// only after a closed pattern, git is found by an absolute PATH entry and run with an allowlisted
// env and an argument array (no shell), a path from a ref never reaches git (only hex oids do), and
// every bound that is hit is said (`skipped (...)` or `ignored`), never a silent truncation.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { compareRef } from '../lib/overlap.mjs';
import { parseConfig } from '../lib/config.mjs';
import { listOpenChangeIds } from '../lib/relations.mjs';

const MAX_REFS = 10;
const MAX_FILES = 2000;
const MAX_BLOB = 256 * 1024;
const MAX_BUFFER = 64 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const SAFE_NAME = /^[A-Za-z0-9._-]+$/;
const REF_NAME = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const OID = /^[0-9a-f]{40}$|^[0-9a-f]{64}$/;
const TREE_META = /^(\d{6}) (\w+) ([0-9a-f]{40}|[0-9a-f]{64}) +(\d+|-)$/;
const ENV_ALLOWED = new Set(['PATH', 'HOME', 'USERPROFILE', 'SYSTEMROOT', 'TEMP', 'TMP', 'LANG', 'GIT_CEILING_DIRECTORIES']);
// Config keys a partial clone carries. Git fetches a missing blob from that remote when it reads one, and
// "never a fetch" is the contract, so such a project is skipped (GIT_NO_LAZY_FETCH only exists from git 2.44).
const PARTIAL_KEYS = '^(extensions[.]partialclone|remote[.].*[.]promisor)$';

export function isRefName(s) {
  return typeof s === 'string' && s.length > 0 && s.length <= 200
    && REF_NAME.test(s) && !s.includes('..') && !s.includes('//');
}

// ---------- running git ----------

// The first absolute PATH entry holding git. Empty, '.' and relative entries are skipped: Windows
// resolves a bare `git` through the cwd first, and the cwd is a cloned project.
function findGit() {
  const exe = process.platform === 'win32' ? 'git.exe' : 'git';
  for (const raw of (process.env.PATH ?? '').split(path.delimiter)) {
    const dir = raw.trim().replace(/^"(.*)"$/, '$1');
    if (!dir || dir === '.' || !path.isAbsolute(dir)) continue;
    const full = path.join(dir, exe);
    try { if (fs.statSync(full).isFile()) return full; } catch { /* next entry */ }
  }
  return null;
}

// What a process needs, plus GIT_TRACE* and GIT_CEILING_DIRECTORIES; every other GIT_* is dropped.
function gitEnv() {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    const k = key.toUpperCase();
    if (ENV_ALLOWED.has(k) || k.startsWith('LC_') || k.startsWith('GIT_TRACE')) env[key] = value;
  }
  return { ...env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' };
}

// { out } on success; { fail: 'unavailable' | 'git failed' | 'exit', status } otherwise.
function run(ctx, args, input) {
  const res = spawnSync(ctx.git, ['--no-pager', '--literal-pathspecs', ...args], {
    cwd: ctx.cwd, env: ctx.env, input, maxBuffer: MAX_BUFFER, timeout: TIMEOUT_MS, windowsHide: true, shell: false,
  });
  if (res.error) return { fail: res.error.code === 'ENOENT' ? 'unavailable' : 'git failed' };
  if (res.status !== 0) return { fail: 'exit', status: res.status };
  return { out: res.stdout };
}

// ---------- one ref ----------

// Shapes under `<prefix>sdlc/` that can carry an overlap; anything else in the tree is not read.
function classify(rel) {
  const p = rel.split('/');
  if (p.length === 3 && p[0] === 'specs' && p[2] === 'spec.md') return { kind: 'specs', name: p[1] };
  if (p.length === 4 && p[0] === 'changes' && p[1] === 'archive' && p[3] === 'change.md') return { kind: 'archived', name: p[2] };
  if (p.length === 3 && p[0] === 'changes' && p[1].toLowerCase() !== 'archive' && p[2] === 'change.md') return { kind: 'open', name: p[1] };
  return null;
}

function decode(body) {
  if (body.includes(0)) return null;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(body); } catch { return null; }
}

// Candidate files of one commit: { files: [{kind,name,oid}], ignored } or { skipped }.
function listCandidates(ctx, sha) {
  const base = `${ctx.prefix}sdlc/`;
  const res = run(ctx, ['ls-tree', '-r', '-z', '-l', '--full-tree', sha, '--', `${base}specs`, `${base}changes`]);
  if (res.fail) return { skipped: 'git failed' };
  const entries = res.out.toString('utf8').split('\0').filter(Boolean);
  const cands = [];
  for (const entry of entries) {
    const tab = entry.indexOf('\t');
    const m = tab < 0 ? null : TREE_META.exec(entry.slice(0, tab));
    if (!m) return { skipped: 'git failed' };
    const p = entry.slice(tab + 1);
    const cls = p.startsWith(base) ? classify(p.slice(base.length)) : null;
    if (cls) cands.push({ ...cls, mode: m[1], type: m[2], oid: m[3], size: m[4] === '-' ? Infinity : Number(m[4]) });
  }
  if (cands.length > MAX_FILES) return { skipped: 'too many files' };
  let ignored = 0;
  const files = [];
  for (const c of cands) {
    const regular = c.type === 'blob' && (c.mode === '100644' || c.mode === '100755');
    if (!SAFE_NAME.test(c.name) || !regular || c.size > MAX_BLOB) ignored++;
    else files.push(c);
  }
  return { files, ignored };
}

// oid -> text (null when it holds NUL or invalid UTF-8) for the oids, in one cat-file --batch.
function readBlobs(ctx, oids) {
  const texts = new Map();
  if (oids.length === 0) return texts;
  const res = run(ctx, ['cat-file', '--batch'], `${oids.join('\n')}\n`);
  if (res.fail) return null;
  const out = res.out;
  let pos = 0;
  for (const oid of oids) {
    const nl = out.indexOf(0x0a, pos);
    if (nl < 0) return null;
    const header = out.toString('latin1', pos, nl).split(' ');
    const size = Number(header[2]);
    if (header.length !== 3 || header[0] !== oid || header[1] !== 'blob' || !Number.isSafeInteger(size)) return null;
    if (nl + 1 + size > out.length) return null;
    texts.set(oid, decode(out.subarray(nl + 1, nl + 1 + size)));
    pos = nl + 1 + size + 1;
  }
  return texts;
}

function refAge(ctx, sha) {
  const res = run(ctx, ['log', '-1', '--no-show-signature', '--format=%cr', sha, '--']);
  const age = res.out ? res.out.toString('utf8').trim() : '';
  return res.fail ? null : (age || 'unknown');
}

function readOneRef(ctx, ref) {
  const skip = (why) => ({ ref, age: null, skipped: why, data: null });
  const head = run(ctx, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  if (head.fail === 'unavailable') return skip('git not available');
  if (head.fail === 'git failed') return skip('git failed');
  if (head.fail === 'exit') {
    const any = run(ctx, ['rev-parse', '--verify', '--quiet', ref]);
    return skip(any.fail ? 'no such ref' : 'not a commit');
  }
  const sha = head.out.toString('utf8').trim();
  if (!OID.test(sha)) return skip('git failed');
  const age = refAge(ctx, sha);
  if (age === null) return skip('git failed');
  const listed = listCandidates(ctx, sha);
  if (listed.skipped) return skip(listed.skipped);
  const texts = readBlobs(ctx, [...new Set(listed.files.map((f) => f.oid))]);
  if (!texts) return skip('git failed');
  const data = { specs: [], archived: [], open: [], ignored: listed.ignored };
  for (const f of listed.files) {
    const text = texts.get(f.oid);
    if (text === null) { data.ignored++; continue; }
    if (f.kind === 'specs') data.specs.push({ capability: f.name, text });
    else if (f.kind === 'archived') data.archived.push({ folder: f.name, text });
    else data.open.push({ id: f.name, text });
  }
  return { ref, age, skipped: null, data };
}

/**
 * readRefs(projectRoot, refs) -> [{ ref, age, skipped, data }]  (one per entry, in order)
 * `data` = { specs:[{capability,text}], archived:[{folder,text}], open:[{id,text}], ignored } or
 * null when `skipped` is one of the closed reasons. Starts no git process unless a name is valid.
 */
export function readRefs(projectRoot, refs) {
  let ctx = null;
  let fatal = null;
  return refs.map((ref, i) => {
    const skip = (why) => ({ ref, age: null, skipped: why, data: null });
    if (i >= MAX_REFS) return skip('too many refs');
    if (!isRefName(ref)) return skip('not a ref name');
    if (!ctx && !fatal) {
      const git = findGit();
      if (!git) fatal = 'git not available';
      else {
        const base = { git, cwd: projectRoot, env: gitEnv(), prefix: '' };
        const pre = run(base, ['rev-parse', '--show-prefix']);
        if (pre.fail === 'exit') fatal = 'not a git repository';
        else if (pre.fail) fatal = pre.fail === 'unavailable' ? 'git not available' : 'git failed';
        else {
          const partial = run(base, ['config', '--get-regexp', PARTIAL_KEYS]);
          if (!partial.fail) fatal = 'partial clone';
          else if (partial.fail === 'exit' && partial.status === 1) ctx = { ...base, prefix: pre.out.toString('utf8').replace(/[\r\n]+$/, '') };
          else fatal = 'git failed';
        }
      }
    }
    return fatal ? skip(fatal) : readOneRef(ctx, ref);
  });
}

// ---------- this branch, config, the report ----------

const readText = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } };
const dirNames = (dir) => {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; }
};

function readLocal(sdlcRoot) {
  const specs = dirNames(path.join(sdlcRoot, 'specs'))
    .map((capability) => ({ capability, text: readText(path.join(sdlcRoot, 'specs', capability, 'spec.md')) }));
  const open = listOpenChangeIds(sdlcRoot)
    .map((id) => ({ id, text: readText(path.join(sdlcRoot, 'changes', id, 'change.md')) }));
  return { specs, archived: dirNames(path.join(sdlcRoot, 'changes', 'archive')), open };
}

/** overlapConfig(projectRoot) -> { state: 'unset' | 'not-list' | 'list', refs } from config.yaml. */
export function overlapConfig(projectRoot) {
  const value = parseConfig(readText(path.join(projectRoot, 'sdlc', 'config.yaml'))).overlapBranches;
  if (value === undefined || (Array.isArray(value) && value.length === 0)) return { state: 'unset', refs: [] };
  if (!Array.isArray(value)) return { state: 'not-list', refs: [] };
  return { state: 'list', refs: value };
}

/**
 * overlapReport(projectRoot, refs, ids) -> [{ ref, age, skipped, results }]
 * Reads each ref once; `results` is a Map<changeId, { hits, ignored }> for every id in `ids` (open
 * changes of this project), empty when the ref was skipped. A hit is { kind, id, capability,
 * requirements } in the contract order; `id` is null for a `spec` hit (decide it by `capability`;
 * lib/overlap.mjs hasOverlapDecision(changeText, ref, hit) takes this hit as it is).
 */
export function overlapReport(projectRoot, refs, ids) {
  const read = readRefs(projectRoot, refs);
  if (read.every((r) => r.skipped)) return read.map((r) => ({ ref: r.ref, age: r.age, skipped: r.skipped, results: new Map() }));
  const local = readLocal(path.join(projectRoot, 'sdlc'));
  const text = new Map(local.open.map((o) => [o.id, o.text]));
  return read.map((r) => {
    const results = new Map();
    if (!r.skipped) {
      for (const id of ids) {
        const { hits, ignored } = compareRef({ self: { id, delta: text.get(id) ?? '' }, local, ref: r.data });
        results.set(id, { hits: hits.map((h) => (h.kind === 'spec' ? { ...h, id: null } : h)), ignored });
      }
    }
    return { ref: r.ref, age: r.age, skipped: r.skipped, results };
  });
}

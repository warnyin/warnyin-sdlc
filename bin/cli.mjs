#!/usr/bin/env node
// @warnyin/sdlc CLI — OpenSpec-style installer + lifecycle mechanics.
// Zero-dependency, Node >= 20, cross-platform. Exported functions are pure
// where possible so tests can exercise them; `main()` is guarded.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from '../lib/frontmatter.mjs';
import { parseDelta, mergeDelta } from '../lib/delta.mjs';
import { mergeHookSettings } from '../lib/settings-merge.mjs';
import { buildReport, renderReport } from '../lib/observe.mjs';
import { validateAll, formatIssues, listChangeDirs } from '../lib/validate.mjs';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAYLOAD = path.join(PKG_ROOT, 'payload');

export const TOOLS = Object.freeze([
  'claude', 'cursor', 'windsurf', 'copilot', 'cline', 'gemini', 'agents-md',
]);

const TEXT_EXT = new Set(['.md', '.mjs', '.json', '.yaml', '.yml', '.txt']);

// ---------- small pure helpers ----------

export function normalizeEol(content) {
  return content.replace(/\r\n/g, '\n');
}

export function toPosix(p) {
  return p.split(path.sep).join('/');
}

export function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function parseArgs(argv) {
  const args = { _: [], tool: null, strict: false, force: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tool') args.tool = (argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--strict') args.strict = true;
    else if (a === '--force') args.force = true;
    else if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a.startsWith('--')) console.warn(`unknown flag ${a} (ignored)`);
    else args._.push(a);
  }
  return args;
}

// ---------- file ops (manifest-aware) ----------

function writeFileNormalized(dest, content) {
  const ext = path.extname(dest);
  const out = TEXT_EXT.has(ext) ? normalizeEol(content) : content;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, out);
  return out;
}

// Copy a payload tree into the target. Existing byte-different files are the
// user's and are never overwritten unless `overwrite` (update mode).
export function copyTree(srcDir, destDir, { overwrite = false, manifest = null, projectRoot = null } = {}) {
  if (!fs.existsSync(srcDir)) return;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyTree(src, dest, { overwrite, manifest, projectRoot });
      continue;
    }
    const content = normalizeEol(fs.readFileSync(src, 'utf8'));
    const exists = fs.existsSync(dest);
    if (exists && !overwrite) {
      const current = normalizeEol(fs.readFileSync(dest, 'utf8'));
      if (current !== content) continue; // user-owned, leave alone
    }
    const written = writeFileNormalized(dest, content);
    if (manifest && projectRoot) {
      manifest.set(toPosix(path.relative(projectRoot, dest)), sha256(written));
    }
  }
}

export function writeManifest(projectRoot, manifest) {
  const statePath = path.join(projectRoot, 'sdlc', '.state');
  fs.mkdirSync(statePath, { recursive: true });
  const lines = ['# @warnyin/sdlc manifest — sha256  path (posix, relative to project root)'];
  for (const [p, hash] of [...manifest.entries()].sort()) lines.push(`${hash}  ${p}`);
  fs.writeFileSync(path.join(statePath, 'manifest'), lines.join('\n') + '\n');
}

export function ensureGitignore(projectRoot) {
  const giPath = path.join(projectRoot, '.gitignore');
  const entry = 'sdlc/.state/';
  let current = fs.existsSync(giPath) ? fs.readFileSync(giPath, 'utf8') : '';
  if (current.split(/\r?\n/).some((l) => l.trim() === entry)) return;
  if (current && !current.endsWith('\n')) current += '\n';
  fs.writeFileSync(giPath, current + entry + '\n');
}

// ---------- init ----------

export async function resolveTools(args, { interactive = process.stdin.isTTY && process.stdout.isTTY } = {}) {
  if (args.tool?.length) {
    const bad = args.tool.filter((t) => !TOOLS.includes(t));
    if (bad.length) throw new Error(`unknown tool(s): ${bad.join(', ')} — valid: ${TOOLS.join(', ')}`);
    return args.tool;
  }
  if (!interactive) return ['claude'];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    rl.question(`Tools to set up [${TOOLS.join(', ')}] (comma-separated, default: claude): `, resolve);
  });
  rl.close();
  const picked = answer.split(',').map((s) => s.trim()).filter(Boolean);
  if (!picked.length) return ['claude'];
  const bad = picked.filter((t) => !TOOLS.includes(t));
  if (bad.length) throw new Error(`unknown tool(s): ${bad.join(', ')}`);
  return picked;
}

function scaffoldSdlc(projectRoot, tools, manifest) {
  const sdlcRoot = path.join(projectRoot, 'sdlc');
  for (const dir of ['context/steering', 'specs', 'changes/archive', 'evals', '.state']) {
    fs.mkdirSync(path.join(sdlcRoot, dir), { recursive: true });
  }

  const seed = (rel, templateName, transform = (s) => s) => {
    const dest = path.join(sdlcRoot, rel);
    if (fs.existsSync(dest)) return;
    const tpl = fs.readFileSync(path.join(PAYLOAD, 'templates', templateName), 'utf8');
    writeFileNormalized(dest, transform(tpl));
  };

  seed('config.yaml', 'config.yaml', (s) => s.replace('tools: []', `tools: [${tools.join(', ')}]`));
  seed('context/constitution.md', 'constitution.md');
  seed('harness.md', 'harness.md');

  // Playbook + hook scripts are payload-owned (manifest-tracked, refreshed by `update`).
  // lib/ is mirrored next to the hooks so they share the CLI's exact validator logic.
  copyTree(path.join(PAYLOAD, 'playbook'), path.join(sdlcRoot, '.playbook'), { manifest, projectRoot });
  copyTree(path.join(PAYLOAD, 'hooks'), path.join(sdlcRoot, '.hooks'), { manifest, projectRoot });
  copyTree(path.join(PKG_ROOT, 'lib'), path.join(sdlcRoot, '.hooks', 'lib'), { manifest, projectRoot });
}

export function installClaudeHooks(projectRoot) {
  const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
  let current = {};
  if (fs.existsSync(settingsPath)) {
    try {
      current = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      throw new Error(`.claude/settings.json is not valid JSON — fix it, then re-run init`);
    }
  }
  const merged = mergeHookSettings(current);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + '\n');
}

function installClaudeAdapter(projectRoot, manifest) {
  const src = path.join(PAYLOAD, 'adapters', 'claude');
  copyTree(path.join(src, 'commands'), path.join(projectRoot, '.claude', 'commands'), { manifest, projectRoot });
  copyTree(path.join(src, 'skills'), path.join(projectRoot, '.claude', 'skills'), { manifest, projectRoot });
  copyTree(path.join(src, 'agents'), path.join(projectRoot, '.claude', 'agents'), { manifest, projectRoot });
}

export async function cmdInit(projectRoot, args) {
  const tools = await resolveTools(args);
  const manifest = new Map();
  scaffoldSdlc(projectRoot, tools, manifest);
  if (tools.includes('claude')) {
    installClaudeAdapter(projectRoot, manifest);
    installClaudeHooks(projectRoot);
  }
  // Other tool adapters land in M5; record the selection now.
  writeManifest(projectRoot, manifest);
  ensureGitignore(projectRoot);
  console.log(`sdlc/ initialized for: ${tools.join(', ')}`);
  console.log('Next: open your coding agent and run /sdlc:init to write your constitution and harness.');
  return { tools };
}

// ---------- status ----------

export function readChanges(sdlcRoot) {
  return listChangeDirs(sdlcRoot).map((dir) => {
    const changePath = path.join(dir, 'change.md');
    const id = path.basename(dir);
    if (!fs.existsSync(changePath)) return { id, tier: '?', status: '?', title: '(missing change.md)' };
    const raw = fs.readFileSync(changePath, 'utf8');
    const { data, body } = parseFrontmatter(raw);
    const title = body.match(/^# Change:\s*(.+)$/m)?.[1] ?? '';
    return { id, tier: data.tier ?? '?', status: data.status ?? '?', title };
  });
}

export function cmdStatus(projectRoot, { json = false } = {}) {
  const sdlcRoot = path.join(projectRoot, 'sdlc');
  requireSdlc(sdlcRoot);
  const changes = readChanges(sdlcRoot);
  const archiveDir = path.join(sdlcRoot, 'changes', 'archive');
  const archived = fs.existsSync(archiveDir)
    ? fs.readdirSync(archiveDir, { withFileTypes: true }).filter((d) => d.isDirectory()).length
    : 0;
  if (json) {
    console.log(JSON.stringify({ changes, archived }, null, 2));
  } else if (!changes.length) {
    console.log(`No active changes (${archived} archived). Start one with /sdlc:new or /sdlc:auto.`);
  } else {
    for (const c of changes) console.log(`${c.id}  [${c.tier}/${c.status}]  ${c.title}`);
    console.log(`${changes.length} active · ${archived} archived`);
  }
  return { changes, archived };
}

// ---------- archive (= mechanical part of ship) ----------

export function appendJournal(changeDir, event) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event });
  fs.appendFileSync(path.join(changeDir, 'journal.ndjson'), line + '\n');
}

export function cmdArchive(projectRoot, changeId, { strict = true } = {}) {
  const sdlcRoot = path.join(projectRoot, 'sdlc');
  requireSdlc(sdlcRoot);
  if (!changeId) throw new Error('usage: warnyin-sdlc archive <change-id>');
  const changeDir = path.join(sdlcRoot, 'changes', changeId);
  if (!fs.existsSync(changeDir)) throw new Error(`change "${changeId}" not found`);

  const issues = validateAll(sdlcRoot, { strict, changeId });
  const errors = issues.filter((i) => i.level === 'error');
  if (errors.length) {
    console.error(formatIssues(errors));
    throw new Error(`validate --strict failed with ${errors.length} error(s) — not archiving`);
  }

  const changeText = fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8');
  const { deltas, errors: parseErrors } = parseDelta(changeText);
  if (parseErrors.length) throw new Error(`delta parse errors: ${parseErrors.join('; ')}`);

  // Phase 1: compute every merge before writing anything (all-or-nothing).
  const merged = [];
  for (const d of deltas) {
    const specPath = path.join(sdlcRoot, 'specs', d.capability, 'spec.md');
    const specText = fs.existsSync(specPath) ? fs.readFileSync(specPath, 'utf8') : null;
    const result = mergeDelta(specText, d.ops, d.capability);
    if (!result.ok) throw new Error(`spec merge failed for "${d.capability}": ${result.errors.join('; ')}`);
    merged.push({ specPath, content: result.content, capability: d.capability });
  }

  // Phase 2: write specs, promote evals, stamp status, move to archive.
  for (const m of merged) writeFileNormalized(m.specPath, m.content);

  const evalsSrc = path.join(changeDir, 'contract', 'evals.md');
  if (fs.existsSync(evalsSrc)) {
    for (const m of merged) {
      const rubricDest = path.join(sdlcRoot, 'evals', m.capability, 'rubric.md');
      if (!fs.existsSync(rubricDest)) {
        writeFileNormalized(rubricDest, fs.readFileSync(evalsSrc, 'utf8'));
      }
    }
  }

  const stamped = changeText.replace(/^status:\s*.*$/m, 'status: shipped');
  writeFileNormalized(path.join(changeDir, 'change.md'), stamped);
  appendJournal(changeDir, { event: 'ship', change: changeId, specs: merged.map((m) => m.capability) });

  const date = new Date().toISOString().slice(0, 10);
  const destDir = path.join(sdlcRoot, 'changes', 'archive', `${date}-${changeId}`);
  if (fs.existsSync(destDir)) throw new Error(`archive target already exists: ${toPosix(path.relative(projectRoot, destDir))}`);
  fs.renameSync(changeDir, destDir);

  console.log(`shipped: ${changeId}`);
  for (const m of merged) console.log(`  spec merged: specs/${m.capability}/spec.md`);
  console.log(`  archived: changes/archive/${date}-${changeId}/`);
  return { archived: `${date}-${changeId}`, specs: merged.map((m) => m.capability) };
}

// ---------- observe ----------

export function cmdObserve(projectRoot, { json = false } = {}) {
  const sdlcRoot = path.join(projectRoot, 'sdlc');
  requireSdlc(sdlcRoot);
  const report = buildReport(sdlcRoot);
  console.log(json ? JSON.stringify(report, null, 2) : renderReport(report));
  return report;
}

// ---------- shared ----------

function requireSdlc(sdlcRoot) {
  if (!fs.existsSync(sdlcRoot)) {
    throw new Error('No sdlc/ directory here — run `npx @warnyin/sdlc init` first.');
  }
}

function runValidate(projectRoot, args) {
  const validator = path.join(PKG_ROOT, 'scripts', 'validate.mjs');
  const spawnArgs = [validator, ...(args._.slice(1)), ...(args.strict ? ['--strict'] : []), '--root', projectRoot];
  const res = spawnSync(process.execPath, spawnArgs, { stdio: 'inherit' });
  process.exitCode = res.status ?? 0;
}

const HELP = `@warnyin/sdlc — spec-driven AI-SDLC framework

usage: warnyin-sdlc <command> [options]

  init [--tool claude,cursor,...]   scaffold sdlc/ + adapters + hooks into this project
  validate [id] [--strict]          structural validation (caps, delta grammar, gates)
  status [--json]                   list active changes and their stage
  observe [--json]                  tokens/cost per change, residency, steering hits, drift flags
  archive <id>                      merge delta specs into living specs and archive the change
  help                              this text
`;

export async function main(argv = process.argv.slice(2), projectRoot = process.cwd()) {
  const args = parseArgs(argv);
  const cmd = args._[0];
  if (args.help || !cmd || cmd === 'help') { console.log(HELP); return; }
  try {
    if (cmd === 'init') await cmdInit(projectRoot, args);
    else if (cmd === 'validate') runValidate(projectRoot, args);
    else if (cmd === 'status') cmdStatus(projectRoot, { json: args.json });
    else if (cmd === 'observe') cmdObserve(projectRoot, { json: args.json });
    else if (cmd === 'archive') cmdArchive(projectRoot, args._[1]);
    else { console.error(`unknown command: ${cmd}`); console.log(HELP); process.exitCode = 2; }
  } catch (err) {
    console.error(String(err.message ?? err));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

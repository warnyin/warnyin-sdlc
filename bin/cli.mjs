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
import { parseConfig } from '../lib/config.mjs';
import { mergeHookSettings } from '../lib/settings-merge.mjs';
import { buildReport, renderReport } from '../lib/observe.mjs';
import { parseManifest, renderManifest, computeStale, containedIn, hasSymlinkSegment, PRUNE_BLAST_CAP } from '../lib/manifest.mjs';
import { validateAll, formatIssues, listChangeDirs } from '../lib/validate.mjs';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAYLOAD = path.join(PKG_ROOT, 'payload');
const MARKER = '<!-- sdlc:start -->';

export const TOOLS = Object.freeze([
  'claude', 'cursor', 'windsurf', 'copilot', 'cline', 'gemini', 'agents-md',
]);

const TEXT_EXT = new Set(['.md', '.mdc', '.mjs', '.json', '.yaml', '.yml', '.txt']);

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
  const args = { _: [], tool: null, strict: false, force: false, json: false, help: false };
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

// ---------- payload-owned file installation (ownership semantics) ----------
// install mode: missing → write · byte-equal → claim · different → user's, keep.
// update mode:  additionally, disk == old manifest hash (ours, unmodified) → refresh.

function writeFileNormalized(dest, content) {
  const ext = path.extname(dest);
  const out = TEXT_EXT.has(ext) ? normalizeEol(content) : content;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, out);
  return out;
}

export function installFile(projectRoot, destRel, content, ctx) {
  const relPosix = toPosix(destRel);
  const dest = path.join(projectRoot, destRel);
  const next = normalizeEol(content);
  const nextHash = sha256(next);

  if (!fs.existsSync(dest)) {
    writeFileNormalized(dest, next);
    ctx.manifest.set(relPosix, nextHash);
    return 'written';
  }
  const current = normalizeEol(fs.readFileSync(dest, 'utf8'));
  const currentHash = sha256(current);
  if (currentHash === nextHash) {
    ctx.manifest.set(relPosix, nextHash);
    return 'current';
  }
  if (ctx.mode === 'update' && ctx.oldManifest?.get(relPosix) === currentHash) {
    writeFileNormalized(dest, next);
    ctx.manifest.set(relPosix, nextHash);
    return 'updated';
  }
  ctx.warnings.push(`kept (user-modified): ${relPosix}`);
  return 'kept';
}

function copyTree(srcDir, destDirRel, projectRoot, ctx) {
  if (!fs.existsSync(srcDir)) return;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const destRel = path.join(destDirRel, entry.name);
    if (entry.isDirectory()) copyTree(src, destRel, projectRoot, ctx);
    else installFile(projectRoot, destRel, fs.readFileSync(src, 'utf8'), ctx);
  }
}

function payloadText(rel) {
  return normalizeEol(fs.readFileSync(path.join(PAYLOAD, rel), 'utf8'));
}

// ---------- adapters ----------

function renderAdapter(templateRel) {
  return payloadText(templateRel).replace('{{RULES_CARD}}', payloadText('playbook/rules-card.md').trim());
}

// Marker adapters live inside user-owned files: append once, never rewrite.
function appendWithMarker(projectRoot, destRel, content) {
  const dest = path.join(projectRoot, destRel);
  if (fs.existsSync(dest)) {
    const current = fs.readFileSync(dest, 'utf8');
    if (current.includes(MARKER)) return 'present';
    const sep = current.endsWith('\n') ? '\n' : '\n\n';
    fs.writeFileSync(dest, current + sep + normalizeEol(content));
    return 'appended';
  }
  writeFileNormalized(dest, content);
  return 'written';
}

export function installClaudeHooks(projectRoot) {
  const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
  let current = {};
  if (fs.existsSync(settingsPath)) {
    try {
      current = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      throw new Error('.claude/settings.json is not valid JSON — fix it, then re-run init');
    }
  }
  const merged = mergeHookSettings(current);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + '\n');
}

function installToolAdapters(projectRoot, tools, ctx) {
  if (tools.includes('claude')) {
    copyTree(path.join(PAYLOAD, 'adapters/claude/commands'), path.join('.claude', 'commands'), projectRoot, ctx);
    copyTree(path.join(PAYLOAD, 'adapters/claude/skills'), path.join('.claude', 'skills'), projectRoot, ctx);
    copyTree(path.join(PAYLOAD, 'adapters/claude/agents'), path.join('.claude', 'agents'), projectRoot, ctx);
    installClaudeHooks(projectRoot);
  }
  if (tools.includes('cursor')) {
    installFile(projectRoot, path.join('.cursor', 'rules', 'sdlc.mdc'), renderAdapter('adapters/cursor.mdc'), ctx);
  }
  if (tools.includes('windsurf')) {
    installFile(projectRoot, path.join('.windsurf', 'rules', 'sdlc.md'), renderAdapter('adapters/windsurf.md'), ctx);
  }
  if (tools.includes('copilot')) {
    appendWithMarker(projectRoot, path.join('.github', 'copilot-instructions.md'), renderAdapter('adapters/copilot.md'));
  }
  if (tools.includes('cline')) {
    appendWithMarker(projectRoot, '.clinerules', renderAdapter('adapters/cline.md'));
  }
  if (tools.includes('gemini')) {
    appendWithMarker(projectRoot, 'GEMINI.md', renderAdapter('adapters/gemini.md'));
  }
  if (tools.includes('agents-md')) {
    appendWithMarker(projectRoot, 'AGENTS.md', renderAdapter('adapters/agents-md.md'));
  }
}

// ---------- scaffold ----------

function scaffoldSdlc(projectRoot, tools, ctx) {
  const sdlcRoot = path.join(projectRoot, 'sdlc');
  for (const dir of ['context/steering', 'specs', 'changes/archive', 'evals', '.state']) {
    fs.mkdirSync(path.join(sdlcRoot, dir), { recursive: true });
  }

  // Seeds are user-owned from birth: created once, never manifested/overwritten.
  const seed = (rel, templateName, transform = (s) => s) => {
    const dest = path.join(sdlcRoot, rel);
    if (fs.existsSync(dest)) return;
    writeFileNormalized(dest, transform(payloadText(`templates/${templateName}`)));
  };
  seed('config.yaml', 'config.yaml', (s) => s.replace('tools: []', `tools: [${tools.join(', ')}]`));
  seed('context/constitution.md', 'constitution.md');
  seed('harness.md', 'harness.md');

  // Payload-owned trees (manifested, refreshed by `update`).
  copyTree(path.join(PAYLOAD, 'playbook'), path.join('sdlc', '.playbook'), projectRoot, ctx);
  copyTree(path.join(PAYLOAD, 'templates'), path.join('sdlc', '.playbook', 'templates'), projectRoot, ctx);
  copyTree(path.join(PAYLOAD, 'hooks'), path.join('sdlc', '.hooks'), projectRoot, ctx);
  copyTree(path.join(PKG_ROOT, 'lib'), path.join('sdlc', '.hooks', 'lib'), projectRoot, ctx);
}

export function writeManifestFile(projectRoot, manifest) {
  const statePath = path.join(projectRoot, 'sdlc', '.state');
  fs.mkdirSync(statePath, { recursive: true });
  fs.writeFileSync(path.join(statePath, 'manifest'), renderManifest(manifest));
}

export function readManifestFile(projectRoot) {
  const p = path.join(projectRoot, 'sdlc', '.state', 'manifest');
  return fs.existsSync(p) ? parseManifest(fs.readFileSync(p, 'utf8')) : new Map();
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

export async function cmdInit(projectRoot, args) {
  const tools = await resolveTools(args);
  const ctx = { mode: 'install', manifest: new Map(), oldManifest: readManifestFile(projectRoot), warnings: [] };
  scaffoldSdlc(projectRoot, tools, ctx);
  installToolAdapters(projectRoot, tools, ctx);
  writeManifestFile(projectRoot, ctx.manifest);
  ensureGitignore(projectRoot);
  for (const w of ctx.warnings) console.warn(`  ${w}`);
  console.log(`sdlc/ initialized for: ${tools.join(', ')}`);
  console.log('Next: open your coding agent and run /sdlc:init to write your constitution and harness.');
  return { tools };
}

// ---------- update + prune ----------

export function cmdUpdate(projectRoot, args) {
  const sdlcRoot = path.join(projectRoot, 'sdlc');
  requireSdlc(sdlcRoot);
  const config = parseConfig(fs.readFileSync(path.join(sdlcRoot, 'config.yaml'), 'utf8'));
  const tools = args.tool?.length ? args.tool : (config.tools.length ? config.tools : ['claude']);

  // Persist an explicit --tool override so declared and installed state never
  // diverge (otherwise pruning tool-specific files leaves config.yaml stale).
  if (args.tool?.length) {
    const configPath = path.join(sdlcRoot, 'config.yaml');
    const raw = fs.readFileSync(configPath, 'utf8');
    fs.writeFileSync(configPath, raw.replace(/^tools:.*$/m, `tools: [${tools.join(', ')}]`));
  }

  const oldManifest = readManifestFile(projectRoot);
  const ctx = { mode: 'update', manifest: new Map(), oldManifest, warnings: [] };
  scaffoldSdlc(projectRoot, tools, ctx);
  installToolAdapters(projectRoot, tools, ctx);

  // Prune: old-manifest entries no longer in the payload, guarded six ways.
  const { stale, rejected, overCap } = computeStale(oldManifest, new Set(ctx.manifest.keys()));
  for (const r of rejected) ctx.warnings.push(`prune rejected: ${r.path} (${r.reason})`);
  let pruned = 0;
  if (overCap && !args.force) {
    ctx.warnings.push(`prune skipped: ${stale.length} stale files exceed the blast cap (${PRUNE_BLAST_CAP}) — re-run with --force after reviewing`);
  } else {
    const realRoot = fs.realpathSync.native(projectRoot);
    const nominalRoot = path.resolve(projectRoot);
    for (const { path: relPath, hash } of stale) {
      const abs = path.join(projectRoot, relPath);
      if (!fs.existsSync(abs)) continue;
      if (hasSymlinkSegment(nominalRoot, abs)) {
        ctx.warnings.push(`prune rejected: ${relPath} (symlink in path)`);
        continue;
      }
      const diskHash = sha256(normalizeEol(fs.readFileSync(abs, 'utf8')));
      if (diskHash !== hash) { ctx.warnings.push(`prune kept (modified): ${relPath}`); continue; }
      const realAbs = fs.realpathSync.native(abs);
      if (!containedIn(realRoot, realAbs)) { ctx.warnings.push(`prune rejected: ${relPath} (escapes project)`); continue; }
      fs.rmSync(abs);
      pruned++;
      let dir = path.dirname(abs);
      while (containedIn(realRoot, dir)) {
        try { fs.rmdirSync(dir); } catch { break; }
        dir = path.dirname(dir);
      }
    }
  }

  writeManifestFile(projectRoot, ctx.manifest);
  for (const w of ctx.warnings) console.warn(`  ${w}`);
  console.log(`updated for: ${tools.join(', ')} · payload files: ${ctx.manifest.size} · pruned: ${pruned}`);
  return { pruned, warnings: ctx.warnings };
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

// ---------- observe ----------

export function cmdObserve(projectRoot, { json = false } = {}) {
  const sdlcRoot = path.join(projectRoot, 'sdlc');
  requireSdlc(sdlcRoot);
  const report = buildReport(sdlcRoot);
  console.log(json ? JSON.stringify(report, null, 2) : renderReport(report));
  return report;
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

  // Atomicity: the archive destination must be checked BEFORE any write —
  // otherwise a same-day id collision would mutate specs and stamp the change
  // while reporting failure.
  const date = new Date().toISOString().slice(0, 10);
  const destDir = path.join(sdlcRoot, 'changes', 'archive', `${date}-${changeId}`);
  if (fs.existsSync(destDir)) {
    throw new Error(`archive target already exists: ${toPosix(path.relative(projectRoot, destDir))} — nothing was merged`);
  }

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

  fs.renameSync(changeDir, destDir);

  console.log(`shipped: ${changeId}`);
  for (const m of merged) console.log(`  spec merged: specs/${m.capability}/spec.md`);
  console.log(`  archived: changes/archive/${date}-${changeId}/`);
  return { archived: `${date}-${changeId}`, specs: merged.map((m) => m.capability) };
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
  update [--tool ...] [--force]     refresh payload-owned files, prune stale ones (guarded)
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
    else if (cmd === 'update') cmdUpdate(projectRoot, args);
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

#!/usr/bin/env node
// @warnyin/sdlc CLI — OpenSpec-style installer + lifecycle mechanics.
// Zero-dependency, Node >= 20, cross-platform. Exported functions are pure
// where possible so tests can exercise them; `main()` is guarded.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from '../lib/frontmatter.mjs';
import { parseDelta, mergeDelta } from '../lib/delta.mjs';
import { parseConfig } from '../lib/config.mjs';
import { mergeHookSettings } from '../lib/settings-merge.mjs';
import { buildReport, renderReport } from '../lib/observe.mjs';
import { parseManifest, renderManifest, computeStale, containedIn, hasSymlinkSegment, PRUNE_BLAST_CAP } from '../lib/manifest.mjs';
import { validateAll, formatIssues, listChangeDirs } from '../lib/validate.mjs';
import {
  readChangeJournal, liveJournalPath, sealedJournalPath, serializeJournal, appendEvent,
  isSafeChangeId,
} from '../lib/journal.mjs';
import { resolveActive, clearPointersFor } from '../lib/active.mjs';
import { scanInventory, renderInventory } from '../lib/skills.mjs';
import { detectTools, toolName } from './detect.mjs';
import { colorEnabled, createStyle, symbolsFor, summarizeInstall, startHints } from './ui.mjs';
import { multiSelect } from './multiselect.mjs';
import { sliceChangelog } from './changelog.mjs';
import { parseVersion, compareVersions } from '../lib/version.mjs';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAYLOAD = path.join(PKG_ROOT, 'payload');
const MARKER = '<!-- sdlc:start -->';
const OWN_PACKAGE_NAME = '@warnyin/sdlc';

export const TOOLS = Object.freeze([
  'claude', 'cursor', 'windsurf', 'copilot', 'cline', 'gemini', 'agents-md', 'kimi',
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
  const args = { _: [], tool: null, toolProvided: false, strict: false, force: false, json: false, help: false, version: false, since: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tool' || a === '--tools') {
      args.toolProvided = true;
      args.tool = (argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    }
    else if (a === '--since') args.since = (argv[++i] ?? '').trim() || null;
    else if (a === '--strict') args.strict = true;
    else if (a === '--force') args.force = true;
    else if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--version' || a === '-v') args.version = true;
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

function tally(ctx, outcome) {
  if (ctx.stats) ctx.stats[outcome] = (ctx.stats[outcome] ?? 0) + 1;
  return outcome;
}

export function installFile(projectRoot, destRel, content, ctx) {
  const relPosix = toPosix(destRel);
  const dest = path.join(projectRoot, destRel);
  const next = normalizeEol(content);
  const nextHash = sha256(next);

  if (!fs.existsSync(dest)) {
    writeFileNormalized(dest, next);
    ctx.manifest.set(relPosix, nextHash);
    return tally(ctx, 'written');
  }
  const current = normalizeEol(fs.readFileSync(dest, 'utf8'));
  const currentHash = sha256(current);
  if (currentHash === nextHash) {
    ctx.manifest.set(relPosix, nextHash);
    return tally(ctx, 'current');
  }
  if (ctx.mode === 'update' && ctx.oldManifest?.get(relPosix) === currentHash) {
    writeFileNormalized(dest, next);
    ctx.manifest.set(relPosix, nextHash);
    return tally(ctx, 'updated');
  }
  // Keeping the content must not forget the ownership. Dropping the entry made
  // the next run see a file we had never installed, which permanently disarmed
  // update's refresh branch (disk hash === old manifest hash) — the file froze
  // at its old payload version and every later run relabelled it user-modified.
  // The recorded hash stays the one we last wrote, so prune's "disk must match
  // the manifest" guard still refuses to touch a file the user really did edit.
  const owned = ctx.oldManifest?.get(relPosix);
  if (owned) ctx.manifest.set(relPosix, owned);
  // Matching the recorded hash proves nobody touched it — `install` simply does
  // not refresh. Calling that "user-modified" sent people hunting for an edit
  // they never made.
  ctx.warnings.push(owned === currentHash
    ? `kept (ours, older version — run \`npx @warnyin/sdlc update\` to refresh): ${relPosix}`
    : `kept (user-modified): ${relPosix}`);
  return tally(ctx, 'kept');
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
  if (tools.includes('kimi')) {
    installFile(projectRoot, path.join('.kimi-code', 'AGENTS.md'), renderAdapter('adapters/kimi.md'), ctx);
  }
}

// ---------- scaffold ----------

function scaffoldSdlc(projectRoot, tools, ctx) {
  const sdlcRoot = path.join(projectRoot, 'sdlc');
  for (const dir of ['context/steering', 'specs', 'changes/archive', 'evals', '.state']) {
    fs.mkdirSync(path.join(sdlcRoot, dir), { recursive: true });
  }

  // git does not track empty directories, so changes/archive/ vanishes for
  // anyone who clones before the first change ships. Not manifested: an empty
  // marker is nothing for prune to reclaim or for the installer to warn about.
  const gitkeep = path.join(sdlcRoot, 'changes', 'archive', '.gitkeep');
  if (!fs.existsSync(gitkeep)) fs.writeFileSync(gitkeep, '');

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
  recordPayloadVersion(projectRoot, ctx);
}

// The hooks carry no package.json; the update notice compares against this. It is a record
// the CLI writes, not a user file, so it is rewritten every run instead of going through
// installFile's keep-if-different rule — otherwise a hand edit, or a clone whose gitignored
// manifest is missing, would freeze it and the notice would repeat after every update.
function recordPayloadVersion(projectRoot, ctx) {
  const rel = path.join('sdlc', '.hooks', 'version.json');
  const content = `${JSON.stringify({ version: pkgVersion() })}\n`;
  writeFileNormalized(path.join(projectRoot, rel), content);
  ctx.manifest.set(toPosix(rel), sha256(content));
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

// `all` / `none` are reserved words, never combinable with a list — mixing
// them would leave the caller guessing which one won.
export function resolveToolList(picked) {
  const reserved = picked.filter((t) => t === 'all' || t === 'none');
  if (reserved.length && picked.length > 1) {
    throw new Error(`"${reserved[0]}" cannot be combined with other tools`);
  }
  if (picked[0] === 'all') return [...TOOLS];
  if (picked[0] === 'none') return [];
  if (!picked.length) throw new Error(`--tool requires a value: all, none, or any of ${TOOLS.join(', ')}`);
  const bad = picked.filter((t) => !TOOLS.includes(t));
  if (bad.length) throw new Error(`unknown tool(s): ${bad.join(', ')} — valid: ${TOOLS.join(', ')}, all, none`);
  return [...new Set(picked)];
}

export async function resolveTools(args, {
  interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY),
  projectRoot = process.cwd(),
  style = createStyle(false),
} = {}) {
  if (args.toolProvided) return resolveToolList(args.tool ?? []);
  if (!interactive) return ['claude'];

  const detected = detectTools(projectRoot);
  if (detected.length) {
    console.log(style.dim(`Detected in this project: ${detected.map(toolName).join(', ')} (pre-selected)`));
  }
  const choices = TOOLS.map((tool) => ({
    value: tool,
    name: toolName(tool),
    note: detected.includes(tool) ? 'detected' : '',
    // First-time setup with nothing detected still needs a sane default.
    preSelected: detected.length ? detected.includes(tool) : tool === 'claude',
  }));
  const picked = await multiSelect({ choices, style, symbols: symbolsFor() });
  if (picked === null) throw new Error('cancelled — nothing was installed');
  return picked;
}

function printInitSummary(tools, ctx, style, symbols, { configExisted }) {
  const s = summarizeInstall(ctx.manifest.keys(), tools);
  const stats = ctx.stats;
  const line = (text) => console.log(`  ${text}`);

  console.log('');
  console.log(`  ${style.green(symbols.tick)} ${style.bold('SDLC Setup Complete')}`);
  console.log('');
  line(`Tools: ${tools.length ? tools.map(toolName).join(', ') : style.dim('none (framework only)')}`);
  if (s.commands || s.skills || s.agents) {
    line(`${s.commands} commands, ${s.skills} skills and ${s.agents} agents in .claude/`);
  }
  for (const a of s.adapters.filter((a) => a.tool !== 'claude')) {
    line(`Rules for ${toolName(a.tool)}: ${a.path}`);
  }
  line(`${s.hooks} hooks in sdlc/.hooks/`);
  line(`Playbook: sdlc/.playbook/ (${s.playbook} stages + ${s.templates} templates)`);
  line(`Config: sdlc/config.yaml${configExisted ? ' (kept)' : ''}`);
  line(style.dim(`Files: ${stats.written} written · ${stats.current} unchanged · ${stats.updated} refreshed · ${stats.kept} kept (yours)`));
  console.log('');
  console.log(`  ${style.bold('Getting started:')}`);
  startHints(tools).forEach((hint, i) => line(`  ${i + 1}. ${hint}`));
  console.log('');
}

export async function cmdInit(projectRoot, args) {
  const style = createStyle(colorEnabled());
  const symbols = symbolsFor();
  const tools = await resolveTools(args, { projectRoot, style });
  const configExisted = fs.existsSync(path.join(projectRoot, 'sdlc', 'config.yaml'));
  const ctx = {
    mode: 'install',
    manifest: new Map(),
    oldManifest: readManifestFile(projectRoot),
    warnings: [],
    stats: { written: 0, current: 0, updated: 0, kept: 0 },
  };
  scaffoldSdlc(projectRoot, tools, ctx);
  installToolAdapters(projectRoot, tools, ctx);
  writeManifestFile(projectRoot, ctx.manifest);
  ensureGitignore(projectRoot);
  for (const w of ctx.warnings) console.warn(`  ${style.yellow(symbols.warn)} ${w}`);
  printInitSummary(tools, ctx, style, symbols, { configExisted });
  return { tools };
}

// ---------- update + prune ----------

// `npm run setup:dogfood` is this very command, run from the tree it is updating — that is how
// the framework rebuilds its own mirrors and it must keep working. What must not happen is a
// PUBLISHED copy updating the source repo: that replaces the `payload/` under development with
// the shipped one, silently. So the test is identity AND provenance, never the name alone.
export function refuseSelfUpdate(projectRoot, pkgRoot) {
  let name;
  try {
    name = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))?.name;
  } catch {
    return null; // no package.json, or unreadable: an ordinary project
  }
  if (name !== OWN_PACKAGE_NAME) return null;
  try {
    if (fs.realpathSync.native(projectRoot) === fs.realpathSync.native(pkgRoot)) return null;
  } catch {
    return null;
  }
  return `this project is ${OWN_PACKAGE_NAME} itself — updating it from a published copy would`
    + ' fill its mirrors from the published payload instead of this tree\'s own `payload/`.'
    + ' Run `npm run setup:dogfood` instead.';
}

// `--force` is the one way past the blast cap, and past it a stale manifest can delete an
// unbounded number of files. An `npx` spawned through an agent's shell is seen by neither the
// hooks nor the validator, so doctrine was the only thing standing here — and doctrine binds
// nothing. A terminal is the cheapest SIGNAL that a person is present, not proof: a harness that
// runs its shell in a pty satisfies it, and anyone can set the override. What it reliably stops
// is an agent emitting a bare `--force` by mistake. Same interactivity test as the init picker.
export function forceNeedsAPerson(args, env = process.env, stdin = process.stdin, stdout = process.stdout) {
  if (!args.force) return null;
  if (env.WARNYIN_SDLC_FORCE === '1' || (stdin?.isTTY && stdout?.isTTY)) return null;
  return '--force crosses the prune blast cap, so it needs a person at the terminal.'
    + ' Run it yourself, or set WARNYIN_SDLC_FORCE=1 if this really is automation that meant it.';
}

export function cmdUpdate(projectRoot, args) {
  const refusal = refuseSelfUpdate(projectRoot, PKG_ROOT);
  if (refusal) throw new Error(refusal);
  const forced = forceNeedsAPerson(args);
  if (forced) throw new Error(forced);

  const sdlcRoot = path.join(projectRoot, 'sdlc');
  requireSdlc(sdlcRoot);
  const configRaw = fs.readFileSync(path.join(sdlcRoot, 'config.yaml'), 'utf8');
  const config = parseConfig(configRaw);
  // An explicit `tools: []` (from `init --tool none`) is a decision, not a gap:
  // only a config that never declared the key at all falls back to claude.
  const tools = args.toolProvided
    ? resolveToolList(args.tool ?? [])
    : (/^tools:/m.test(configRaw) ? config.tools : ['claude']);

  // Persist an explicit --tool override so declared and installed state never
  // diverge (otherwise pruning tool-specific files leaves config.yaml stale).
  if (args.toolProvided) {
    const configPath = path.join(sdlcRoot, 'config.yaml');
    const raw = fs.readFileSync(configPath, 'utf8');
    fs.writeFileSync(configPath, raw.replace(/^tools:.*$/m, `tools: [${tools.join(', ')}]`));
  }

  // Read before scaffolding: recordPayloadVersion overwrites version.json with our own.
  const wasAt = installedVersion(projectRoot);

  const oldManifest = readManifestFile(projectRoot);
  const ctx = { mode: 'update', manifest: new Map(), oldManifest, warnings: [], stats: {} };
  scaffoldSdlc(projectRoot, tools, ctx);
  installToolAdapters(projectRoot, tools, ctx);
  // `update` is how an existing project acquires hooks that journal under .state/, and
  // that whole design rests on the entry being there. Re-assert it: a project whose
  // .gitignore never had it, or lost it, would otherwise start reporting telemetry as
  // untracked noise — the same symptom in a subtler form.
  ensureGitignore(projectRoot);

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
  const written = (ctx.stats.written ?? 0) + (ctx.stats.updated ?? 0);
  const kept = ctx.stats.kept ?? 0;
  console.log(`updated for: ${tools.join(', ')} · payload files: ${ctx.manifest.size}`
    + ` · written: ${written} · kept: ${kept} · pruned: ${pruned}`);
  reportVersionMove(wasAt);
  return { pruned, written, kept, warnings: ctx.warnings };
}

// An update that moves the project backwards is still an update — it just must never look
// like a gain. `recordPayloadVersion` has already written our version by the time we get here,
// so a silent downgrade would only surface the next time something went wrong.
function reportVersionMove(wasAt) {
  const now = pkgVersion();
  if (!parseVersion(wasAt) || compareVersions(wasAt, now) === 0) return;
  if (compareVersions(wasAt, now) > 0) {
    console.log(`note: this project was at ${wasAt}; ${now} is older — it has been moved back.`);
    return;
  }
  console.log(`\nwhat this brought in (${wasAt} → ${now}):\n`);
  console.log(sliceChangelog(readOwnChangelog(), { since: wasAt, upTo: now }));
}

// ---------- changelog ----------

// What this project believes it is running. Missing, unreadable or malformed all mean the
// same thing — we do not know — and `sliceChangelog` answers that with the invoked version's
// own entry rather than inventing a range.
export function installedVersion(projectRoot) {
  try {
    const raw = fs.readFileSync(path.join(projectRoot, 'sdlc', '.hooks', 'version.json'), 'utf8');
    return JSON.parse(raw)?.version ?? undefined;
  } catch {
    return undefined;
  }
}

function readOwnChangelog() {
  try { return fs.readFileSync(path.join(PKG_ROOT, 'CHANGELOG.md'), 'utf8'); } catch { return null; }
}

// Read-only by construction: it touches the package it was invoked as, never the project.
export function cmdChangelog(projectRoot, args = {}) {
  const since = args.since ?? installedVersion(projectRoot);
  console.log(sliceChangelog(readOwnChangelog(), { since, upTo: pkgVersion() }));
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

  const resolved = resolveActive(sdlcRoot, { sessionId: process.env.CLAUDE_CODE_SESSION_ID });
  const current = resolved && (resolved.source === 'session' || resolved.source === 'project')
      && changes.some((c) => c.id === resolved.change)
    ? { id: resolved.change, source: resolved.source }
    : null;

  const orderedChanges = current
    ? [changes.find((c) => c.id === current.id), ...changes.filter((c) => c.id !== current.id)]
    : changes;

  // JSON is a machine contract: `current` names the id, so the list keeps its order.
  if (json) {
    console.log(JSON.stringify({ changes, archived, current }, null, 2));
  } else if (!changes.length) {
    console.log(`No active changes (${archived} archived). Start one with /sdlc:new or /sdlc:auto.`);
  } else {
    for (const c of orderedChanges) {
      let marker = '';
      if (current && c.id === current.id) {
        marker = current.source === 'session' ? '  ← this session' : '  ← last set for project';
      } else if (current?.source === 'session') {
        // Only a pointer this session wrote can say what is NOT this session's; the
        // project pointer is someone's last choice, so claiming the rest would be a guess.
        marker = '  (not this session)';
      }
      console.log(`${c.id}  [${c.tier}/${c.status}]  ${c.title}${marker}`);
    }
    console.log(`${changes.length} active · ${archived} archived`);
  }
  return { changes, archived, current };
}

// ---------- observe ----------

export function cmdObserve(projectRoot, { json = false } = {}) {
  const sdlcRoot = path.join(projectRoot, 'sdlc');
  requireSdlc(sdlcRoot);
  const report = buildReport(sdlcRoot);
  console.log(json ? JSON.stringify(report, null, 2) : renderReport(report));
  return report;
}

// ---------- skills ----------

// Reports the machine, not a change, so it needs no sdlc/ folder. JSON stays on one line:
// the opening playbook pipes it straight into the model's context.
export function cmdSkills(projectRoot, { json = false } = {}) {
  const inventory = scanInventory(projectRoot);
  if (json) console.log(JSON.stringify(inventory));
  else console.log(inventory.entries.length ? renderInventory(inventory) : 'no skills or agents installed');
  return inventory;
}

// ---------- archive (= mechanical part of ship) ----------

// The CLI's own events go to the same out-of-tree stream the hooks append to, so the
// ship event does not become the one write that dirties the tree.
export function appendJournal(sdlcRoot, changeId, event) {
  const target = liveJournalPath(sdlcRoot, changeId);
  if (!target) return;
  appendEvent(target, { ts: new Date().toISOString(), ...event });
}

export function cmdArchive(projectRoot, changeId, { strict = true } = {}) {
  const sdlcRoot = path.join(projectRoot, 'sdlc');
  requireSdlc(sdlcRoot);
  if (!changeId) throw new Error('usage: warnyin-sdlc archive <change-id>');
  // Refuse before anything is read or written. An id like `a/../b` resolves to a real
  // folder, so without this it would ship — merging specs and moving the folder — and
  // only then fail on the journal paths that do gate the id, reporting a completed
  // ship as an error.
  if (!isSafeChangeId(changeId)) {
    throw new Error(`"${changeId}" is not a valid change id — one path segment, no separators`);
  }
  const changeDir = path.join(sdlcRoot, 'changes', changeId);
  if (!fs.existsSync(changeDir)) throw new Error(`change "${changeId}" not found`);

  // Atomicity: the archive destination must be checked BEFORE any write —
  // otherwise a same-day id collision would mutate specs and stamp the change
  // while reporting failure.
  const date = new Date().toISOString().slice(0, 10);
  const destDir = path.join(sdlcRoot, 'changes', 'archive', `${date}-${changeId}`);
  // `init` scaffolds changes/archive/, but git does not track empty directories:
  // it is absent for anyone who cloned before the first change shipped. Prepare
  // it here, with the other destination checks, so a bad archive path fails
  // while the specs are still untouched instead of ENOENT-ing at the rename.
  fs.mkdirSync(path.dirname(destDir), { recursive: true });
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
  const driftWarnings = [];
  for (const d of deltas) {
    const specPath = path.join(sdlcRoot, 'specs', d.capability, 'spec.md');
    const specText = fs.existsSync(specPath) ? fs.readFileSync(specPath, 'utf8') : null;
    const result = mergeDelta(specText, d.ops, d.capability);
    if (!result.ok) throw new Error(`spec merge failed for "${d.capability}": ${result.errors.join('; ')}`);
    driftWarnings.push(...result.warnings);
    merged.push({ specPath, content: result.content, capability: d.capability });
  }

  // A MODIFIED body replaces the requirement wholesale, so it can carry away a
  // scenario the spec still promised. That is allowed — but it is said out loud
  // here, while the change folder is still readable, not discovered in a diff
  // after the folder moved under changes/archive/.
  for (const w of driftWarnings) console.error(`⚠ ${w}`);

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
  appendJournal(sdlcRoot, changeId, { event: 'ship', change: changeId, specs: merged.map((m) => m.capability) });

  // Telemetry stays out of the tree for the whole life of the change and becomes
  // tracked exactly once — here, in the ship commit — so no session can dirty it and no
  // appended tail can conflict.
  //
  // Read before the move, write after it. For an open change `sealedJournalPath` and
  // `legacyJournalPath` are the SAME file, so sealing first would leave the merged
  // union sitting at the legacy path if the rename then failed (EPERM/EBUSY on Windows
  // is the realistic way); the retry would merge that union with the still-present live
  // stream and double every event. Reading first and writing into `destDir` means a
  // failed rename has consumed nothing.
  const sealed = readChangeJournal(sdlcRoot, changeId);

  fs.renameSync(changeDir, destDir);

  // Past the point of no return: specs are merged and the folder has moved. Nothing
  // below may throw, or a completed ship reports as a failure and the human retries
  // into "change not found".
  try {
    // Empty only if the id was never journalled at all — the ship event above normally
    // guarantees at least one entry. An empty file would be worse than none.
    if (sealed.length) {
      writeFileNormalized(sealedJournalPath(destDir), serializeJournal(sealed));
    }
    fs.rmSync(liveJournalPath(sdlcRoot, changeId), { force: true });
  } catch (err) {
    console.error(`⚠ shipped, but the journal was not fully sealed: ${err.message}`);
  }

  // The pointers name a folder that has just moved. Release them so no session's focus or
  // telemetry keeps following a change that shipped. Never throws.
  clearPointersFor(sdlcRoot, changeId);

  console.log(`shipped: ${changeId}`);
  for (const m of merged) console.log(`  spec merged: specs/${m.capability}/spec.md`);
  if (driftWarnings.length) {
    console.log(`  ⚠ ${driftWarnings.length} scenario warning(s) above — re-read the spec diff before pushing`);
  }
  console.log(`  archived: changes/archive/${date}-${changeId}/`);
  return { archived: `${date}-${changeId}`, specs: merged.map((m) => m.capability), warnings: driftWarnings };
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

// Read from our own package.json: an npx install leaves nothing readable in the
// target project, and a report whose version is `unknown` cannot be triaged.
function pkgVersion() {
  return JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')).version;
}

const HELP = `@warnyin/sdlc — spec-driven AI-SDLC framework

usage: warnyin-sdlc <command> [options]

  init [--tool all|none|a,b]      scaffold sdlc/ + adapters + hooks (interactive picker when omitted)
  update [--tool ...] [--force]     refresh payload-owned files, prune stale ones (guarded)
                                    --force needs a terminal, or WARNYIN_SDLC_FORCE=1
  changelog [--since X.Y.Z]         what this package changes above a version (writes nothing)
  validate [id] [--strict]          structural validation (caps, delta grammar, gates)
  status [--json]                   list active changes and their stage
  observe [--json]                  tokens/cost per change, residency, steering hits, drift flags
  archive <id>                      merge delta specs into living specs and archive the change
  skills [--json]                   list installed Claude skills/agents (project + user) for lens resolution
  version | --version | -v          print the installed framework version
  help                              this text
`;

export async function main(argv = process.argv.slice(2), projectRoot = process.cwd()) {
  const args = parseArgs(argv);
  const cmd = args._[0];
  try {
    // before the help branch: `--version` carries no command, and `!cmd` would
    // otherwise print help instead of the version.
    if (args.version || cmd === 'version') { console.log(pkgVersion()); return; }
    if (args.help || !cmd || cmd === 'help') { console.log(HELP); return; }
    if (cmd === 'init') await cmdInit(projectRoot, args);
    else if (cmd === 'update') cmdUpdate(projectRoot, args);
    else if (cmd === 'changelog') cmdChangelog(projectRoot, args);
    else if (cmd === 'validate') runValidate(projectRoot, args);
    else if (cmd === 'status') cmdStatus(projectRoot, { json: args.json });
    else if (cmd === 'observe') cmdObserve(projectRoot, { json: args.json });
    else if (cmd === 'archive') cmdArchive(projectRoot, args._[1]);
    else if (cmd === 'skills') cmdSkills(projectRoot, { json: args.json });
    else { console.error(`unknown command: ${cmd}`); console.log(HELP); process.exitCode = 2; }
  } catch (err) {
    console.error(String(err.message ?? err));
    process.exitCode = 1;
  }
}

// npx invokes the bin via a node_modules/.bin symlink, so argv[1] must be
// realpath-resolved before comparing with import.meta.url (which the ESM
// loader already resolves) — otherwise main() silently never runs.
function isEntrypoint() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync.native(path.resolve(process.argv[1])) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isEntrypoint()) {
  main();
}

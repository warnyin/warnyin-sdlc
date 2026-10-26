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
import { resolveChangeFile } from '../lib/change-file.mjs';
import { countEffectiveLines, capForChange } from '../lib/caps.mjs';
import { progressOf, progressSuffix } from '../lib/progress.mjs';
import { artifactNameError, artifactBasis, artifactFileState, hasBasisSections, readArtifacts, stampArtifacts } from '../lib/artifacts.mjs';
import { writeFileContained, isRealPathInside, pathIsContained, hasEntry } from '../lib/safe-path.mjs';
import { analyze, shipImpact, renderShipImpact, escapeEntry } from '../lib/relations.mjs';
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
  const args = { _: [], tool: null, toolProvided: false, strict: false, force: false, json: false, help: false, version: false, since: null, all: false };
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
    else if (a === '--all') args.all = true;
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

// archive's writes: text normalized to `\n`, and contained like every installer write. Its
// preflight has already refused a path outside the project, so a refusal here is a race.
function writeFileNormalized(projectRoot, dest, content) {
  const ext = path.extname(dest);
  const out = TEXT_EXT.has(ext) ? normalizeEol(content) : content;
  const why = writeInProject(projectRoot, dest, out);
  if (why === 'symlink in path') throw new Error(outsideProject(projectRoot, dest, 'not written'));
  if (why) throw new Error(`${toPosix(path.relative(projectRoot, dest))} is ${why} — not written`);
  return out;
}

function outsideProject(projectRoot, p, outcome) {
  return `${toPosix(path.relative(projectRoot, p))} has a symlink in its path (archive writes only through real folders, as init and update do) — ${outcome}`;
}

// What a command prints from a change folder or file: every line through escapeEntry, so a
// folder name or a line of change.md cannot repaint the terminal or reorder what it says.
function shownLines(text) {
  return String(text).split('\n').map((line) => escapeEntry(line, Infinity)).join('\n');
}

// Every installer write into a project goes through here. The project is not ours: git carries
// symlinks, so any segment of a path — the file, a dangling link, a linked folder — can point
// anywhere on the machine. lib/safe-path.mjs is the one implementation of that rule; the folder is
// created only after the whole path is known to be contained. It writes exactly what it is given:
// payload text arrives normalized, and a user's own file (a marker append, the config tools line)
// keeps its line endings. Returns null when written, else why not — a link on the path, or a file
// or folder the person made read-only — so the caller keeps the path, says so, and the run (and
// the manifest written at its end) still completes.
function writeInProject(projectRoot, dest, content) {
  if (!pathIsContained(projectRoot, dest)) return 'symlink in path';
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    return writeFileContained(projectRoot, dest, content) ? null : 'symlink in path';
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'EPERM') return 'not writable';
    throw err;
  }
}

const KEPT = (why, rel) => `kept (${why}, not written): ${toPosix(rel)}`;
const LINKED = (rel) => KEPT('symlink in path', rel);

// The ledger of every shipped payload hash (bin/shipped-hashes.json, built at release by
// .github/scripts/shipped-hashes.mjs). WARNYIN_SDLC_SHIPPED_HASHES points tests at a fixture.
// Anything unreadable fails closed: no reclaim, one warning, and the update carries on.
const SHA256 = /^[0-9a-f]{64}$/;

function loadShippedHashes() {
  const file = process.env.WARNYIN_SDLC_SHIPPED_HASHES
    || fileURLToPath(new URL('./shipped-hashes.json', import.meta.url));
  let ledger;
  try {
    ledger = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return { error: `ledger unreadable (${err.code ?? err.name})` };
  }
  const entries = ledger?.paths;
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return { error: 'ledger has no paths map' };
  const paths = new Map();
  for (const [rel, hashes] of Object.entries(entries)) {
    if (!Array.isArray(hashes) || !hashes.every((h) => typeof h === 'string' && SHA256.test(h))) {
      return { error: `ledger entry for ${rel} is not a list of sha256 hashes` };
    }
    paths.set(rel, new Set(hashes));
  }
  return { paths };
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

  // A symlink anywhere on the path — the file itself, a dangling link, or a linked folder such as
  // `sdlc/.hooks` — would turn any write below into a write outside the file it names. The project
  // and its manifest are untrusted input, so nothing is written there: the path is kept, and its
  // recorded ownership with it. Each write below re-checks at open time (writeInProject).
  const linked = (warning = LINKED(relPosix)) => {
    const owned = ctx.oldManifest?.get(relPosix);
    if (owned) ctx.manifest.set(relPosix, owned);
    ctx.warnings.push(warning);
    return tally(ctx, 'kept');
  };
  // A file (or folder) the person made read-only is kept like a linked one: one warning, its
  // recorded ownership kept, and the rest of the run — the manifest above all — still completes.
  const put = () => {
    const why = writeInProject(projectRoot, dest, next);
    return why ? KEPT(why, relPosix) : null;
  };
  if (!pathIsContained(projectRoot, dest)) return linked();
  if (!fs.existsSync(dest)) {
    const refused = put();
    if (refused) return linked(refused);
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
    const refused = put();
    if (refused) return linked(refused);
    ctx.manifest.set(relPosix, nextHash);
    return tally(ctx, 'updated');
  }
  // #11: an older updater dropped the manifest entry of every file it kept, so an untouched file
  // read as user-modified forever. Content equal to what a release installed at this very path
  // proves nobody edited it. (Symlinked paths never get this far: see the guard at the top.)
  if (ctx.mode === 'update' && ctx.shipped?.get(relPosix)?.has(currentHash)) {
    const refused = put();
    if (refused) return linked(refused);
    ctx.manifest.set(relPosix, nextHash);
    ctx.warnings.push(`reclaimed (unmodified, shipped by an older version): ${relPosix}`);
    return tally(ctx, 'reclaimed');
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

// The order a tree's entries are written in. An update stopped part way (a killed process, a
// full disk) leaves whatever was written so far, and a hook runs on the next tool call: so a
// module goes in before every sibling that imports it, and a half-written update never has
// code importing a module that is not there yet. Names decide ties; a cycle falls back to them.
export function installOrder(srcDir) {
  const names = fs.readdirSync(srcDir).sort();
  const imports = new Map();
  for (const name of names) {
    if (!name.endsWith('.mjs')) continue;
    const text = fs.readFileSync(path.join(srcDir, name), 'utf8');
    // `from './x.mjs'` (import and re-export), side-effect `import './x.mjs'`, `import('./x.mjs')`.
    const forms = /(?:\bfrom|\bimport)\s*\(?\s*['"]\.\/([^'"/]+\.mjs)['"]/g;
    imports.set(name, [...text.matchAll(forms)].map((m) => m[1]).filter((n) => names.includes(n)));
  }
  const order = [];
  const visiting = new Set();
  const visit = (name) => {
    if (order.includes(name) || visiting.has(name)) return;
    visiting.add(name);
    for (const dep of imports.get(name) ?? []) visit(dep);
    visiting.delete(name);
    order.push(name);
  };
  for (const name of names) visit(name);
  return order;
}

function copyTree(srcDir, destDirRel, projectRoot, ctx) {
  if (!fs.existsSync(srcDir)) return;
  for (const name of installOrder(srcDir)) {
    const src = path.join(srcDir, name);
    const destRel = path.join(destDirRel, name);
    if (fs.lstatSync(src).isDirectory()) copyTree(src, destRel, projectRoot, ctx);
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

// The Claude stage stubs are the one source for which stages exist and what each is called.
// Kimi's skills are RENDERED from them, never kept as a second copy: two hand-maintained
// registries drift, which is exactly how `.kimi-code/AGENTS.md` once escaped the prune allowlist.
export function kimiStageStubs() {
  const rel = 'adapters/claude/commands/sdlc';
  const dir = path.join(PAYLOAD, rel);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((file) => {
    const stage = file.replace(/\.md$/, '');
    const { data, body } = parseFrontmatter(payloadText(`${rel}/${file}`));
    // Follow the stub to its playbook rather than rebuilding the path by convention, so a stub
    // that ever points somewhere else takes Kimi with it.
    const playbook = body.match(/sdlc\/\.playbook\/[A-Za-z0-9_-]+\.md/)?.[0] ?? `sdlc/.playbook/${stage}.md`;
    // Kimi requires a non-empty description; a stub that somehow lacks one still has to
    // produce a loadable skill rather than `description: ""`.
    const description = (data.description ?? '').trim() || `Run the ${stage} stage`;
    return { stage, description, playbook, hint: data['argument-hint'] ?? '' };
  });
}

// Kimi parses this frontmatter as real YAML, and three stage descriptions carry a colon
// ("agent panel: architect / security / ..."), so the value is always quoted.
const yamlQuote = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s*\n\s*/g, ' ')}"`;

export function renderKimiSkill(stage, description, playbook, hint = '') {
  const lines = [
    '---',
    `name: sdlc-${stage}`,
    `description: ${yamlQuote(description)}`,
    // A stage runs because a person asked for it — `ship` merges specs and archives, so the
    // model must not be able to fire one on its own. Mirrors a Claude slash command.
    'disableModelInvocation: true',
    '---',
    `Read \`${playbook}\` and execute it now. Arguments: $ARGUMENTS`,
  ];
  if (hint) lines.push(`Expected arguments: ${hint}`);
  return lines.join('\n') + '\n';
}

// Marker adapters live inside user-owned files: append once, never rewrite.
function appendWithMarker(projectRoot, destRel, content, ctx) {
  const dest = path.join(projectRoot, destRel);
  if (!pathIsContained(projectRoot, dest)) {
    ctx?.warnings.push(LINKED(destRel));
    return 'linked';
  }
  if (fs.existsSync(dest)) {
    const current = fs.readFileSync(dest, 'utf8');
    if (current.includes(MARKER)) return 'present';
    // The appended block takes the user's line endings, so a CRLF file stays all CRLF.
    const eol = current.includes('\r\n') ? '\r\n' : '\n';
    const sep = current.endsWith('\n') ? eol : eol + eol;
    const why = writeInProject(projectRoot, dest, current + sep + normalizeEol(content).replace(/\n/g, eol));
    if (!why) return 'appended';
    ctx?.warnings.push(KEPT(why, destRel));
    return 'linked';
  }
  const why = writeInProject(projectRoot, dest, normalizeEol(content));
  if (!why) return 'written';
  ctx?.warnings.push(KEPT(why, destRel));
  return 'linked';
}

export function installClaudeHooks(projectRoot, ctx) {
  const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
  // Neither read nor written through a link: the merge would carry the link target's content.
  if (!pathIsContained(projectRoot, settingsPath)) {
    ctx?.warnings.push(LINKED(path.join('.claude', 'settings.json')));
    return false;
  }
  let current = {};
  if (fs.existsSync(settingsPath)) {
    try {
      current = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      throw new Error('.claude/settings.json is not valid JSON — fix it, then re-run init');
    }
  }
  const merged = mergeHookSettings(current);
  const why = writeInProject(projectRoot, settingsPath, JSON.stringify(merged, null, 2) + '\n');
  if (why) ctx?.warnings.push(KEPT(why, path.join('.claude', 'settings.json')));
  return !why;
}

function installToolAdapters(projectRoot, tools, ctx) {
  if (tools.includes('claude')) {
    copyTree(path.join(PAYLOAD, 'adapters/claude/commands'), path.join('.claude', 'commands'), projectRoot, ctx);
    copyTree(path.join(PAYLOAD, 'adapters/claude/skills'), path.join('.claude', 'skills'), projectRoot, ctx);
    copyTree(path.join(PAYLOAD, 'adapters/claude/agents'), path.join('.claude', 'agents'), projectRoot, ctx);
    installClaudeHooks(projectRoot, ctx);
  }
  if (tools.includes('cursor')) {
    installFile(projectRoot, path.join('.cursor', 'rules', 'sdlc.mdc'), renderAdapter('adapters/cursor.mdc'), ctx);
  }
  if (tools.includes('windsurf')) {
    installFile(projectRoot, path.join('.windsurf', 'rules', 'sdlc.md'), renderAdapter('adapters/windsurf.md'), ctx);
  }
  if (tools.includes('copilot')) {
    appendWithMarker(projectRoot, path.join('.github', 'copilot-instructions.md'), renderAdapter('adapters/copilot.md'), ctx);
  }
  if (tools.includes('cline')) {
    appendWithMarker(projectRoot, '.clinerules', renderAdapter('adapters/cline.md'), ctx);
  }
  if (tools.includes('gemini')) {
    appendWithMarker(projectRoot, 'GEMINI.md', renderAdapter('adapters/gemini.md'), ctx);
  }
  if (tools.includes('agents-md')) {
    appendWithMarker(projectRoot, 'AGENTS.md', renderAdapter('adapters/agents-md.md'), ctx);
  }
  if (tools.includes('kimi')) {
    installFile(projectRoot, path.join('.kimi-code', 'AGENTS.md'), renderAdapter('adapters/kimi.md'), ctx);
    for (const { stage, description, playbook, hint } of kimiStageStubs()) {
      installFile(
        projectRoot,
        path.join('.kimi-code', 'skills', `sdlc-${stage}`, 'SKILL.md'),
        renderKimiSkill(stage, description, playbook, hint),
        ctx,
      );
    }
  }
}

// ---------- scaffold ----------

function scaffoldSdlc(projectRoot, tools, ctx) {
  const sdlcRoot = path.join(projectRoot, 'sdlc');
  for (const dir of ['context/steering', 'specs', 'changes/archive', 'evals', '.state']) {
    const abs = path.join(sdlcRoot, dir);
    if (!pathIsContained(projectRoot, abs)) {
      ctx.warnings.push(LINKED(path.relative(projectRoot, abs)));
      continue;
    }
    try {
      fs.mkdirSync(abs, { recursive: true });
    } catch (err) {
      if (err.code !== 'EACCES' && err.code !== 'EPERM') throw err;
      ctx.warnings.push(KEPT('not writable', path.relative(projectRoot, abs)));
    }
  }

  // git does not track empty directories, so changes/archive/ vanishes for
  // anyone who clones before the first change ships. Not manifested: an empty
  // marker is nothing for prune to reclaim or for the installer to warn about.
  // A dangling link there reads as absent to existsSync; writeInProject refuses it.
  const gitkeep = path.join(sdlcRoot, 'changes', 'archive', '.gitkeep');
  if (!fs.existsSync(gitkeep)) {
    const why = writeInProject(projectRoot, gitkeep, '');
    if (why) ctx.warnings.push(KEPT(why, path.relative(projectRoot, gitkeep)));
  }

  // Seeds are user-owned from birth: created once, never manifested/overwritten.
  const seed = (rel, templateName, transform = (s) => s) => {
    const dest = path.join(sdlcRoot, rel);
    if (fs.existsSync(dest)) return;
    const why = writeInProject(projectRoot, dest, transform(payloadText(`templates/${templateName}`)));
    if (why) ctx.warnings.push(KEPT(why, path.relative(projectRoot, dest)));
  };
  seed('config.yaml', 'config.yaml', (s) => s.replace('tools: []', `tools: [${tools.join(', ')}]`));
  seed('context/constitution.md', 'constitution.md');
  seed('harness.md', 'harness.md');

  // Payload-owned trees (manifested, refreshed by `update`).
  copyTree(path.join(PAYLOAD, 'playbook'), path.join('sdlc', '.playbook'), projectRoot, ctx);
  copyTree(path.join(PAYLOAD, 'templates'), path.join('sdlc', '.playbook', 'templates'), projectRoot, ctx);
  // lib/ first: the hooks import it, and a hook runs on the next tool call (see installOrder).
  copyTree(path.join(PKG_ROOT, 'lib'), path.join('sdlc', '.hooks', 'lib'), projectRoot, ctx);
  copyTree(path.join(PAYLOAD, 'hooks'), path.join('sdlc', '.hooks'), projectRoot, ctx);
  recordPayloadVersion(projectRoot, ctx);
}

// The hooks carry no package.json; the update notice compares against this. It is a record
// the CLI writes, not a user file, so it is rewritten every run instead of going through
// installFile's keep-if-different rule — otherwise a hand edit, or a clone whose gitignored
// manifest is missing, would freeze it and the notice would repeat after every update.
function recordPayloadVersion(projectRoot, ctx) {
  const rel = path.join('sdlc', '.hooks', 'version.json');
  const content = `${JSON.stringify({ version: pkgVersion() })}\n`;
  // Same rule as installFile: never write through a link on the path.
  const why = writeInProject(projectRoot, path.join(projectRoot, rel), content);
  if (why) {
    const owned = ctx.oldManifest?.get(toPosix(rel));
    if (owned) ctx.manifest.set(toPosix(rel), owned);
    ctx.warnings.push(KEPT(why, rel));
    return;
  }
  ctx.manifest.set(toPosix(rel), sha256(content));
}

export function writeManifestFile(projectRoot, manifest, ctx) {
  const rel = path.join('sdlc', '.state', 'manifest');
  const why = writeInProject(projectRoot, path.join(projectRoot, rel), renderManifest(manifest));
  if (why) {
    // The ownership record could not be saved: the next update will see this run's files as
    // unrecorded. Said plainly, not as one more "kept" line.
    ctx?.warnings.push(`manifest NOT saved (${why}): ${toPosix(rel)} — fix it and re-run update`);
    return false;
  }
  return true;
}

export function readManifestFile(projectRoot) {
  const p = path.join(projectRoot, 'sdlc', '.state', 'manifest');
  return fs.existsSync(p) ? parseManifest(fs.readFileSync(p, 'utf8')) : new Map();
}

export function ensureGitignore(projectRoot, ctx) {
  const giPath = path.join(projectRoot, '.gitignore');
  const entry = 'sdlc/.state/';
  if (!pathIsContained(projectRoot, giPath)) {
    ctx?.warnings.push(LINKED('.gitignore'));
    return;
  }
  let current = fs.existsSync(giPath) ? fs.readFileSync(giPath, 'utf8') : '';
  if (current.split(/\r?\n/).some((l) => l.trim() === entry)) return;
  const eol = current.includes('\r\n') ? '\r\n' : '\n';
  if (current && !current.endsWith('\n')) current += eol;
  const why = writeInProject(projectRoot, giPath, current + entry + eol);
  if (why) ctx?.warnings.push(KEPT(why, '.gitignore'));
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

function printInitSummary(tools, ctx, style, symbols, { configExisted, toolsAdded }) {
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
  if (s.kimiSkills) line(`${s.kimiSkills} skills in .kimi-code/skills/ — run one with \`/skill:sdlc-<stage>\``);
  line(`${s.hooks} hooks in sdlc/.hooks/`);
  line(`Playbook: sdlc/.playbook/ (${s.playbook} stages + ${s.templates} templates)`);
  const configNote = toolsAdded?.length
    ? ` (recorded ${toolsAdded.map(toolName).join(', ')})`
    : configExisted ? ' (kept)' : '';
  line(`Config: sdlc/config.yaml${configNote}`);
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
  const configPath = path.join(projectRoot, 'sdlc', 'config.yaml');
  const configExisted = fs.existsSync(configPath);

  // config.yaml is a seed — written once, never rewritten wholesale. But its `tools:` line
  // is the one field this command promises to keep current ("filled by `warnyin-sdlc init`"
  // in the template), so a second init adding a tool must not leave it stale: union what's
  // already recorded with what this run installs, never removing an entry (init has no prune
  // capability, and this doesn't give it one — only `update --tool <list>` can shrink the set).
  let toolsAdded = [];
  const warnings = [];
  if (configExisted) {
    const recorded = parseConfig(fs.readFileSync(configPath, 'utf8')).tools;
    const newlySelected = tools.filter((t) => !recorded.includes(t));
    // Only claim "recorded" in the summary when a write actually happened — a config
    // predating the `tools:` key makes persistToolsLine a no-op, and the message must not
    // say otherwise.
    if (newlySelected.length && persistToolsLine(configPath, [...recorded, ...newlySelected], { projectRoot, warnings })) {
      toolsAdded = newlySelected;
    }
  }

  const ctx = {
    mode: 'install',
    manifest: new Map(),
    oldManifest: readManifestFile(projectRoot),
    warnings,
    stats: { written: 0, current: 0, updated: 0, kept: 0 },
  };
  scaffoldSdlc(projectRoot, tools, ctx);
  installToolAdapters(projectRoot, tools, ctx);
  // Carry forward every entry this run did not rewrite. `init` installs only the tools it was
  // given, so writing `ctx.manifest` alone would disown the files of every OTHER tool already
  // installed here — they stay on disk, but `update` then sees files it has no record of,
  // refuses to refresh them (its refresh branch needs disk hash === recorded hash), freezes
  // them at their old payload version and reports them as user-modified. Same failure
  // `installFile` documents fixing per-file, reached instead by never visiting the entry.
  // The merge happens HERE, not by seeding `ctx.manifest`: that Map is also what the install
  // summary counts, and it must keep describing only what this run installed. `cmdUpdate`
  // deliberately does NOT do this — its wholesale replace is what tells prune a tool is gone.
  writeManifestFile(projectRoot, new Map([...ctx.oldManifest, ...ctx.manifest]), ctx);
  ensureGitignore(projectRoot, ctx);
  for (const w of ctx.warnings) console.warn(`  ${style.yellow(symbols.warn)} ${w}`);
  printInitSummary(tools, ctx, style, symbols, { configExisted, toolsAdded });
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

// Rewrites just the `tools:` line of `config.yaml` in place, leaving every other line
// untouched — a no-op when the file carries no `tools:` line at all (a config predating the
// key; matched, not fixed). Shared by `cmdInit` and `cmdUpdate` so the two paths can't drift.
// Reproduces the existing behavior exactly, trailing inline comment included: the line is
// replaced wholesale, so a hand-added comment after `tools: [...]` does not survive a rewrite.
// Returns whether it actually wrote — callers that report "recorded X" to the user must not
// claim it when this was a no-op (no `tools:` line to rewrite).
export function persistToolsLine(configPath, tools, { projectRoot = path.dirname(path.dirname(configPath)), warnings } = {}) {
  // config.yaml sits at <project>/sdlc/config.yaml; a link there is never read for rewriting,
  // and the refusal is reported like every other one.
  if (!pathIsContained(projectRoot, configPath)) {
    warnings?.push(LINKED(path.relative(projectRoot, configPath)));
    return false;
  }
  const raw = fs.readFileSync(configPath, 'utf8');
  if (!/^tools:/m.test(raw)) return false;
  // A replacer FUNCTION, not a string: `recorded` (unioned in by cmdInit) is free text read
  // back from the project's own config.yaml, not validated against the TOOLS registry the way
  // CLI-sourced tool names are — a string replacement would let `$&`/`$'`/`` $` `` in a
  // hand-edited or corrupted config get interpreted as replacement patterns instead of literal
  // text, silently duplicating or mangling the surrounding file.
  const why = writeInProject(projectRoot, configPath, raw.replace(/^tools:.*$/m, () => `tools: [${tools.join(', ')}]`));
  if (why) warnings?.push(KEPT(why, path.relative(projectRoot, configPath)));
  return !why;
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
  const warnings = [];
  if (args.toolProvided) {
    persistToolsLine(path.join(sdlcRoot, 'config.yaml'), tools, { projectRoot, warnings });
  }

  // Read before scaffolding: recordPayloadVersion overwrites version.json with our own.
  const wasAt = installedVersion(projectRoot);

  const oldManifest = readManifestFile(projectRoot);
  const ctx = { mode: 'update', manifest: new Map(), oldManifest, warnings, stats: {} };
  const shipped = loadShippedHashes();
  if (shipped.error) ctx.warnings.push(`reclaim skipped: ${shipped.error}`);
  else ctx.shipped = shipped.paths;
  scaffoldSdlc(projectRoot, tools, ctx);
  installToolAdapters(projectRoot, tools, ctx);
  // `update` is how an existing project acquires hooks that journal under .state/, and
  // that whole design rests on the entry being there. Re-assert it: a project whose
  // .gitignore never had it, or lost it, would otherwise start reporting telemetry as
  // untracked noise — the same symptom in a subtler form.
  ensureGitignore(projectRoot, ctx);

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
      try {
        fs.rmSync(abs);
      } catch (err) {
        if (err.code !== 'EACCES' && err.code !== 'EPERM') throw err;
        // Still ours and still on disk: keep its record so a later run can prune it.
        ctx.manifest.set(relPath, hash);
        ctx.warnings.push(`prune kept (not writable): ${relPath}`);
        continue;
      }
      pruned++;
      let dir = path.dirname(abs);
      while (containedIn(realRoot, dir)) {
        try { fs.rmdirSync(dir); } catch { break; }
        dir = path.dirname(dir);
      }
    }
  }

  writeManifestFile(projectRoot, ctx.manifest, ctx);
  for (const w of ctx.warnings) console.warn(`  ${w}`);
  const written = (ctx.stats.written ?? 0) + (ctx.stats.updated ?? 0);
  const kept = ctx.stats.kept ?? 0;
  const reclaimed = ctx.stats.reclaimed ?? 0;
  console.log(`updated for: ${tools.join(', ')} · payload files: ${ctx.manifest.size}`
    + ` · written: ${written}${reclaimed ? ` · ${reclaimed} reclaimed` : ''} · kept: ${kept} · pruned: ${pruned}`);
  reportVersionMove(wasAt);
  return { pruned, written, kept, reclaimed, warnings: ctx.warnings };
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

// A missing or unreadable change.md has no figure: no tasks, no percent.
function changeProgress(sdlcRoot, id) {
  try {
    return progressOf(fs.readFileSync(path.join(sdlcRoot, 'changes', id, 'change.md'), 'utf8'));
  } catch {
    return { done: 0, total: 0, percent: null };
  }
}

export function cmdStatus(projectRoot, { json = false, all = false } = {}) {
  const sdlcRoot = path.join(projectRoot, 'sdlc');
  requireSdlc(sdlcRoot);
  const archiveDir = path.join(sdlcRoot, 'changes', 'archive');
  const archived = fs.existsSync(archiveDir)
    ? fs.readdirSync(archiveDir, { withFileTypes: true }).filter((d) => d.isDirectory()).length
    : 0;

  // Relations are additive: the array keeps the order and the fields it already had, and a
  // project using none of this reads exactly as it did before, with empty values.
  const relations = analyze(sdlcRoot);
  const changes = readChanges(sdlcRoot).map((c) => {
    const node = relations.byId.get(c.id);
    return {
      ...c,
      blockedBy: node?.blockedBy ?? [],
      spawnedFrom: node?.spawnedFrom ?? [],
      parked: node?.parked ?? null,
      waitedOnBy: node?.waitedOnBy ?? [],
      // Appended after the fields JSON readers already had, so their order holds.
      progress: changeProgress(sdlcRoot, c.id),
    };
  });

  const resolved = resolveActive(sdlcRoot, { sessionId: process.env.CLAUDE_CODE_SESSION_ID });
  const current = resolved && (resolved.source === 'session' || resolved.source === 'project')
      && changes.some((c) => c.id === resolved.change)
    ? { id: resolved.change, source: resolved.source }
    : null;

  const parkedCount = changes.filter((c) => c.parked).length;
  const order = relations.order;
  const next = nextWork(changes, current, order);

  const orderedChanges = current
    ? [changes.find((c) => c.id === current.id), ...changes.filter((c) => c.id !== current.id)]
    : changes;

  // JSON is a machine contract: `current` names the id, so the list keeps its order.
  if (json) {
    console.log(JSON.stringify({ changes, archived, current, parked: parkedCount, order, next }, null, 2));
  } else if (!changes.length) {
    console.log(`No active changes (${archived} archived). Start one with /sdlc:new or /sdlc:auto.`);
  } else {
    // Parked is out of the way by default and reachable with --all: stepping aside is the
    // whole point, and a listing that still shows it has not let the change step aside.
    for (const c of orderedChanges.filter((c) => all || !c.parked)) {
      let marker = '';
      if (current && c.id === current.id) {
        marker = current.source === 'session' ? '  ← this session' : '  ← last set for project';
      } else if (current?.source === 'session') {
        // Only a pointer this session wrote can say what is NOT this session's; the
        // project pointer is someone's last choice, so claiming the rest would be a guess.
        marker = '  (not this session)';
      }
      // The frees-count rides the human listing, not only the JSON: the ordering rule is
      // doctrine a model reads off `status`, and a count nobody sees decides nothing.
      const waiting = c.blockedBy.length ? `  ⇠ waiting on ${c.blockedBy.join(', ')}` : '';
      const frees = !c.blockedBy.length && c.waitedOnBy.length ? `  ⇢ frees ${c.waitedOnBy.length}` : '';
      // The reason is prose out of a user-writable file: escaped and capped like any other
      // untrusted value, so a listing cannot be repainted or reordered by what someone typed.
      const parked = c.parked ? `  ⏸ parked: ${escapeEntry(c.parked, 60)}` : '';
      console.log(`${shownLines(`${c.id}  [${c.tier}/${c.status}]  ${c.title}`)}${progressSuffix(c.progress)}${waiting}${frees}${parked}${marker}`);
    }
    console.log(`${changes.length} active · ${archived} archived${parkedCount ? ` · ${parkedCount} parked` : ''}`);
  }
  return { changes, archived, current, parked: parkedCount, order, next };
}

// What to actually work on. A change that is waiting hands the answer to what it waits on;
// everything else answers for itself, and with nothing set the ranking decides.
function nextWork(changes, current, order) {
  const pick = (id) => (id ? { id } : null);
  const node = current ? changes.find((c) => c.id === current.id) : null;
  if (node && node.blockedBy.length) {
    const open = node.blockedBy.find((b) => changes.some((c) => c.id === b));
    return pick(open ?? node.blockedBy[0]);
  }
  if (node && !node.parked) return pick(node.id);
  return pick(order[0]);
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
  if (!target || !pathIsContained(path.dirname(sdlcRoot), target)) return false;
  appendEvent(target, { ts: new Date().toISOString(), ...event });
  return true;
}

// Every path archive reads out of the change folder into tracked files, writes, moves or
// removes is checked BEFORE the first write — the installer's rule (lib/safe-path.mjs): each
// existing segment, dangling links included, must really be inside the project.
function refuseOutside(projectRoot, paths, outcome = 'nothing was merged') {
  for (const p of paths) {
    if (!pathIsContained(projectRoot, p)) throw new Error(outsideProject(projectRoot, p, outcome));
  }
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
  const evalsSrc = path.join(changeDir, 'contract', 'evals.md');
  const liveJournal = liveJournalPath(sdlcRoot, changeId);
  refuseOutside(projectRoot, [
    path.join(changeDir, 'change.md'), sealedJournalPath(changeDir), evalsSrc,
    path.join(destDir, 'journal.ndjson'), liveJournal,
  ]);
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

  // Relations, while nothing has been written yet. A still-waiting change does not ship, and
  // the changes waiting on this one are READ here: after the rename there is nothing left to
  // read, and nothing down there may throw.
  const relations = analyze(sdlcRoot);
  const self = relations.byId.get(changeId);
  if (self?.parked) {
    throw new Error(`"${changeId}" is parked (${escapeEntry(self.parked, 60)}) — unpark it before shipping; nothing was merged`);
  }
  if (self && self.blockedBy.length) {
    throw new Error(`"${changeId}" is still waiting on: ${self.blockedBy.join(', ')} — nothing was merged`);
  }
  const impact = shipImpact(relations, changeId);
  // An unreadable neighbour makes the report incomplete, not the merge wrong. Saying so beats
  // refusing every ship in the project over a folder this change has nothing to do with.
  for (const msg of relations.readErrors) console.error(shownLines(`⚠ ${msg}`));

  const changeText = fs.readFileSync(path.join(changeDir, 'change.md'), 'utf8');
  const { deltas, errors: parseErrors } = parseDelta(changeText);
  if (parseErrors.length) throw new Error(`delta parse errors: ${parseErrors.join('; ')} — nothing was merged`);

  // Phase 1: compute every merge before writing anything (all-or-nothing).
  const merged = [];
  const driftWarnings = [];
  const hasEvals = hasEntry(evalsSrc);
  refuseOutside(projectRoot, deltas.flatMap((d) => [
    path.join(sdlcRoot, 'specs', d.capability, 'spec.md'),
    ...(hasEvals ? [path.join(sdlcRoot, 'evals', d.capability, 'rubric.md')] : []),
  ]));
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
  for (const w of driftWarnings) console.error(shownLines(`⚠ ${w}`));

  // Phase 2: write specs, promote evals, stamp status, move to archive.
  for (const m of merged) writeFileNormalized(projectRoot, m.specPath, m.content);

  if (fs.existsSync(evalsSrc)) {
    for (const m of merged) {
      const rubricDest = path.join(sdlcRoot, 'evals', m.capability, 'rubric.md');
      if (!hasEntry(rubricDest)) {
        writeFileNormalized(projectRoot, rubricDest, fs.readFileSync(evalsSrc, 'utf8'));
      }
    }
  }

  const stamped = changeText.replace(/^status:\s*.*$/m, 'status: shipped');
  writeFileNormalized(projectRoot, path.join(changeDir, 'change.md'), stamped);
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

  // Checked again at the move itself: a link swapped in since the preflight would carry the
  // whole change folder out of the project, and rename has no O_NOFOLLOW.
  // The specs are merged and change.md is stamped by now, so this refusal says so instead.
  refuseOutside(projectRoot, [destDir, path.join(changeDir, 'change.md')],
    'the specs ARE merged and change.md is stamped shipped, but the change folder was not moved: remove the link, then move it under changes/archive/ by hand');
  fs.renameSync(changeDir, destDir);

  // Past the point of no return: specs are merged and the folder has moved. Nothing
  // below may throw, or a completed ship reports as a failure and the human retries
  // into "change not found".
  try {
    // Empty only if the id was never journalled at all — the ship event above normally
    // guarantees at least one entry. An empty file would be worse than none.
    if (sealed.length) {
      writeFileNormalized(projectRoot, sealedJournalPath(destDir), serializeJournal(sealed));
    }
    if (!pathIsContained(projectRoot, liveJournal)) throw new Error(outsideProject(projectRoot, liveJournal, 'not removed'));
    fs.rmSync(liveJournal, { force: true });
  } catch (err) {
    console.error(shownLines(`⚠ shipped, but the journal was not fully sealed: ${err.message}`));
  }

  // The pointers name a folder that has just moved. Release them so no session's focus or
  // telemetry keeps following a change that shipped. Never throws.
  clearPointersFor(sdlcRoot, changeId);

  console.log(`shipped: ${escapeEntry(changeId, Infinity)}`);
  for (const m of merged) console.log(`  spec merged: specs/${m.capability}/spec.md`);
  if (driftWarnings.length) {
    console.log(`  ⚠ ${driftWarnings.length} scenario warning(s) above — re-read the spec diff before pushing`);
  }
  console.log(`  archived: changes/archive/${date}-${escapeEntry(changeId, Infinity)}/`);
  // Counted before the merge, rendered now. Nothing here may fail the ship: it has happened.
  try {
    const lines = renderShipImpact(impact);
    if (lines.length) {
      const parked = impact.stillParked.length ? ` · ${impact.stillParked.length} parked` : '';
      console.log(`  ${impact.freed.length} freed · ${impact.waiting.length} still waiting${parked}`);
    }
    for (const line of lines) console.log(`  ${line}`);
  } catch (err) {
    console.error(shownLines(`⚠ shipped, but the waiting changes could not be reported: ${err.message}`));
  }
  return { archived: `${date}-${changeId}`, specs: merged.map((m) => m.capability), warnings: driftWarnings };
}

// ---------- artifact (stamp the Design basis an artifact was made from) ----------

export function cmdArtifact(projectRoot, positionals) {
  const [changeId, name] = positionals;
  const sdlcRoot = path.join(projectRoot, 'sdlc');
  requireSdlc(sdlcRoot);
  if (positionals.length !== 2) throw new Error('usage: warnyin-sdlc artifact <change-id> <name>');
  const { file, error } = resolveChangeFile(sdlcRoot, changeId, 'stamp');
  if (error) throw new Error(error);
  // A folder name from a cloned repo can carry control or bidi characters: this command's own
  // messages echo it escaped, as resolveChangeFile's refusals above do.
  const shown = escapeEntry(changeId);
  const nameError = artifactNameError(name);
  if (nameError) throw new Error(`cannot stamp "${shown}": ${nameError}`);

  const refuse = (why) => new Error(`cannot stamp "${shown}": artifact/${name} ${why} — nothing was written`);
  const dir = path.join(path.dirname(file), 'artifact');
  const { state, code } = artifactFileState(path.dirname(file), name);
  if (state === 'no-folder') throw new Error(`cannot stamp "${shown}": the artifact/ folder (holding artifact/${name}) is missing — nothing was written`);
  // Validate's words for the same state: the file or its folder exists but lstat failed.
  if (state === 'unreadable') throw refuse(`cannot be checked (${escapeEntry(code)})`);
  if (state === 'bad-folder' || !isRealPathInside(sdlcRoot, dir)) {
    throw new Error(`cannot stamp "${shown}": artifact/ (holding artifact/${name}) is not a real directory inside this project — nothing was written`);
  }
  if (state === 'missing') throw refuse('is missing');
  if (state === 'symlink') throw refuse('is a symlink');
  if (state !== 'ok') throw refuse('is not a regular file');

  let before;
  try { before = fs.readFileSync(file, 'utf8'); } catch { throw new Error(`cannot stamp "${shown}": change.md could not be read for artifact/${name} — nothing was written`); }
  if (!hasBasisSections(before)) throw refuse('has nothing for a basis to depict (no ## Design and no ## Delta: section)');
  const basis = artifactBasis(before);
  const stamped = stampArtifacts(before, name, basis);
  if (stamped.error) throw new Error(`cannot stamp "${shown}": artifact/${name} — ${stamped.error}`);
  // Validate's cap rule (capForChange reads an unknown tier as standard). Only a stamp that adds
  // lines is refused: a re-stamp of a listed line keeps the stale hint usable on a file already over its cap.
  const { data } = parseFrontmatter(before);
  const cap = capForChange(data.tier);
  const grown = countEffectiveLines(stamped.text);
  if (grown > countEffectiveLines(before) && grown > cap) {
    throw refuse(`would push change.md past its cap of ${cap} lines — trim change.md, then re-run`);
  }
  const proof = readArtifacts(stamped.text).filter((e) => e.path === `artifact/${name}`);
  if (proof.length !== 1 || proof[0].basis !== basis) {
    throw refuse('— the stamp would not read back (is ## Artifacts inside an unclosed code fence?)');
  }
  // Like park's commit(): the cause is named, never swallowed.
  const failed = (why) => new Error(`cannot stamp "${shown}": the write of artifact/${name} to change.md ${why}`);
  if (stamped.text !== before) {
    let wrote;
    try { wrote = writeFileContained(sdlcRoot, file, stamped.text); } catch (err) { throw failed(`failed (${escapeEntry(err.code ?? err.message)})`); }
    if (!wrote) throw failed('was refused — change.md does not really resolve inside this project');
  }
  let entries;
  try { entries = readArtifacts(fs.readFileSync(file, 'utf8')); } catch (err) { throw failed(`could not be re-read (${escapeEntry(err.code ?? err.message)})`); }
  const mine = entries.filter((e) => e.path === `artifact/${name}`);
  if (mine.length !== 1 || mine[0].basis !== basis) throw failed('did not hold on re-read');
  console.log(`stamped: artifact/${name} · basis: ${basis} (${shown})`);
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
  status [--json] [--all]           list active changes and their stage (--all includes parked)
  observe [--json]                  tokens/cost per change, residency, steering hits, drift flags
  archive <id>                      merge delta specs into living specs and archive the change
  artifact <id> <name>              stamp artifact/<name> with the Design basis it was made from
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
    else if (cmd === 'status') cmdStatus(projectRoot, { json: args.json, all: args.all });
    else if (cmd === 'observe') cmdObserve(projectRoot, { json: args.json });
    else if (cmd === 'archive') cmdArchive(projectRoot, args._[1]);
    else if (cmd === 'artifact') cmdArtifact(projectRoot, args._.slice(1));
    else if (cmd === 'skills') cmdSkills(projectRoot, { json: args.json });
    else { console.error(`unknown command: ${cmd}`); console.log(HELP); process.exitCode = 2; }
  } catch (err) {
    // A refusal can quote a change id or a line of change.md; it is printed escaped.
    console.error(shownLines(err.message ?? err));
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

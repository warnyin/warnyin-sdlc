#!/usr/bin/env node
// Thin CLI wrapper — validator core lives in lib/validate.mjs so that
// installed hooks (sdlc/.hooks/lib/) can share the exact same logic.
// Exit codes: 0 = clean, 1 = errors, 2 = usage/setup error.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateAll, formatIssues } from '../lib/validate.mjs';
import { listOpenChangeIds } from '../lib/relations.mjs';
import { hasOverlapDecision } from '../lib/overlap.mjs';
import { overlapConfig, overlapReport } from '../bin/git-refs.mjs';

export * from '../lib/validate.mjs';

// Overlap with other env branches is checked here only, never in lib/validate.mjs: the hooks call
// validateChange on every write, and a hook must never start git. Each ref is read once for all
// open changes; an undecided hit is a warning, never an error.
function overlapIssues(projectRoot, sdlcRoot, changeId) {
  const config = overlapConfig(projectRoot);
  if (config.state !== 'list') return [];
  const ids = listOpenChangeIds(sdlcRoot).filter((id) => !changeId || id === changeId);
  if (ids.length === 0) return [];
  const issues = [];
  for (const { ref, skipped, results } of overlapReport(projectRoot, config.refs, ids)) {
    if (skipped) { issues.push({ level: 'warn', where: 'overlap', msg: `${ref} skipped (${skipped}) — not compared` }); continue; }
    for (const [id, { hits, ignored }] of results) {
      if (ignored) issues.push({ level: 'warn', where: id, msg: `${ref} ${ignored} ignored (oversize, unreadable or cut) — an overlap may be missed` });
      const text = readChange(sdlcRoot, id);
      for (const hit of hits) {
        if (hasOverlapDecision(text, ref, hit)) continue;
        const name = hit.kind === 'spec' ? hit.capability : hit.id;
        issues.push({ level: 'warn', where: id, msg: `${ref} ${hit.kind} ${name} (${hit.capability}): no overlap decision — add "overlap: ${ref} ${name} — <decision>" to ## Assumptions` });
      }
    }
  }
  return issues;
}

function readChange(sdlcRoot, id) {
  try { return fs.readFileSync(path.join(sdlcRoot, 'changes', id, 'change.md'), 'utf8'); } catch { return ''; }
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const rootIdx = args.indexOf('--root');
  const projectRoot = rootIdx !== -1 ? args[rootIdx + 1] : process.cwd();
  const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--root');
  const changeId = positional[0] && positional[0] !== '--all' ? positional[0] : null;

  const sdlcRoot = path.join(projectRoot, 'sdlc');
  if (!fs.existsSync(sdlcRoot)) {
    console.error(`No sdlc/ directory at ${projectRoot} — run \`npx @warnyin/sdlc init\` first.`);
    process.exit(2);
  }

  const issues = [...validateAll(sdlcRoot, { strict, changeId }), ...overlapIssues(projectRoot, sdlcRoot, changeId)];
  if (issues.length) console.log(formatIssues(issues));
  const errors = issues.filter((i) => i.level === 'error').length;
  const warns = issues.length - errors;
  console.log(`validate: ${errors} error(s), ${warns} warning(s)${strict ? ' [strict]' : ''}`);
  process.exit(errors > 0 ? 1 : 0);
}

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

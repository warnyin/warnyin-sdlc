#!/usr/bin/env node
// Thin CLI wrapper — validator core lives in lib/validate.mjs so that
// installed hooks (sdlc/.hooks/lib/) can share the exact same logic.
// Exit codes: 0 = clean, 1 = errors, 2 = usage/setup error.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateAll, formatIssues } from '../lib/validate.mjs';

export * from '../lib/validate.mjs';

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

  const issues = validateAll(sdlcRoot, { strict, changeId });
  if (issues.length) console.log(formatIssues(issues));
  const errors = issues.filter((i) => i.level === 'error').length;
  const warns = issues.length - errors;
  console.log(`validate: ${errors} error(s), ${warns} warning(s)${strict ? ' [strict]' : ''}`);
  process.exit(errors > 0 ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

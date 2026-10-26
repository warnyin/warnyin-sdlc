// Red proof for readonly-target: each guard removed one at a time in a copy of the tree
// (tests/mutation.mjs), against tests/readonly-target.test.mjs and the security-regressions row.
// Run from the repo root on each platform: node sdlc/changes/readonly-target/evidence/mutations.mjs
import fs from 'node:fs';
import path from 'node:path';
import { runMutants } from '../../../../tests/mutation.mjs';

const T = 'tests/readonly-target.test.mjs';
const m = (label, file, find, replace) => ({ label, file, find, replace, target: T });

const mutants = [
  m('no write-permission check before the temp', 'lib/safe-path.mjs',
    'if (mode !== null) fs.accessSync(file, fs.constants.W_OK);', ''),
  m('a locked folder no longer falls back in place', 'lib/safe-path.mjs',
    "if (mode === null || !(err.code === 'EACCES' || err.code === 'EPERM')) throw err;", 'throw err;'),
  m('a permission error from an installer write aborts update', 'bin/cli.mjs',
    "if (err.code === 'EACCES' || err.code === 'EPERM') return 'not writable';", ''),
  m('installFile ignores a refused write', 'bin/cli.mjs',
    'return why ? KEPT(why, relPosix) : null;', 'return null;'),
  m('prune lets a permission error abort update', 'bin/cli.mjs',
    "if (err.code !== 'EACCES' && err.code !== 'EPERM') throw err;", 'throw err;'),
  m('prune drops the record of a file it could not remove', 'bin/cli.mjs',
    'ctx.manifest.set(relPath, hash);\n        ctx.warnings.push(`prune kept (not writable): ${relPath}`);',
    'ctx.warnings.push(`prune kept (not writable): ${relPath}`);'),
  m('a manifest that was not saved is reported as a plain kept line', 'bin/cli.mjs',
    'ctx?.warnings.push(`manifest NOT saved (${why}): ${toPosix(rel)} — fix it and re-run update`);',
    'ctx?.warnings.push(KEPT(why, rel));'),
  m('a scaffold folder that cannot be made aborts update', 'bin/cli.mjs',
    "if (err.code !== 'EACCES' && err.code !== 'EPERM') throw err;\n      ctx.warnings.push(KEPT('not writable', path.relative(projectRoot, abs)));",
    'throw err;'),
  m('.gitignore refusal not reported', 'bin/cli.mjs',
    "if (why) ctx?.warnings.push(KEPT(why, '.gitignore'));", ''),
];

const root = process.cwd();
const { baseline, count, results } = runMutants({ root, targets: [T], mutants });
const lines = [`baseline: ${baseline ?? 'green'} · mutants: ${mutants.length} · killed: ${count ?? 'n/a'} · platform: ${process.platform}`];
for (const r of results) lines.push(`${r.killed ? 'KILLED  ' : 'SURVIVED'} ${r.label} — ${r.rows.join(', ') || r.why}`);
const out = lines.join('\n') + '\n';
fs.writeFileSync(path.join(root, `sdlc/changes/readonly-target/evidence/mutations-${process.platform}.txt`), out);
process.stdout.write(out);

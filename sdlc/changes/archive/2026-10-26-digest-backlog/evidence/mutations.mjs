// Red proof for digest-backlog: each guard or rule this change added, removed or weakened one at
// a time in a copy of the tree (tests/mutation.mjs), against tests/digest-backlog.test.mjs.
// Run from the repo root: node sdlc/changes/digest-backlog/evidence/mutations.mjs
import fs from 'node:fs';
import path from 'node:path';
import { runMutants } from '../../../../tests/mutation.mjs';

const T = 'tests/digest-backlog.test.mjs';
const m = (label, file, find, replace) => ({ label, file, find, replace, target: T });

const mutants = [
  m('contract.md: sample instead of sweep', 'payload/playbook/contract.md',
    'A row that pins a character class, a range or a closed set sweeps every member, never a sample.', ''),
  m('contract.md: no row per input class', 'payload/playbook/contract.md',
    'A formula or status mapping in a Delta gets one row per input class, the fallback class and the rounding rule included.', ''),
  m('review.md: deferral may filter', 'payload/playbook/review.md',
    "A class deferred to a later change is recorded with its sweep's hits unfiltered — no name or variable filter — and an instance found later is recorded as a miss of that deferral.", ''),
  m('build.md: conductor exception gone', 'payload/playbook/build.md',
    'In an attended run it may also take more tasks when they edit the same file, where builders would collide, or are each a short prose or config edit; journal `mode=conductor reason=<why>`.', ''),
  m('build.md: conductor capped at 2 again', 'payload/playbook/build.md',
    '- **Conductor** (attended runs only):', '- **Conductor** (≤2 tasks, attended runs only):'),
  m('build.md: conductor capped by a synonym', 'payload/playbook/build.md',
    'It takes any change of one or two tasks, and more only as the next sentence allows.', 'It takes a change of one or two tasks.'),
  m('build.md: a second, bare cap beside the base count', 'payload/playbook/build.md',
    'and more only as the next sentence allows.', 'and more only as the next sentence allows. It takes at most two tasks.'),
  m('sdlc-builder: claims more than two tasks', 'payload/adapters/claude/agents/sdlc-builder.md',
    'Used for orchestrator waves and for every task of an unattended build.', 'Used for orchestrator waves when a change has more than two tasks.'),
  m('a dangling link reads as absent', 'lib/safe-path.mjs',
    'if (hasEntry(cur) && !isRealPathInside(root, cur)) return false;', 'if (fs.existsSync(cur) && !isRealPathInside(root, cur)) return false;'),
  m('the write skips its containment check', 'lib/safe-path.mjs',
    'if (!pathIsContained(root, file)) return false;\n  const tmp', 'const tmp'),
  m('the mode is forged', 'lib/safe-path.mjs',
    'if (mode !== null) fs.fchmodSync(fd, mode);', 'fs.fchmodSync(fd, 0o600);'),
  m('sdlc-builder: old description', 'payload/adapters/claude/agents/sdlc-builder.md',
    'Used for orchestrator waves and for every task of an unattended build.', 'Used when a change has >2 parallelizable tasks.'),
  m('write in place instead of renaming', 'lib/safe-path.mjs',
    'fs.renameSync(tmp, file);', 'writeInPlace(file, data);'),
  m('a refused rename never falls back', 'lib/safe-path.mjs',
    'if (!RENAME_HELD.has(err.code) || !pathIsContained(root, file)) throw err;', 'throw err;'),
  m('the fallback skips the containment re-check', 'lib/safe-path.mjs',
    'if (!RENAME_HELD.has(err.code) || !pathIsContained(root, file)) throw err;', 'if (!RENAME_HELD.has(err.code)) throw err;'),
  m('the temp is removed even when not ours', 'lib/safe-path.mjs',
    'if (created) fs.rmSync(tmp, { force: true });', 'fs.rmSync(tmp, { force: true });'),
  m('the temp is never removed', 'lib/safe-path.mjs',
    'if (created) fs.rmSync(tmp, { force: true });', ''),
  m('the mode is not copied', 'lib/safe-path.mjs',
    'if (mode !== null) fs.fchmodSync(fd, mode);', ''),
  m('installOrder reads only `from`', 'bin/cli.mjs',
    'const forms = /(?:\\bfrom|\\bimport)\\s*\\(?\\s*[\'"]\\.\\/([^\'"/]+\\.mjs)[\'"]/g;',
    'const forms = /from\\s+[\'"]\\.\\/([^\'"/]+\\.mjs)[\'"]/g;'),
  m('the placeholder gets the generic message', 'lib/delta.mjs',
    'if (!existing && /^<.*>$/.test(current.capability)) {', 'if (false) {'),
  m('only the literal <capability> is the placeholder', 'lib/delta.mjs',
    'if (!existing && /^<.*>$/.test(current.capability)) {', "if (!existing && current.capability === '<capability>') {"),
];

const root = process.cwd();
const { baseline, count, results } = runMutants({ root, targets: [T], mutants });
const lines = [`baseline: ${baseline ?? 'green'} · mutants: ${mutants.length} · killed: ${count ?? 'n/a'} · platform: ${process.platform}`];
for (const r of results) lines.push(`${r.killed ? 'KILLED  ' : 'SURVIVED'} ${r.label} — ${r.rows.join(', ') || r.why}`);
const out = lines.join('\n') + '\n';
fs.writeFileSync(path.join(root, 'sdlc/changes/digest-backlog/evidence/mutations.txt'), out);
process.stdout.write(out);

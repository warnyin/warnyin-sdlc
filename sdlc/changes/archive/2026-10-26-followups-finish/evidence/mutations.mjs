// Red proof for followups-finish: every guard this change added, removed or weakened one at a time
// in a copy of the tree (tests/mutation.mjs), against tests/followups-finish.test.mjs.
// Run from the repo root: node sdlc/changes/followups-finish/evidence/mutations.mjs
import fs from 'node:fs';
import path from 'node:path';
import { runMutants } from '../../../../tests/mutation.mjs';

const T = 'tests/followups-finish.test.mjs';
const m = (label, file, find, replace) => ({ label, file, find, replace, target: T });

const mutants = [
  m('archive preflight skips journal.ndjson and evals.md', 'bin/cli.mjs',
    "path.join(changeDir, 'change.md'), sealedJournalPath(changeDir), evalsSrc,", "path.join(changeDir, 'change.md'),"),
  m('archive preflight skips change.md', 'bin/cli.mjs',
    "path.join(changeDir, 'change.md'), sealedJournalPath(changeDir), evalsSrc,", 'sealedJournalPath(changeDir), evalsSrc,'),
  m('observe --json escapes its values', 'bin/cli.mjs',
    'JSON.stringify(report, null, 2)', 'JSON.stringify(report, (k, v) => (typeof v === "string" ? escapeEntry(v, Infinity) : v), 2)'),
  m('archive preflight skips the live journal', 'bin/cli.mjs',
    "path.join(destDir, 'journal.ndjson'), liveJournal,", "path.join(destDir, 'journal.ndjson'),"),
  m('archive preflight skips the destination', 'bin/cli.mjs',
    "path.join(destDir, 'journal.ndjson'), liveJournal,", 'liveJournal,'),
  m('archive preflight skips specs and rubrics', 'bin/cli.mjs',
    'refuseOutside(projectRoot, deltas.flatMap(', 'void (deltas.flatMap('),
  m('archive preflight skips rubrics only', 'bin/cli.mjs',
    "...(hasEvals ? [path.join(sdlcRoot, 'evals', d.capability, 'rubric.md')] : []),", ''),
  m('a capability may be any text', 'lib/delta.mjs',
    'if (!existing && !CAPABILITY_RE.test(current.capability)) {', 'if (false) {'),
  m('appendJournal follows a link', 'bin/cli.mjs',
    'if (!target || !pathIsContained(path.dirname(sdlcRoot), target)) return false;', 'if (!target) return false;'),
  m('installOrder ignores imports', 'bin/cli.mjs',
    'for (const dep of imports.get(name) ?? []) visit(dep);', ''),
  m('installOrder keeps imports of missing files', 'bin/cli.mjs',
    '.filter((n) => names.includes(n))', ''),
  m('hooks before lib', 'bin/cli.mjs',
    "copyTree(path.join(PKG_ROOT, 'lib'), path.join('sdlc', '.hooks', 'lib'), projectRoot, ctx); copyTree(path.join(PAYLOAD, 'hooks'), path.join('sdlc', '.hooks'), projectRoot, ctx);",
    "copyTree(path.join(PAYLOAD, 'hooks'), path.join('sdlc', '.hooks'), projectRoot, ctx);\n  copyTree(path.join(PKG_ROOT, 'lib'), path.join('sdlc', '.hooks', 'lib'), projectRoot, ctx);"),
  m('release-check ignores the version in the heading', '.github/scripts/release-check.mjs',
    "firstSection.split(' ')[1] !== version", 'false'),
  m('formatIssues prints raw', 'lib/validate.mjs',
    '${escapeEntry(i.where, Infinity)}] ${escapeEntry(i.msg, Infinity)}', '${i.where}] ${i.msg}'),
  m('status line prints raw', 'bin/cli.mjs',
    '${shownLines(`${c.id}  [${c.tier}/${c.status}]  ${c.title}`)}', '${c.id}  [${c.tier}/${c.status}]  ${c.title}'),
  m('observe prints raw', 'lib/observe.mjs',
    'const shown = (value) => escapeEntry(value, Infinity);', 'const shown = (value) => value;'),
  m('observe steering listing raw', 'lib/observe.mjs',
    'lines.push(`  steering/${shown(s.file)} [${shown(s.inclusion)}]', 'lines.push(`  steering/${s.file} [${s.inclusion}]'),
  m('(race only) the move re-check says nothing was merged', 'bin/cli.mjs',
    "'the specs ARE merged and change.md is stamped shipped, but the change folder was not moved: remove the link, then move it under changes/archive/ by hand'", "'nothing was merged'"),
  m('ship impact: waiting id raw', 'lib/relations.mjs',
    'lines.push(`↳ ${escapeEntry(w.id, Infinity)} waits on:', 'lines.push(`↳ ${w.id} waits on:'),
  m('ship impact: parked id raw', 'lib/relations.mjs',
    'lines.push(`↳ ${escapeEntry(p.id, Infinity)} is no longer waiting', 'lines.push(`↳ ${p.id} is no longer waiting'),
  m('ship impact: freed id raw', 'lib/relations.mjs',
    'lines.push(`↳ ${escapeEntry(f.id, Infinity)} is free to resume', 'lines.push(`↳ ${f.id} is free to resume'),
  m('unreadable neighbour printed raw by archive', 'bin/cli.mjs',
    'for (const msg of relations.readErrors) console.error(shownLines(`⚠ ${msg}`));', 'for (const msg of relations.readErrors) console.error(`⚠ ${msg}`);'),
  m('CLI refusals print raw', 'bin/cli.mjs',
    'console.error(shownLines(err.message ?? err));', 'console.error(String(err.message ?? err));'),
  m('archive success line raw', 'bin/cli.mjs',
    'console.log(`shipped: ${escapeEntry(changeId, Infinity)}`);', 'console.log(`shipped: ${changeId}`);'),
  m('journal hook set-active raw', 'payload/hooks/journal.mjs',
    'const shown = escapeEntry(change, Infinity);', 'const shown = change;'),
  m('pointer write follows a linked .state (row 16b OUT clause)', 'lib/active.mjs',
    'if (!isRealPathInside(sdlcRoot, cur)) return false;', ''),
  m('journal hook open-ship raw', 'payload/hooks/journal.mjs',
    'ship gate open for "${escapeEntry(change, Infinity)}"', 'ship gate open for "${change}"'),
  m('session summary raw', 'payload/hooks/session-summary.mjs',
    '` · change ${escapeEntry(change, Infinity)}`', '` · change ${change}`'),
  m('Active change line raw', 'payload/hooks/inject-context.mjs',
    'sdlc/changes/${escapeEntry(active, Infinity)}/change.md', 'sdlc/changes/${active}/change.md'),
  m('steering pointer raw', 'payload/hooks/validate-artifact.mjs',
    'sdlc/context/steering/${escapeEntry(f, Infinity)}', 'sdlc/context/steering/${f}'),
  m('capForChange indexes CAPS with any tier', 'lib/caps.mjs',
    'return CAPS.change[effectiveTier(tier)];', 'return CAPS.change[tier] ?? CAPS.change.standard;'),
  m('validate reads the raw tier for the cap', 'lib/validate.mjs',
    'const tier = effectiveTier(data.tier);', 'const tier = data.tier;'),
  m('green guard row 13: relation entries take any text', 'lib/relations.mjs',
    'const ENTRY_RE = /^[A-Za-z0-9._-]{1,100}$/;', 'const ENTRY_RE = /^.{1,100}$/u;'),
  // Defence in depth behind the preflight: only a link swapped in mid-run reaches these, which no
  // black-box row can stage. Expected to survive; listed so the count says so.
  m('(race only) no recheck before the rename', 'bin/cli.mjs',
    "refuseOutside(projectRoot, [destDir, path.join(changeDir, 'change.md')],", 'void ([destDir],'),
  m('(race only) archive writes follow links', 'bin/cli.mjs',
    "if (!writeInProject(projectRoot, dest, out)) throw new Error(outsideProject(projectRoot, dest, 'not written'));",
    'fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, out);'),
];

const root = process.cwd();
const { baseline, count, results } = runMutants({ root, targets: [T], mutants });
const lines = [`baseline: ${baseline ?? 'green'} · mutants: ${mutants.length} · killed: ${count ?? 'n/a'}`];
for (const r of results) lines.push(`${r.killed ? 'KILLED  ' : 'SURVIVED'} ${r.label} — ${r.rows.join(', ') || r.why}`);
const out = lines.join('\n') + '\n';
fs.writeFileSync(path.join(root, 'sdlc/changes/followups-finish/evidence/mutations.txt'), out);
process.stdout.write(out);

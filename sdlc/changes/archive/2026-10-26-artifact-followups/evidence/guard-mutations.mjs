// artifact-followups: rows 13-14 are green guards, so they are proven by mutation instead of a
// red-first run. Usage: node guard-mutations.mjs <repo root>. Each mutation is applied, the
// pinned row is run, and the file is restored byte-for-byte. Only these mutations were run.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.argv[2];
const T = 'tests/change-artifacts.test.mjs';
const LIB = 'lib/artifacts.mjs';
const AF = 'tests/artifact-followups.test.mjs';
const ANCHOR = "const MAX_ENTRY = 2000;";

const MUTATIONS = [
  { label: 'row 25: an fs alias', file: LIB, find: ANCHOR, replace: `${ANCHOR}\nconst g = fs;`, row: 25 },
  { label: 'row 25: an optional fs call', file: LIB, find: ANCHOR, replace: `${ANCHOR}\nconst h = () => fs?.readFileSync;`, row: 25 },
  { label: 'row 25: a spaced dynamic import', file: LIB, find: ANCHOR, replace: `${ANCHOR}\nconst k = () => import ('node:fs');`, row: 25 },
  { label: "row 25: process['binding']", file: 'lib/fences.mjs', find: "export function sectionEndIndex", replace: "const b = () => process['binding'];\nexport function sectionEndIndex", row: 25 },
  { label: 'row 4: a stamp that matches by prefix (touches plan.html-old)', file: LIB,
    find: "parseEntry(lines[i].line).path === target", replace: "(parseEntry(lines[i].line).path ?? '').startsWith(target)", row: 4 },
  // Review 1 (quality): mutations that survived the first test set, each now pinned.
  { label: 'review 1: escapeEntry drops Cf', file: 'lib/relations.mjs', find: '\\p{Cc}\\p{Cf}', replace: '\\p{Cc}', row: 1, test: AF },
  { label: 'review 1: park waiters printed raw', file: 'lib/park.mjs', find: 'waiters.map((w) => escapeEntry(w)).join', replace: 'waiters.join', row: '4b', test: AF },
  { label: 'review 1: cmdArtifact refuse() echoes the raw id', file: 'bin/cli.mjs', find: 'new Error(`cannot stamp "${shown}": artifact/${name} ${why}', replace: 'new Error(`cannot stamp "${changeId}": artifact/${name} ${why}', row: 3, test: AF },
  { label: 'review 1: cap boundary >= instead of >', file: 'bin/cli.mjs', find: '&& grown > cap', replace: '&& grown >= cap', row: '8b', test: AF },
  { label: 'review 1: hint lets a leading dash through', file: LIB, find: '/^[A-Za-z0-9_][A-Za-z0-9._-]*$/', replace: '/^[A-Za-z0-9._-]+$/', row: 5, test: AF },
  // Review 2 (quality): a widened class survived the sampled ids.
  { label: 'review 2: hint class widened with &', file: LIB, find: '/^[A-Za-z0-9_][A-Za-z0-9._-]*$/', replace: '/^[A-Za-z0-9_][A-Za-z0-9._&-]*$/', row: '5b', test: AF },
  { label: 'review 2: hint first char widened with .', file: LIB, find: '/^[A-Za-z0-9_][A-Za-z0-9._-]*$/', replace: '/^[A-Za-z0-9_.][A-Za-z0-9._-]*$/', row: '5b', test: AF },
  // Review 3 (quality): a widening into the control range survived the printable-ASCII sweep.
  { label: 'review 3: hint class widened with ESC', file: LIB, find: '/^[A-Za-z0-9_][A-Za-z0-9._-]*$/', replace: '/^[A-Za-z0-9_][A-Za-z0-9._' + String.fromCharCode(92) + 'x1b-]*$/', row: '5b', test: AF },
];

function run(row, file = T) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern', `^row ${row}:`, file],
    { cwd: ROOT, encoding: 'utf8', env });
  return r.stdout.split('\n').filter((l) => /^# (pass|fail)/.test(l)).join(' · ');
}

for (const m of MUTATIONS) {
  const abs = path.join(ROOT, m.file);
  const orig = fs.readFileSync(abs, 'utf8');
  if (!orig.includes(m.find)) throw new Error(`anchor missing for: ${m.label}`);
  fs.writeFileSync(abs, orig.replace(m.find, m.replace));
  let off;
  try { off = run(m.row, m.test); } finally { fs.writeFileSync(abs, orig); }
  console.log(`${m.label}\n  mutated:  ${off}\n  restored: ${run(m.row, m.test)} · bytes equal: ${fs.readFileSync(abs, 'utf8') === orig}`);
}

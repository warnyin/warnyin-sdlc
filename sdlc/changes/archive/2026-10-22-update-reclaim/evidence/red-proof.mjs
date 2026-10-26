// update-reclaim red proof. Usage: node red-proof.mjs <repo root>
// Each mutation below switches off one guard this change adds, runs the rows that pin it, and
// restores the file byte-for-byte. Only these mutations were run; a guard not listed is not proven
// here. Row 25 needs a case-sensitive folder: set WSDLC_CASE_SENSITIVE_DIR on Windows (fsutil file
// setCaseSensitiveInfo <dir> enable); on a case-folding host without it, row 25 skips.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.argv[2];
const SEC = 'tests/security-regressions.test.mjs';
const RECLAIM = 'tests/update-reclaim.test.mjs';

const MUTATIONS = [
  {
    label: 'containment off (pathIsContained always true, plain write)',
    file: 'bin/cli.mjs',
    find: "import { writeFileContained, isRealPathInside, pathIsContained } from '../lib/safe-path.mjs';",
    replace: "import { isRealPathInside } from '../lib/safe-path.mjs';\nconst pathIsContained = () => true;\n"
      + 'const writeFileContained = (root, file, data) => { fs.writeFileSync(file, data); return true; };',
    runs: [[SEC, '^update-reclaim row (18|19|20|22):'], [RECLAIM, '^row 13b?:']],
  },
  {
    label: 'refused path drops its recorded ownership (linked() no longer restores the manifest entry)',
    file: 'bin/cli.mjs',
    find: '    if (owned) ctx.manifest.set(relPosix, owned);\n',
    replace: '',
    runs: [[SEC, '^update-reclaim row 20:']],
  },
  {
    label: 'case folding off (exact realpath compare only)',
    file: 'lib/safe-path.mjs',
    find: 'if (!caseFolding || !real.startsWith(realRoot)) return false;',
    replace: 'return false;',
    runs: [[SEC, '^update-reclaim row 23:']],
  },
  {
    label: 'case folding forgives a link (no lstat walk below the root)',
    file: 'lib/safe-path.mjs',
    find: 'return noLinkBelow(root, target);',
    replace: 'return true;',
    runs: [[SEC, '^update-reclaim row 25:']],
  },
  {
    label: 'whole-file EOL normalization back in writeInProject',
    file: 'bin/cli.mjs',
    find: '  return writeFileContained(projectRoot, dest, content);\n}',
    replace: '  return writeFileContained(projectRoot, dest, TEXT_EXT.has(path.extname(dest)) ? normalizeEol(content) : content);\n}',
    runs: [[SEC, '^update-reclaim row 24:']],
  },
  {
    label: 'appended marker block written LF into a CRLF file',
    file: 'bin/cli.mjs',
    find: 'normalizeEol(content).replace(/\\n/g, eol)',
    replace: 'normalizeEol(content)',
    runs: [[SEC, '^update-reclaim row 24:']],
  },
  {
    label: '.gitignore entry written LF into a CRLF file',
    file: 'bin/cli.mjs',
    find: 'current + entry + eol',
    replace: "current + entry + '\\n'",
    runs: [[SEC, '^update-reclaim row 24:']],
  },
];

function runRows(target, pattern) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern', pattern, target],
    { cwd: ROOT, encoding: 'utf8', env });
  return r.stdout.split('\n').filter((l) => /^(not )?ok \d+ - /.test(l) || /^# (pass|fail|skip)/.test(l));
}

for (const m of MUTATIONS) {
  const abs = path.join(ROOT, m.file);
  const orig = fs.readFileSync(abs, 'utf8');
  const text = orig.replace(/\r\n/g, '\n');
  if (!text.includes(m.find)) throw new Error(`anchor missing for: ${m.label}`);
  console.log(`\n== ${m.label}`);
  fs.writeFileSync(abs, text.replace(m.find, m.replace));
  try {
    for (const [target, pattern] of m.runs) for (const l of runRows(target, pattern)) console.log(`  off  ${l}`);
  } finally {
    fs.writeFileSync(abs, orig);
  }
  for (const [target, pattern] of m.runs) for (const l of runRows(target, pattern)) console.log(`  on   ${l}`);
  console.log(`  restored: ${fs.readFileSync(abs, 'utf8') === orig}`);
}

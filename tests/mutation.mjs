// Mutation helper for doctrine and code pins (verify.md: a count stands only on a passing
// baseline, and mutants are made in a copy of the tree). Not a test file: no `.test.` in the name.
//
// runMutants({ root, targets, mutants }):
// - copies `root` to a temp dir (without .git and node_modules) and works only there, so an
//   interrupted run leaves the working tree untouched;
// - runs every target test file unmutated first; a red baseline returns `count: null`;
// - for each mutant { label, file, find, replace, target } replaces `find` (matched across
//   wrapped lines) in `file`, runs `target`, and restores the file in the copy.
// A mutant is killed when at least one `row N` of its target turns red; a missing anchor counts as
// not killed. Rows are reported with their file, so rows of different targets never read alike.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SKIP = new Set(['.git', 'node_modules']);

function copyTree(root, copy) {
  fs.cpSync(root, copy, {
    recursive: true,
    filter: (src) => !path.relative(root, src).split(path.sep).some((part) => SKIP.has(part)),
  });
}

function runTarget(cwd, target) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const res = spawnSync(process.execPath, ['--test', '--test-reporter=tap', target], { cwd, encoding: 'utf8', env });
  const rows = [...(res.stdout ?? '').matchAll(/^not ok \d+ - (row \d+)/gm)].map((m) => `${target} ${m[1]}`);
  const why = ((res.stdout ?? '').match(/^\s+error: [|>-]?\s*\n?\s*['"]?([^\n'"]{1,110})/m) ?? [])[1] ?? '';
  return { status: res.status, rows, why: why.trim() };
}

// The anchor matched with any whitespace run between its words, so a wrapped line still matches.
function looseRegExp(find) {
  const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(find.trim().split(/\s+/).map(esc).join('\\s+'));
}

export function runMutants({ root, targets, mutants }) {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-mutants-'));
  try {
    copyTree(root, copy);
    for (const target of targets) {
      const base = runTarget(copy, target);
      if (base.status !== 0) return { baseline: 'red', redTarget: target, count: null, results: [] };
    }
    const results = mutants.map(({ label, file, find, replace, target }) => {
      const abs = path.join(copy, file);
      const orig = fs.readFileSync(abs, 'utf8');
      const text = orig.replace(/\r\n/g, '\n');
      const re = looseRegExp(find);
      if (!re.test(text)) return { label, killed: false, rows: [], why: 'anchor missing' };
      fs.writeFileSync(abs, text.replace(re, () => replace));
      try {
        const run = runTarget(copy, target);
        return { label, killed: run.rows.length > 0, rows: run.rows, why: run.why };
      } finally {
        fs.writeFileSync(abs, orig);
      }
    });
    const killed = results.filter((r) => r.killed).length;
    return { baseline: 'green', count: `${killed} of ${results.length}`, killed, total: results.length, results };
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
  }
}

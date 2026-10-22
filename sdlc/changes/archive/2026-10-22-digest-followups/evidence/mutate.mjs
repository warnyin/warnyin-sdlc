// digest-followups mutation pass. Usage: node mutate.mjs <repo root>
// Runs through tests/mutation.mjs: a copy of the tree, a green baseline first (or no count), then
// for every (rule, stating file) pair a DELETE and a MEANING-INVERTING mutant, prefix mutants on the
// pins this change bounded, and code mutants on lib/observe.mjs. Prints N of M, each mutant with
// the rows (file + row) it turned red and the first failing assertion.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.argv[2];
const { runMutants } = await import(pathToFileURL(path.join(ROOT, 'tests', 'mutation.mjs')).href);

const DF = 'tests/digest-followups.test.mjs';
const GMT = 'tests/gate-moving-target.test.mjs';
const ALR = 'tests/anti-loop-rules.test.mjs';
const REVIEW = 'payload/playbook/review.md';
const VERIFY = 'payload/playbook/verify.md';
const BS = String.fromCharCode(92);

const S = {
  R1: "Take the change's diff from a snapshot of the tree: with a scratch index at a path that does not exist yet, `GIT_INDEX_FILE=<tmp> git add -A` then `git write-tree`, so untracked files are in it and the real index is untouched; the change's diff is `git diff HEAD <tree>`.",
  R1b: "Commit every other open change first, so the snapshot holds this change alone; every path it lists goes to the reviewers.",
  R1c: "A file that must never reach a reviewer must be untracked and matched by `.gitignore` before the snapshot; a tracked file is in the snapshot whatever `.gitignore` says.",
  R2: "Every review note but the skip note carries that snapshot as `base=<tree>`, and a repeated panel's fix diff comes from `git diff <base> <tree>`, with `<tree>` taken the same way now; if git has pruned `<base>`, the repeated panel gets the change's whole diff instead.",
  R3: "The human's reason line in change.md starts with `closed=human:` and says why.",
  R5: '`node sdlc/.hooks/journal.mjs note review blockers=<n> mode=<panel|solo> base=<tree>`.',
  LENS_S8: 'Each lens reviewer is handed this rule with its brief. A finding is a security, data-loss or contract defect by its effect, not by the label it carries; when unsure, it is one.',
  V1: 'Verify never writes a `review` note, the skip note included.',
  V2: 'A mutation count stands only on a passing baseline: the unmutated tests run first, and a red baseline voids the count.',
  V3: "A pass journaled before its suite was green is corrected, never deleted: `node sdlc/.hooks/journal.mjs note correction gate=<fast|final> round=<n>`, then the re-run's verify note carries `rerun=yes`.",
  V4: 'Mutants are made in a copy of the tree, never in the working tree, so an interrupted run leaves nothing mutated.',
  B1: `Write file text with the file tools, never a shell heredoc: the shell drops \`${BS}s\`, \`${BS}t\` and \`${BS}u0001\`, so scan each written file for control characters.`,
  D1: 'An agent file carries verbatim a rule it applies; a term it only reads is defined once, in the playbook, and the agent points there.',
  H1: "Its own exit code decides a pass; a pipe reports the last stage's exit, not the suite's.",
  OBS: '`human-closed×N` (blockers a human closed without a fix or re-run) and `corrected×N`',
};

const INVERT = {
  R1: ['the real index is untouched', 'the real index is rewritten'],
  R1b: ['every path it lists goes to the reviewers', 'only the paths its tasks name go to the reviewers'],
  R1c: ['must be untracked and matched by', 'may be tracked or untracked and matched by'],
  R2: ['the repeated panel gets the change\'s whole diff instead', 'the repeated panel is skipped'],
  R3: ['and says why', 'and may stay empty'],
  R5: ['base=<tree>`.', '`.'],
  LENS_S8: ['when unsure, it is one.', 'when unsure, it is not one.'],
  V1: ['Verify never writes', 'Verify may write'],
  V2: ['a red baseline voids the count', 'a red baseline still counts'],
  V3: ['corrected, never deleted', 'deleted, never corrected'],
  V4: ['never in the working tree', 'or in the working tree'],
  B1: ['never a shell heredoc', 'or a shell heredoc'],
  D1: ['carries verbatim a rule it applies', 'points to a rule it applies'],
  H1: ['Its own exit code decides a pass', 'The last stage decides a pass'],
  OBS: ['`human-closed×N`', '`human-closed`'],
};

const STATED = [
  [REVIEW, ['R1', 'R1b', 'R1c', 'R2', 'R3', 'R5', 'LENS_S8']],
  [VERIFY, ['V1', 'V2', 'V3', 'V4']],
  ['payload/playbook/build.md', ['B1']],
  ['docs/design.md', ['D1']],
  ['sdlc/harness.md', ['H1']],
  ['payload/templates/harness.md', ['H1']],
  ['payload/playbook/observe.md', ['OBS']],
];

const M = [];
const add = (label, file, find, replace, target = DF) => M.push({ label, file, find, replace, target });
for (const [file, rules] of STATED) {
  for (const r of rules) {
    add(`${r} deleted (${file})`, file, S[r], '');
    const [f, t] = INVERT[r];
    add(`${r} meaning-inverted, shape kept (${file})`, file, S[r], S[r].replace(f, t));
  }
}
add('R4 lens rule moved out of the lens bullet (review.md)', REVIEW, S.LENS_S8, '');
add('closed=human command loses base=<tree> (review.md)', REVIEW, 'mode=solo closed=human base=<tree>', 'mode=solo closed=human');
add('observe: archived changes flagged too', 'lib/observe.mjs', 'if (!c.archived && c.humanReasons < c.humanClosed)', 'if (c.humanReasons < c.humanClosed)');

// Prefix mutants on pins this change bounded (full sentences now, or clause starts).
add('gmt reviewRepeatedPanel prefixed "Never:"', REVIEW, 'Fan out in parallel, all read-only,', 'Never: Fan out in parallel, all read-only,', GMT);
add('gmt verifyRescoreTrigger prefixed "Ignore this -"', VERIFY, 'The re-score after a failed fast gate also hands it', 'Ignore this - The re-score after a failed fast gate also hands it', GMT);
add('gmt passBar clause prefixed "not"', 'payload/templates/contract-evals.md', '- all non-advisory scores ≥ 4;', '- not all non-advisory scores ≥ 4;', GMT);
add('gmt changelogAdvisory clause prefixed "never"', 'CHANGELOG.md', ': the over-build rubric line is now', ': never the over-build rubric line is now', GMT);
add('anti-loop A prefixed "Never -"', 'payload/adapters/claude/agents/sdlc-contractor.md', 'A row that pins a rule written in prose asserts', 'Never - A row that pins a rule written in prose asserts', ALR);

// Code mutants on lib/observe.mjs.
const OBSERVE = 'lib/observe.mjs';
add('observe: a rerun replaces a fail too', OBSERVE, "if (j === -1 || events[j].result !== 'pass') return;", 'if (j === -1) return;');
add('observe: no correction needed', OBSERVE, 'if (corrected) dropped.add(j);', 'dropped.add(j);');
add('observe: rerun ignored', OBSERVE, 'if (!replaced.has(i)) countVerify(verify, gates, e);', 'countVerify(verify, gates, e);');
add('observe: rerun value not folded', OBSERVE, "foldValue(e.rerun) !== 'yes'", "e.rerun !== 'yes'");
add('observe: closed value not folded', OBSERVE, "foldValue(e.closed) === 'human'", "e.closed === 'human'");
add('observe: an empty reason counts', OBSERVE, `const HUMAN_REASON = /^closed=human:[ ${BS}t]*${BS}S/gm;`, 'const HUMAN_REASON = /^closed=human:/gm;');
add('observe: one reason covers every closure', OBSERVE, 'c.humanReasons < c.humanClosed', '(c.humanReasons === 0 && c.humanClosed > 0)');
add('observe: corrections not counted', OBSERVE, "if (foldValue(e.event) === 'correction') corrections++;", '');
add('observe: human-closed not shown', OBSERVE, "(c.humanClosed > 0 ? ` · human-closed×${c.humanClosed}` : '')", "''");

const res = runMutants({ root: ROOT, targets: [DF, GMT, ALR], mutants: M });
if (res.baseline !== 'green') {
  console.log(`BASELINE RED  ${res.redTarget} — no count reported`);
  process.exit(2);
}
console.log('baseline green  ' + [DF, GMT, ALR].join(', '));
for (const r of res.results) {
  console.log(`${r.killed ? 'killed  ' : 'SURVIVED'}  ${r.label}  [${r.rows.join(', ') || 'no row red'}]  ${r.why}`);
}
console.log(`\n${res.count} mutants killed`);

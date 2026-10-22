// Contract rows for gate-moving-target: sdlc/changes/gate-moving-target/contract/tests.md.
// Each doctrine row pins its rule as an EXACT sentence (RULES below), compared after whitespace is
// collapsed, inside the one anchor that must carry it. No regex reads the meaning: a rule inverted
// by a single word ("not", "never", "goes to the digest") no longer equals its sentence and the row
// goes red. Changing a rule's wording is a deliberate edit to RULES and to the payload together.
// The existing test files the guard rows used to re-run are run by the suite itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CAPS, countEffectiveLines } from '../lib/caps.mjs';
import { PKG_ROOT } from './helpers.mjs';
import {
  assertAbsent, assertRule as pinRule, body, nonEmpty, oneLine, payload, payloadFilesWith, section, step,
} from './rule-pins.mjs';

const read = (...rel) => fs.readFileSync(path.join(...rel), 'utf8');

// The rules, verbatim. One place to read what the payload promises; one place to change it.
// gate-rules-second-pass rewrote the bundle, the evaluator input and the re-score into one shared
// wording (its contract S1, S3, S4); those rows pin the new sentences.
const RESCORE = 'A line that met the bar keeps its score unless the fix diff touched what it judged; a touched line now below the bar fails the round; a new finding on code the fix diff left untouched goes to the change for the digest and does not fail the round, unless it is a security, data-loss or contract defect, which fails the round wherever it is.';
const RULES = Object.freeze({
  passBar: 'all non-advisory scores ≥ 4; an `(advisory)` line is outside the bar and its findings go to the change for the digest; only a minimalism line may be advisory, never a security, data or contract line',
  evaluatorAdvisory: 'A line marked `(advisory)` is scored and listed with its evidence like any other, but it can never turn the verdict to FAIL; its findings go to the digest.',
  evaluatorMinimalismOnly: 'Only a minimalism line may be advisory, never a security, data or contract line: judge any other `(advisory)` mark as a normal line.',
  skillExample: 'A written pass bar (e.g. "all non-advisory ≥ 4")',
  skillOutsideBar: 'A rubric line marked `(advisory)` (over-build is seeded so) is scored but outside the pass bar.',
  skillMinimalismOnly: 'Only a minimalism line may be advisory, never a security, data or contract line.',
  verifyBundle: 'It is handed the rubric + the Delta + `contract/tests.md` + the diff + this round\'s test output + the change\'s journal, and returns a score per rubric line.',
  verifyNoteAfter: 'This round\'s verify note is written after its verdict, so the evaluator does not wait for it.',
  evaluatorInput: 'Input: `contract/evals.md` (the rubric), the change\'s Delta, `contract/tests.md`, the diff, this round\'s test output and the change\'s journal; score only from those.',
  evaluatorNoteNotEvidence: 'The verify note for this round is written after your verdict, so a missing verify note is not evidence; no line is marked down for it.',
  verifyRescoreTrigger: 'The re-score after a failed fast gate also hands it the previous verdict and the fix diff — everything edited since the failed round\'s verify note.',
  verifyFixDiffDefinition: 'the fix diff — everything edited since the failed round\'s verify note',
  verifyRescore: RESCORE,
  evaluatorRescore: `On a re-score after a failed fast gate you also get the previous verdict and the fix diff. ${RESCORE}`,
  reviewRepeatedPanel: 'Fan out in parallel, all read-only, each given the diff + change.md; after a review that recorded blockers, every reviewer is also briefed with the previous blockers and the fix diff: a blocker is raised only for a previous blocker not closed, a defect the fix diff causes, or a security, data-loss or contract defect wherever it is; anything else is an improvement, so the panel can still record zero blockers.',
  changelogAdvisory: 'the over-build rubric line is now `(advisory)`',
  changelogExistingEvals: 'A change\'s existing `contract/evals.md` keeps its old unmarked line until edited by hand.',
});

// Literal text a rule's anchor must no longer carry (old wording that would contradict the rule).
const FORBIDDEN = Object.freeze({
  oldPassBar: 'all scores ≥ 4',
  oldSkillExamples: ['"all ≥4"', '"all scores ≥ 4"'],
  oldTaskLog: 'the task log',
  oldReviewBrief: 'each with the diff + change.md only',
  fixDiffRedefinitions: ['fix diff —', 'fix diff (', 'fix diff means', 'fix diff is', 'fix diff ='],
});

// Each rule through the shared pin (tests/rule-pins.mjs): a full sentence bounded, a clause verbatim.
function assertRule(anchor, key, where) {
  pinRule(anchor, RULES[key], `${where} (RULES.${key})`);
}

const contractEvals = () => payload('templates', 'contract-evals.md');
const evaluator = () => body(payload('adapters', 'claude', 'agents', 'sdlc-evaluator.md'), 'sdlc-evaluator.md');
const skillEvals = () => nonEmpty(section(payload('adapters', 'claude', 'skills', 'contract-writing', 'SKILL.md'), 'contract/evals.md'),
  'contract-writing SKILL.md ## contract/evals.md');
const reviewStep1 = () => nonEmpty(step(payload('playbook', 'review.md'), 1), 'review.md step 1');

// verify.md step 1's Evals bullet: from `**Evals (non-deterministic)**` up to the next `   - **` bullet.
function verifyEvalsBullet() {
  const one = nonEmpty(step(payload('playbook', 'verify.md'), 1), 'verify.md step 1');
  const lines = one.split(/\r?\n/);
  const start = lines.findIndex((l) => l.includes('**Evals (non-deterministic)**'));
  assert.ok(start > -1, 'verify.md step 1 has no **Evals (non-deterministic)** bullet');
  const rel = lines.slice(start + 1).findIndex((l) => l.startsWith('   - **'));
  return nonEmpty(lines.slice(start, rel === -1 ? undefined : start + 1 + rel).join('\n'), 'verify.md Evals bullet');
}

test('row 1: the Over-build rubric bullet is marked (advisory) and no other rubric bullet is', () => {
  const rubric = nonEmpty(section(contractEvals(), 'Rubric'), 'contract-evals.md ## Rubric');
  const list = rubric.split(/\n(?=- )/).filter((b) => b.startsWith('- '));
  const overBuild = list.filter((b) => b.startsWith('- Over-build'));
  assert.equal(overBuild.length, 1, 'exactly one Over-build rubric bullet');
  assert.ok(overBuild[0].startsWith('- Over-build (advisory):'), 'the Over-build bullet must read "- Over-build (advisory): …"');
  for (const b of list.filter((x) => !x.startsWith('- Over-build'))) {
    assert.ok(!b.includes('(advisory)'), `only the Over-build bullet may be advisory, got: ${oneLine(b)}`);
  }
});

test('row 2: the pass bar states the non-advisory bar, the digest and the minimalism-only rule verbatim', () => {
  const text = contractEvals();
  const bar = nonEmpty(section(text, 'Pass bar'), 'contract-evals.md ## Pass bar');
  assertRule(bar, 'passBar', 'contract-evals.md ## Pass bar');
  assertAbsent(bar, FORBIDDEN.oldPassBar, 'contract-evals.md ## Pass bar', 'the old bar counted advisory lines');
  assert.match(text, new RegExp(`cap:${CAPS.contractEvals}\\b`), `contract-evals.md keeps cap:${CAPS.contractEvals}`);
  assert.ok(countEffectiveLines(text) <= CAPS.contractEvals, `contract-evals.md stays within ${CAPS.contractEvals} lines`);
});

test('row 4: sdlc-evaluator scores and lists an (advisory) line, never FAILs on it, and allows only minimalism lines to be advisory', () => {
  const s = evaluator();
  assertRule(s, 'evaluatorAdvisory', 'sdlc-evaluator.md');
  assertRule(s, 'evaluatorMinimalismOnly', 'sdlc-evaluator.md');
});

test('row 5: contract-writing SKILL keeps (advisory) lines outside the pass bar, minimalism only, with a qualified example', () => {
  const s = skillEvals();
  for (const key of ['skillExample', 'skillOutsideBar', 'skillMinimalismOnly']) assertRule(s, key, 'contract-writing SKILL.md');
  for (const lit of FORBIDDEN.oldSkillExamples) assertAbsent(s, lit, 'contract-writing SKILL.md', 'an unqualified example counts advisory lines');
});

test('row 6: the verify Evals bullet hands the evaluator the rubric, the diff, this round test output and the journal', () => {
  const b = verifyEvalsBullet();
  assertRule(b, 'verifyBundle', 'verify.md Evals bullet');
  assertAbsent(b, FORBIDDEN.oldTaskLog, 'verify.md Evals bullet', 'the bundle is fixed: test output and journal, not a task log');
});

test('row 7: the verify note for this round is written after the evaluator verdict', () => {
  assertRule(verifyEvalsBullet(), 'verifyNoteAfter', 'verify.md Evals bullet');
});

test('row 8: the evaluator scores only from the bundle, and an absent verify note for this round is not evidence', () => {
  const s = evaluator();
  assertRule(s, 'evaluatorInput', 'sdlc-evaluator.md');
  assertRule(s, 'evaluatorNoteNotEvidence', 'sdlc-evaluator.md');
});

test('row 9: after a failed fast gate the verify re-score judges what failed and what the fix touched, with the security exception', () => {
  const b = verifyEvalsBullet();
  assertRule(b, 'verifyRescoreTrigger', 'verify.md Evals bullet');
  assertRule(b, 'verifyRescore', 'verify.md Evals bullet');
});

test('row 10: the evaluator re-score keeps met lines unless touched, fails touched ones, and fails a security defect anywhere', () => {
  assertRule(evaluator(), 'evaluatorRescore', 'sdlc-evaluator.md');
});

test('row 11: a repeated review panel is briefed with the previous blockers and the fix diff, with the security exception', () => {
  const s = reviewStep1();
  assertRule(s, 'reviewRepeatedPanel', 'review.md step 1');
  assertAbsent(s, FORBIDDEN.oldReviewBrief, 'review.md step 1', 'the brief must also cover a repeated panel');
});

// review.md states where a repeated panel's fix diff runs from (gate-rules-second-pass S13), in words
// that are not a redefinition of verify.md's: none of FORBIDDEN.fixDiffRedefinitions.
test('row 13: "fix diff" is defined once, in verify.md, and nowhere defined again', () => {
  const definition = oneLine(RULES.verifyFixDiffDefinition);
  const holders = payloadFilesWith(definition).map((f) => `payload/${f}`);
  assert.deepEqual(holders, ['payload/playbook/verify.md'], `RULES.verifyFixDiffDefinition must appear in verify.md only, got ${JSON.stringify(holders)}`);
  assertRule(verifyEvalsBullet(), 'verifyRescoreTrigger', 'verify.md Evals bullet');
  for (const [where, text] of [['sdlc-evaluator.md', evaluator()], ['review.md', payload('playbook', 'review.md')]]) {
    for (const lit of FORBIDDEN.fixDiffRedefinitions) assertAbsent(text, lit, where, 'verify.md is the one definition');
  }
});

// The entry shipped in 0.25.0; later changes add their own `## Unreleased` section above it.
test('row 14: the 0.25.0 CHANGELOG section names the advisory over-build line and the evals.md that keep the old one', () => {
  const changelog = read(PKG_ROOT, 'CHANGELOG.md');
  const released = nonEmpty(section(changelog, '0.25.0 (2026-10-20)'), 'CHANGELOG.md ## 0.25.0 (2026-10-20)');
  assertRule(released, 'changelogAdvisory', 'CHANGELOG.md ## 0.25.0');
  assertRule(released, 'changelogExistingEvals', 'CHANGELOG.md ## 0.25.0');
});

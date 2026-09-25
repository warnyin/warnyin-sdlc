// Contract rows for minimal-build: sdlc/changes/minimal-build/contract/tests.md.
// Each row tests doctrine about the minimal-code ladder and how over-build is caught.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { countEffectiveLines } from '../lib/caps.mjs';
import { makeTempProject, runCli, PKG_ROOT } from './helpers.mjs';

const read = (...rel) => fs.readFileSync(path.join(...rel), 'utf8');
const pb = (rel) => read(PKG_ROOT, 'payload', 'playbook', rel);
const agent = (rel) => read(PKG_ROOT, 'payload', 'adapters', 'claude', 'agents', rel);
const template = (rel) => read(PKG_ROOT, 'payload', 'templates', rel);
const oneLine = (s) => s.replace(/\s+/g, ' ');

// A `## Heading` section runs to the next `## ` line or the end of the file.
function section(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`## ${heading}`));
  if (start === -1) return '';
  const rel = lines.slice(start + 1).findIndex((l) => l.startsWith('## '));
  return lines.slice(start, rel === -1 ? undefined : start + 1 + rel).join('\n');
}

// A numbered step runs from its "N. " line to the next top-level step line — wrapped lines included.
function step(text, n) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`${n}. `));
  if (start === -1) return '';
  const rel = lines.slice(start + 1).findIndex((l) => /^\d+[a-z]?\.\s/.test(l));
  return lines.slice(start, rel === -1 ? undefined : start + 1 + rel).join('\n');
}

// Each regex must first match after the previous one's match.
function assertInOrder(text, patterns, desc) {
  let last = -1;
  for (const re of patterns) {
    const idx = text.slice(last + 1).search(re);
    assert.ok(idx > -1, `${desc}: ${re} must appear after the previous rung`);
    last = last + 1 + idx;
  }
}

const RUNGS = [
  /need to exist/i,
  /(already )?in (this|the) codebase/i,
  /stdlib|standard library/i,
  /native platform/i,
  /(installed|existing) dependenc/i,
  /smallest new code/i,
];
const TAGS = ['delete:', 'stdlib:', 'native:', 'yagni:', 'shrink:'];
// Polarity matters: the over-build FINDINGS are reported as improvements, never as blockers.
const IMPROVEMENT_NEVER_BLOCKER = /over-?build (findings?|lines?)[^.]{0,120}(always|only|reported as|are) (an? )?improvements?[^.]{0,60}never (an? )?blockers?/i;

function assertPrinciplesLadder(text, desc) {
  const s = oneLine(section(text, 'Minimalism'));
  assert.ok(s.length > 0, `${desc}: must have a ## Minimalism section`);
  assertInOrder(s, RUNGS, desc);
}

function assertBuildPointer(text, desc) {
  const rules = oneLine(text.slice(text.indexOf('Rules for whoever implements')));
  assert.ok(text.includes('Rules for whoever implements'), `${desc}: must keep its implementer rules`);
  assert.match(rules, /principles\.md[^.]{0,40}Minimalism/i, `${desc}: a rule must name principles.md § Minimalism`);
  assert.match(rules, /trac(e|ing)[^.]{0,40}(touched code|code (the|this|your) (task|change) touches)[^.]{0,80}(before|then)[^.]{0,60}first rung that holds/i,
    `${desc}: trace the touched code before taking the first rung that holds`);
}

function assertBuilderLadder(text, desc) {
  const s = oneLine(text);
  assertInOrder(s, [/trac(e|ing)/i, ...RUNGS.slice(1)], `${desc} (trace first, then rungs)`);
  assert.match(s, /never[^.]{0,80}(drop|cut|remove)[^.]{0,80}contract row/i, `${desc}: never drops a contract row`);
  assert.match(s, /never[^.]{0,160}trust-boundary (guard|validation)/i, `${desc}: never drops a trust-boundary guard`);
}

function assertQualityOverBuild(text, desc) {
  const s = oneLine(text);
  assert.match(s, /blocker\|improvement\|note · <finding> · <where> · <why>/, `${desc}: return line intact`);
  for (const tag of TAGS) assert.ok(s.includes(`\`${tag}\``), `${desc}: must name the tag \`${tag}\``);
  assert.match(s, IMPROVEMENT_NEVER_BLOCKER, `${desc}: over-build is an improvement, never a blocker`);
  assert.match(s, /net: -<N> lines/, `${desc}: ends with net: -<N> lines`);
}

function assertEvalsOverBuild(text, desc) {
  const rubric = oneLine(section(text, 'Rubric'));
  assert.match(rubric, /over-?build[^.]{0,200}lowest rung/i, `${desc}: rubric scores the lowest rung that holds`);
  assert.match(rubric, /\badd(s|ed)? no unrequested[^.]{0,20}abstraction[^.]{0,40}dependency[^.]{0,20}file/i,
    `${desc}: rubric scores unrequested abstraction, dependency or file`);
  assert.match(text, /cap:40\b/, `${desc}: keeps cap:40`);
  assert.ok(countEffectiveLines(text) <= 40, `${desc}: ≤40 effective lines`);
}

test('row 1: principles.md § Minimalism states the rungs in order', () => {
  assertPrinciplesLadder(pb('principles.md'), 'principles.md');
});

function assertPrinciplesTrace(text, desc) {
  const s = oneLine(section(text, 'Minimalism'));
  assert.match(s, /(after|only once)[^.]{0,120}(read|trac)[^.]{0,80}flow/i, desc + ': climbed only after reading and tracing the flow');
  assert.match(s, /(fix(es|ed)? (a |the )?bugs?|bugs? (is |are )?fixed)[^.]{0,40} where every caller routes through/i,
    desc + ': a bug is fixed where every caller routes through');
}

function assertPrinciplesNeverCut(text, desc) {
  const s = oneLine(section(text, 'Minimalism'));
  assert.ok(/never cut/i.test(s), desc + ': must keep a never-cut list');
  const never = s.slice(s.search(/never cut/i));
  for (const re of [/trust-boundary validation/i, /data-loss/i, /security/i, /accessibility/i, /contract/i]) {
    assert.match(never, re, desc + ': never-cut list must name ' + re);
  }
}

function assertReviewQualityBullet(text, desc) {
  const s = oneLine(step(text, 1));
  const bullet = s.slice(s.indexOf('`sdlc-quality`'), s.indexOf('`sdlc-ops`'));
  assert.ok(bullet.length > 0, desc + ': step 1 must keep the sdlc-quality bullet before sdlc-ops');
  for (const tag of TAGS) assert.ok(bullet.includes('`' + tag + '`'), desc + ': the bullet names ' + tag);
  assert.match(bullet, IMPROVEMENT_NEVER_BLOCKER, desc + ': the bullet says over-build findings are improvements, never blockers');
}

test('row 2: principles.md § Minimalism climbs after tracing, fixes a bug where every caller routes', () => {
  assertPrinciplesTrace(pb('principles.md'), 'principles.md');
});

test('row 3: principles.md § Minimalism never-cut list includes accessibility and the contract', () => {
  assertPrinciplesNeverCut(pb('principles.md'), 'principles.md');
});

test('row 4: build.md sends the implementer to principles.md § Minimalism, trace first', () => {
  assertBuildPointer(pb('build.md'), 'build.md');
});

test('row 5: sdlc-builder.md carries the ladder, trace first, never drops a contract row or guard', () => {
  assertBuilderLadder(agent('sdlc-builder.md'), 'sdlc-builder.md');
});

test('row 6: sdlc-quality.md reports over-build with five tags, improvement only, net: total', () => {
  assertQualityOverBuild(agent('sdlc-quality.md'), 'sdlc-quality.md');
});

test('row 7: review.md step 1 sdlc-quality bullet names over-build tags, improvements never blockers', () => {
  assertReviewQualityBullet(pb('review.md'), 'review.md');
});

test('row 8: contract-evals.md rubric scores over-build within cap 40', () => {
  assertEvalsOverBuild(template('contract-evals.md'), 'contract-evals.md');
});

test('row 9: a fresh init --tool claude installs every rule', (t) => {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'claude']).status, 0, 'init must succeed');
  const principles = read(dir, 'sdlc/.playbook/principles.md');
  assertPrinciplesLadder(principles, 'installed principles.md');
  assertPrinciplesTrace(principles, 'installed principles.md');
  assertPrinciplesNeverCut(principles, 'installed principles.md');
  assertReviewQualityBullet(read(dir, 'sdlc/.playbook/review.md'), 'installed review.md');
  assertBuildPointer(read(dir, 'sdlc/.playbook/build.md'), 'installed build.md');
  assertBuilderLadder(read(dir, '.claude/agents/sdlc-builder.md'), 'installed sdlc-builder.md');
  assertQualityOverBuild(read(dir, '.claude/agents/sdlc-quality.md'), 'installed sdlc-quality.md');
  assertEvalsOverBuild(read(dir, 'sdlc/.playbook/templates/contract-evals.md'), 'installed contract-evals.md');
});

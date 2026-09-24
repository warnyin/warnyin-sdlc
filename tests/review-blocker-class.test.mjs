// Contract rows for review-blocker-defect-class: sdlc/changes/review-blocker-defect-class/contract/tests.md.
// Each row tests doctrine about how blockers name their defect class and enumerate instances.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, PKG_ROOT } from './helpers.mjs';

const pb = (rel) => fs.readFileSync(path.join(PKG_ROOT, 'payload', 'playbook', rel), 'utf8');
const agent = (rel) => fs.readFileSync(path.join(PKG_ROOT, 'payload', 'adapters', 'claude', 'agents', rel), 'utf8');
const oneLine = (s) => s.replace(/\s+/g, ' ');

// Helper to assert blocker format constraints: class:, sweep:, hits: in order
function assertBlockerFormat(text, desc) {
  const classIdx = text.indexOf('class:');
  const sweepIdx = text.indexOf('sweep:');
  const hitsIdx = text.indexOf('hits:');
  assert.ok(classIdx > -1, `${desc}: must contain literal 'class:'`);
  assert.ok(sweepIdx > -1, `${desc}: must contain literal 'sweep:'`);
  assert.ok(hitsIdx > -1, `${desc}: must contain literal 'hits:'`);
  assert.ok(classIdx < sweepIdx, `${desc}: 'class:' must come before 'sweep:'`);
  assert.ok(sweepIdx < hitsIdx, `${desc}: 'sweep:' must come before 'hits:'`);
}

// A numbered step runs from its "N. " line to the next top-level step line, or the end of the
// file — wrapped continuation lines included. (`$` under the m flag ends at the first line.)
function extractSection(text, stepNum) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`${stepNum}. `));
  if (start === -1) return '';
  const rel = lines.slice(start + 1).findIndex((l) => /^\d+[a-z]?\.\s/.test(l));
  return lines.slice(start, rel === -1 ? undefined : start + 1 + rel).join('\n');
}

// ===== Row 1: review.md step 2 has blocker with class:, sweep:, hits: =====
test('row 1: review.md step 2 blocker carries class:, sweep:, hits: literal fields in order', () => {
  const review = pb('review.md');
  const step2 = extractSection(review, 2);
  assert.ok(step2.length > 0, 'review.md must have a step 2');

  const step2OneLine = oneLine(step2);

  // Must mention blocker and its fields
  assert.match(step2OneLine, /blocker/i, 'step 2 must mention blocker');

  // Check for required literal tokens
  assertBlockerFormat(step2OneLine, 'review.md step 2');

  // The sweep must match the reported instance itself
  assert.match(step2OneLine, /sweep[^.]{0,120}(match|find|include|hit)[^.]{0,60}(reported|its own|that) instance/i,
    'step 2 must require sweep to match the reported instance');
});

// ===== Row 2: blocker arriving without sweep: gets swept by main loop before fix task =====
test('row 2: blocker without sweep: is swept by main loop before fix task is written', () => {
  const review = oneLine(pb('review.md'));
  assert.match(review, /sweep:[^.]{0,200}main loop|main loop[^.]{0,200}sweep:/i,
    'review.md must state main loop runs sweep before fix task');
  assert.match(review, /blocker[^.]{0,160}(only one|a single|one|bare|lone) instance/i,
    'must address blockers that name only one instance');
});

// ===== Row 3: blockers → ONE fix task per class with sweep and hits, done when re-run empty =====
test('row 3: blockers become ONE fix task per class; task done when re-run sweep finds nothing', () => {
  const review = oneLine(pb('review.md'));
  const step3 = oneLine(extractSection(pb('review.md'), 3));
  assert.ok(step3.length > 0, 'review.md must have a step 3');

  // One fix task per class, not per instance
  assert.match(step3, /one fix task[^.]{0,80}class|fix task[^.]{0,80}per class|per defect class/i,
    'step 3 must require one fix task per defect class');

  // Carries sweep and hits
  assert.match(step3, /sweep/i, 'fix task must carry sweep');
  assert.match(step3, /hits/i, 'fix task must carry hits');

  // Task done when re-run finds nothing
  assert.match(step3, /done.*when[^.]{0,120}re-?run[^.]{0,80}sweep[^.]{0,80}find[^.]{0,40}nothing|re-?run[^.]{0,120}no instance|whole tree[^.]{0,120}empty/i,
    'step 3 must require re-running sweep to confirm task done');
});

// ===== Row 4: build.md fix task with sweep SHALL NOT tick until swept =====
test('row 4: build.md fix task with sweep SHALL NOT tick until sweep is re-run; command and result noted', () => {
  const build = oneLine(pb('build.md'));

  // Must forbid ticking without re-running
  assert.match(build, /fix task[^.]{0,80}sweep[^.]{0,160}(not|shall not|cannot|do not|don\'t|must not)[^.]{0,60}tick|tick[^.]{0,160}(until|only|after)[^.]{0,80}re-?run[^.]{0,80}sweep/i,
    'build.md must forbid ticking a sweep-carrying fix task until sweep is re-run');

  // Command and result go on the task's line
  assert.match(build, /sweep[^.]{0,120}(command|result)[^.]{0,80}task/i,
    'build.md must require command and result recorded on task');
});

// ===== Rows 5-8: Four agents with blocker format, prefix guards, and sweep instruction =====
const AGENTS = [
  { file: 'sdlc-architect.md', name: 'architect', returnFormat: '<file:line>' },
  { file: 'sdlc-security.md', name: 'security', returnFormat: '<file:line>' },
  { file: 'sdlc-quality.md', name: 'quality', returnFormat: '<where>' },
  { file: 'sdlc-ops.md', name: 'ops', returnFormat: '<file:line>' },
];

for (const agentSpec of AGENTS) {
  const rowNum = AGENTS.indexOf(agentSpec) + 5;

  // (a) Prefix guard: return line still starts with blocker|improvement|note · <finding> · format
  test(`row ${rowNum}a: ${agentSpec.name} return line starts with blocker|improvement|note · <finding> · ${agentSpec.returnFormat}`, () => {
    const content = oneLine(agent(agentSpec.file));
    const returnPattern = new RegExp(
      `blocker\\|improvement\\|note\\s*·\\s*<finding>\\s*·\\s*${
        agentSpec.returnFormat.replace(/[<>]/g, '\\$&')
      }`,
      'i'
    );
    assert.match(content, returnPattern,
      `${agentSpec.name} must have return format starting with blocker|improvement|note · <finding> · ${agentSpec.returnFormat}`);
  });

  // (b) Blocker format appends class: sweep: hits: in that order
  test(`row ${rowNum}b: ${agentSpec.name} blocker appends class: · sweep: · hits:`, () => {
    const content = oneLine(agent(agentSpec.file));
    // Must mention appending or blocker format extension
    assert.match(content, /blocker[^.]{0,240}class:|class:[^.]{0,240}blocker/i,
      `${agentSpec.name} must relate blocker to class`);
    // Must have the three literal tokens in order
    assertBlockerFormat(content, `${agentSpec.name} blocker format`);
  });

  // (c) Agent told to run sweep over whole tree before reporting
  test(`row ${rowNum}c: ${agentSpec.name} told to sweep whole tree before reporting`, () => {
    const content = oneLine(agent(agentSpec.file));
    assert.match(content, /sweep[^.]{0,160}(whole tree|entire tree|across[^.]{0,40}tree)[^.]{0,80}before|run[^.]{0,120}sweep[^.]{0,80}(whole|entire|across)/i,
      `${agentSpec.name} must be instructed to sweep over the whole tree before reporting`);
  });
}

// ===== Row 9: init --tool claude carries the assertions into installed project =====
test('row 9: init --tool claude installs review.md, build.md, and sdlc-security.md with row 1, 4, and 6 assertions', (t) => {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'claude']).status, 0, 'init should succeed');

  const installedReview = oneLine(fs.readFileSync(path.join(dir, 'sdlc/.playbook/review.md'), 'utf8'));
  const installedBuild = oneLine(fs.readFileSync(path.join(dir, 'sdlc/.playbook/build.md'), 'utf8'));
  const installedSecurity = oneLine(fs.readFileSync(
    path.join(dir, '.claude/agents/sdlc-security.md'), 'utf8'));

  // Row 1 assertion: review.md step 2 has class:, sweep:, hits:
  assertBlockerFormat(installedReview, 'installed review.md');

  // Row 4 assertion: build.md forbids ticking without re-run
  assert.match(installedBuild, /fix task[^.]{0,80}sweep[^.]{0,160}(not|shall not|cannot|do not|don\'t|must not)[^.]{0,60}tick|tick[^.]{0,160}(until|only|after)[^.]{0,80}re-?run[^.]{0,80}sweep/i,
    'installed build.md must forbid ticking without re-run');

  // Row 6 assertions for security agent:
  // (a) Prefix guard
  assert.match(installedSecurity, /blocker\|improvement\|note\s*·\s*<finding>\s*·\s*<file:line>/i,
    'installed sdlc-security.md must have correct return format');

  // (b) Blocker appends class: sweep: hits:
  assertBlockerFormat(installedSecurity, 'installed sdlc-security.md blocker format');

  // (c) Sweep whole tree
  assert.match(installedSecurity, /sweep[^.]{0,160}(whole tree|entire tree|across[^.]{0,40}tree)[^.]{0,80}before|run[^.]{0,120}sweep[^.]{0,80}(whole|entire|across)/i,
    'installed sdlc-security.md must instruct sweeping whole tree');
});

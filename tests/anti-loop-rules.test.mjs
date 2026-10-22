// Contract rows for anti-loop-rules: sdlc/changes/anti-loop-rules/contract/tests.md.
// Each rule is pinned as an EXACT sentence (RULES below), compared after whitespace is collapsed,
// inside the anchor that must carry it. No regex reads the meaning. Rows 3 and 8 pin where a
// sentence appears across every payload .md: the list must equal the list the contract names.
// The guard files row 10 used to re-run are run by the suite itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertRule as pinRule, body, nonEmpty, payload, payloadFilesWith, section } from './rule-pins.mjs';

// The rules, verbatim. One place to read what the payload promises; one place to change it.
const B_LEAD_IN = 'In a repeated panel, when you are briefed with the previous blockers and the fix diff, ';
const B_FRAGMENT = 'a blocker is raised only for a previous blocker not closed, a defect the fix diff causes, or a security, data-loss or contract defect wherever it is; anything else is an improvement';
const RULES = Object.freeze({
  A: 'A row that pins a rule written in prose asserts it as one exact sentence, whitespace collapsed, inside a non-empty anchor, and pins known contradicting wording absent as literal text; it never uses a regex over the rule\'s meaning.',
  B_FRAGMENT,
  B_AGENT: B_LEAD_IN + B_FRAGMENT + '.',
  C: 'A repeated panel never narrows what you check: a vulnerability in any code is a blocker.',
});

// Each rule through the shared pin (tests/rule-pins.mjs): a full sentence bounded, a clause verbatim.
function assertRule(anchor, key, where) {
  pinRule(anchor, RULES[key], `${where} (RULES.${key})`);
}

// Paths of every payload .md holding the sentence, as `payload/…`, sorted.
const payloadFiles = (s) => payloadFilesWith(s).map((f) => `payload/${f}`);

const contractor = () => body(payload('adapters', 'claude', 'agents', 'sdlc-contractor.md'), 'sdlc-contractor.md');
const reviewer = (name) => body(payload('adapters', 'claude', 'agents', name), name);
const contractTestsSection = () => nonEmpty(
  section(payload('adapters', 'claude', 'skills', 'contract-writing', 'SKILL.md'), 'contract/tests.md'),
  'contract-writing SKILL.md ## contract/tests.md',
);

test('row 1: sdlc-contractor body states rule A verbatim as one exact sentence', () => {
  assertRule(contractor(), 'A', 'sdlc-contractor.md body');
});

test('row 2: contract-writing SKILL ## contract/tests.md states rule A verbatim as one exact sentence', () => {
  assertRule(contractTestsSection(), 'A', 'contract-writing SKILL.md ## contract/tests.md');
});

test('row 3: rule A appears in exactly sdlc-contractor.md and contract-writing/SKILL.md', () => {
  const holders = payloadFiles(RULES.A);
  const expected = [
    'payload/adapters/claude/agents/sdlc-contractor.md',
    'payload/adapters/claude/skills/contract-writing/SKILL.md',
  ].sort();
  assert.deepEqual(holders, expected, `rule A must appear in exactly those two payload files, got ${JSON.stringify(holders)}`);
});

test('row 4: sdlc-architect body states the repeated-panel blocker scope (B agent) verbatim', () => {
  assertRule(reviewer('sdlc-architect.md'), 'B_AGENT', 'sdlc-architect.md body');
});

test('row 5: sdlc-security body states the repeated-panel blocker scope (B agent) verbatim', () => {
  assertRule(reviewer('sdlc-security.md'), 'B_AGENT', 'sdlc-security.md body');
});

test('row 6: sdlc-quality body states the repeated-panel blocker scope (B agent) verbatim', () => {
  assertRule(reviewer('sdlc-quality.md'), 'B_AGENT', 'sdlc-quality.md body');
});

test('row 7: sdlc-ops body states the repeated-panel blocker scope (B agent) verbatim', () => {
  assertRule(reviewer('sdlc-ops.md'), 'B_AGENT', 'sdlc-ops.md body');
});

test('row 8: the B fragment appears in exactly review.md, sdlc-architect, sdlc-security, sdlc-quality and sdlc-ops', () => {
  const holders = payloadFiles(RULES.B_FRAGMENT);
  const expected = [
    'payload/adapters/claude/agents/sdlc-architect.md',
    'payload/adapters/claude/agents/sdlc-ops.md',
    'payload/adapters/claude/agents/sdlc-quality.md',
    'payload/adapters/claude/agents/sdlc-security.md',
    'payload/playbook/review.md',
  ].sort();
  assert.deepEqual(holders, expected, `the B fragment must appear in exactly those five payload files, got ${JSON.stringify(holders)}`);
});

test('row 9: sdlc-security body states the never-narrows rule (C) verbatim', () => {
  assertRule(reviewer('sdlc-security.md'), 'C', 'sdlc-security.md body');
});


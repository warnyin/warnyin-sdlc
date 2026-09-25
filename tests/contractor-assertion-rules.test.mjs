// Contract rows for contractor-assertion-rules: sdlc/changes/contractor-assertion-rules/contract/tests.md.
// Each row tests a rule the contractor prompt must carry for the tests it generates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, PKG_ROOT } from './helpers.mjs';

const oneLine = (s) => s.replace(/\s+/g, ' ');
const payloadAgent = () =>
  fs.readFileSync(path.join(PKG_ROOT, 'payload', 'adapters', 'claude', 'agents', 'sdlc-contractor.md'), 'utf8');

function assertSplitLines(text, desc) {
  const s = oneLine(text);
  assert.match(s, /split(ting)? [^.]{0,40}into lines[^.]{0,80}next heading or step/i,
    `${desc}: bound a section by splitting lines up to the next heading or step`);
  assert.match(s, /never[^.]{0,60}end anchor[^.]{0,120}multiline[^.]{0,60}first line/i,
    `${desc}: never an end anchor that ends at the first line in multiline mode`);
}

function assertOwnReason(text, desc) {
  assert.match(oneLine(text), /fails? for (its|the) own row'?s? reason[^.]{0,80}failure message/i,
    `${desc}: each red test fails for its own row's reason, read from the failure message`);
}

function assertLiteralTokens(text, desc) {
  const s = oneLine(text);
  assert.match(s, /literal tokens, order and polarity/i, `${desc}: assert the row's literal tokens, order and polarity`);
  assert.match(s, /not[^.]{0,20}wide gap patterns/i, `${desc}: not wide gap patterns between loose words`);
}

function assertExistingRules(text, desc) {
  const s = oneLine(text);
  assert.match(s, /For each table row write one test/, `${desc}: one test per row`);
  assert.match(s, /every new test must FAIL \(red\)/, `${desc}: every new test fails red`);
  assert.match(s, /Never write or modify implementation code/, `${desc}: never writes implementation`);
}

test('row 1: sdlc-contractor.md bounds a section by splitting lines, never an end anchor', () => {
  assertSplitLines(payloadAgent(), 'sdlc-contractor.md');
});

test('row 2: sdlc-contractor.md checks each red test fails for its own row reason', () => {
  assertOwnReason(payloadAgent(), 'sdlc-contractor.md');
});

test('row 3: sdlc-contractor.md asserts literal tokens, order and polarity, not wide gaps', () => {
  assertLiteralTokens(payloadAgent(), 'sdlc-contractor.md');
});

test('row 4: sdlc-contractor.md keeps one test per row, red first, no implementation', () => {
  assertExistingRules(payloadAgent(), 'sdlc-contractor.md');
});

test('row 5: a fresh init --tool claude installs the contractor rules', (t) => {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'claude']).status, 0, 'init must succeed');
  const installed = fs.readFileSync(path.join(dir, '.claude', 'agents', 'sdlc-contractor.md'), 'utf8');
  assertSplitLines(installed, 'installed sdlc-contractor.md');
  assertOwnReason(installed, 'installed sdlc-contractor.md');
  assertLiteralTokens(installed, 'installed sdlc-contractor.md');
  assertExistingRules(installed, 'installed sdlc-contractor.md');
});

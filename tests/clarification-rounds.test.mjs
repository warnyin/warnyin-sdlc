// Contract rows for clarification-rounds: sdlc/changes/clarification-rounds/contract/tests.md.
// What a test can reach is what new.md step 5 REQUIRES, not what a run then does — rounds
// are produced at runtime by the model. contract/evals.md scores that half.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, PKG_ROOT } from './helpers.mjs';
import { countEffectiveLines } from '../lib/caps.mjs';

const pb = (n) => fs.readFileSync(path.join(PKG_ROOT, 'payload/playbook', n), 'utf8');

// Step 5's own slice of new.md, so a match elsewhere in the file cannot satisfy these.
// Both bounds must be found: a silently unbounded slice would run these assertions over
// the rest of the file and pass on text that has nothing to do with step 5.
function step5Slice() {
  const t = pb('new.md');
  const start = t.search(/^5\. /m);
  assert.ok(start > -1, 'new.md has no step 5');
  const rest = t.slice(start);
  const end = rest.search(/^6\. /m);
  assert.ok(end > -1, 'step 5 has no following step 6 — the slice is unbounded');
  return rest.slice(0, end);
}

// The ambiguity/NEEDS-CLARIFICATION line of rules-card.md, including a following
// indented continuation line (the doctrine wraps a sentence across two lines there).
function ambiguityLine() {
  const lines = pb('rules-card.md').split(/\r?\n/);
  const idx = lines.findIndex((l) => /NEEDS CLARIFICATION|Ambiguity/.test(l));
  assert.ok(idx > -1, 'rules-card.md has no ambiguity line');
  let text = lines[idx];
  let i = idx + 1;
  while (i < lines.length && /^\s+\S/.test(lines[i]) && !/^-\s/.test(lines[i])) {
    text += ' ' + lines[i].trim();
    i += 1;
  }
  return text;
}

// row 1
test('row 1: a round holds every open question whose prerequisites are already answered', () => {
  const s5 = step5Slice();
  assert.match(s5, /\brounds?\b/i);
  assert.match(s5, /prerequisite|already answered|depends? on/i);
});

// row 2
test('row 2: a question depending on another still-open question is deferred to a later round', () => {
  const s5 = step5Slice();
  assert.match(s5, /defer(red)?/i);
  assert.match(s5, /still open|depend/i);
});

// row 3
test('row 3: a deferred question an answer made moot or already decided is dropped, not asked', () => {
  const s5 = step5Slice();
  assert.match(s5, /moot|already decided/i);
  assert.match(s5, /drop(ped)?/i);
});

// row 4
test('row 4: the one-batch rule is gone — "in one batch" no longer appears in step 5', () => {
  assert.doesNotMatch(step5Slice(), /in one batch/i);
});

// row 5
test('row 5: --auto holds no rounds and funnels questions into auto.md\'s single confirmation; auto.md Confirm still says "One message"', () => {
  const s5 = step5Slice();
  assert.match(s5, /--auto/);
  assert.match(s5, /auto\.md/);
  assert.match(s5, /(single|one)[\s-]*confirm/i);
  // regression guard, green by design: unattended's own Confirm wording is untouched.
  assert.match(pb('auto.md'), /One message/);
});

// row 6
test('row 6: each question is numbered and carries its own recommended answer, stated apart from the question', () => {
  const s5 = step5Slice();
  assert.match(s5, /number(ed)?/i);
  assert.match(s5, /recommend(ed|ation)/i);
});

// row 7
test('row 7: the human may reply by question number, and each answer applies to that number', () => {
  const s5 = step5Slice();
  assert.match(s5, /by (question )?number/i);
  assert.match(s5, /appl(y|ies)|that number/i);
});

// row 8
test('row 8: anything the repository or tools can answer is looked up, never asked', () => {
  const s5 = step5Slice();
  assert.match(s5, /look(ed)? up|lookup/i);
  assert.match(s5, /never ask|not asked|rather than (putting|asking)/i);
});

// row 9
test('row 9: while a lookup runs, only the questions depending on its result wait', () => {
  const s5 = step5Slice();
  assert.match(s5, /lookup|look(ed|ing)? up/i);
  assert.match(s5, /wait(s|ing)?/i);
  assert.match(s5, /depend/i);
});

// row 10
test('row 10: after the last round the settled answers are restated and the stage waits for the human to confirm before leaving new', () => {
  const s5 = step5Slice();
  assert.match(s5, /last round|no question (remains|is) open|once no question/i);
  assert.match(s5, /restate(d)?/i);
  assert.match(s5, /confirm/i);
});

// row 11
test('row 11: a settled answer the human corrects is reopened in a new round', () => {
  const s5 = step5Slice();
  assert.match(s5, /correct(s|ed)?/i);
  assert.match(s5, /reopen(ed)?|open(ed)? again|new round/i);
});

// row 12
test('row 12: a change that raised no question requests no confirmation', () => {
  const s5 = step5Slice();
  assert.match(s5, /no (clarifying )?question/i);
  assert.match(s5, /no confirmation|not requested|proceeds as before/i);
});

// row 13 — regression guard, green before implementation by design
test('row 13: the AI-driven assumption policy still stands', () => {
  const s5 = step5Slice();
  assert.match(s5, /## Assumptions/);
  assert.match(s5, /safely assume|safe assumption/i);
  assert.match(s5, /\[NEEDS CLARIFICATION/);
});

// row 14
test('row 14: rules-card.md\'s ambiguity line names rounds and a recommended answer; the card stays <=40 effective lines', () => {
  const line = ambiguityLine();
  assert.match(line, /\brounds?\b/i);
  assert.match(line, /recommend(ed|ation)/i);
  const lines = countEffectiveLines(pb('rules-card.md'));
  assert.ok(lines <= 40, `rules-card.md is ${lines} effective lines, budget is 40`);
});

// row 15 — cap pin: green today at 30, so step 5 grows only by what the four rules need
test('row 15: new.md stays within its pinned line budget', () => {
  const lines = countEffectiveLines(pb('new.md'));
  assert.ok(lines <= 38, `new.md is ${lines} effective lines, budget is 38`);
});

// row 16
test('row 16: a fresh init --tool claude installs the rounds rule into sdlc/.playbook/new.md', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res.status, 0, res.stderr);
  const installed = fs.readFileSync(path.join(dir, 'sdlc/.playbook/new.md'), 'utf8');
  assert.match(installed, /\brounds?\b/i);
  assert.match(installed, /recommend(ed|ation)/i);
});

// row 17
test('row 17: under --auto no separate end-of-rounds confirmation is requested', () => {
  const s5 = step5Slice();
  assert.match(s5, /--auto[^]{0,200}(no separate|not (a )?separate|part of the single|single (unattended )?confirmation)/i);
});

// row 18
test('row 18: a fresh init --tool cursor embeds the updated ambiguity line in its rules card', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'cursor']);
  assert.equal(res.status, 0, res.stderr);
  const rendered = fs.readFileSync(path.join(dir, '.cursor/rules/sdlc.mdc'), 'utf8');
  assert.match(rendered, /NEEDS CLARIFICATION[^]{0,300}\brounds?\b/i);
  assert.match(rendered, /NEEDS CLARIFICATION[^]{0,300}recommend(ed|ation)/i);
});

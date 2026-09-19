// Contract rows for question-options: sdlc/changes/question-options/contract/tests.md.
// Like clarification-rounds, these read what new.md step 5 REQUIRES; whether a run offers
// good options or really calls the picker is scored by contract/evals.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, PKG_ROOT } from './helpers.mjs';
import { countEffectiveLines } from '../lib/caps.mjs';

const pb = (n) => fs.readFileSync(path.join(PKG_ROOT, 'payload/playbook', n), 'utf8');
const oneLine = (s) => s.replace(/\s+/g, ' ');

// Step 5 only, both bounds required, whitespace folded so wrapped sentences still match.
function step5(text = pb('new.md')) {
  const start = text.search(/^5\. /m);
  assert.ok(start > -1, 'new.md has no step 5');
  const rest = text.slice(start);
  const end = rest.search(/^6\. /m);
  assert.ok(end > -1, 'step 5 has no following step 6 — the slice is unbounded');
  return oneLine(rest.slice(0, end));
}

function ambiguityLine(card) {
  const lines = card.split(/\r?\n/);
  const idx = lines.findIndex((l) => /NEEDS CLARIFICATION|Ambiguity/.test(l));
  assert.ok(idx > -1, 'no ambiguity line');
  let text = lines[idx];
  for (let i = idx + 1; i < lines.length && /^\s+\S/.test(lines[i]) && !/^-\s/.test(lines[i]); i++) {
    text += ` ${lines[i].trim()}`;
  }
  return text;
}

test('row 1: a choice question offers two to four options', () => {
  assert.match(step5(), /(few|small set of)[^.]{0,80}(choices|answers)[^.]{0,120}(two to four|2[–-]4) options/i);
});

test('row 2: the recommended option comes first and is marked', () => {
  assert.match(step5(), /recommended (one|option) first[^.]{0,60}(marked|labell?ed)/i);
});

test('row 3: each option states what choosing it means', () => {
  assert.match(step5(), /each[^.]{0,40}(trade-?off|what choosing it (means|costs))/i);
});

test('row 4: an open-ended question gets one recommended answer and no invented options', () => {
  assert.match(step5(), /open-ended[^.]{0,120}(single|one) recommended answer/i);
  assert.match(step5(), /(no|never|not) (invent|invented|made-up)[^.]{0,20}options|options[^.]{0,20}(never|not) invented/i);
});

test('row 5: an answer outside the options is applied as given', () => {
  assert.match(step5(), /(answer|reply)[^.]{0,40}(outside|none of) the options[^.]{0,60}(applied|taken|accepted) as given/i);
});

test('row 6: option questions go through the tool\'s question picker, Claude Code\'s AskUserQuestion as example', () => {
  const s = step5();
  assert.match(s, /(structured )?question picker/i);
  assert.match(s, /AskUserQuestion/);
  assert.match(s, /when the tool (has|provides|offers) (a|one|such a)\b[^.]{0,40}\b(ask|use|through|via)/i);
  // Through the picker, too: recommended option first and a free answer still possible.
  assert.match(s, /picker[^.]{0,160}recommended (one|option) first/i);
  assert.match(s, /picker[^.]{0,200}(Other|free answer|own answer)/i);
});

test('row 7: rounds beyond the picker limit split into consecutive prompts; limits stated', () => {
  const s = step5();
  assert.match(s, /(picker|prompt)[^.]{0,120}consecutive prompts/i);
  assert.match(s, /(no|before a|until)[^.]{0,40}(later|next) round/i);
  assert.match(s, /(≤|at most |up to )4 questions/i);
  assert.match(s, /2[–-]4 options/i);
});

test('row 8: without a picker, options are lettered inline and a reply like 1b works', () => {
  const s = step5();
  assert.match(s, /(without|no) (a )?picker[^.]{0,80}letter(ed)?/i);
  assert.match(s, /`1b/);
});

// Regression guard: green before implementation by design.
test('row 9: numbering, a recommended answer per question and reply-by-number still stand', () => {
  const s = step5();
  assert.match(s, /number each question/i);
  assert.match(s, /recommended answer/i);
  assert.match(s, /reply by number/i);
});

test('row 10: the rules card names options and the picker; card stays within 40 lines', () => {
  const card = pb('rules-card.md');
  const line = ambiguityLine(card);
  assert.match(line, /options/i);
  assert.match(line, /picker/i);
  const lines = countEffectiveLines(card);
  assert.ok(lines <= 40, `rules-card.md is ${lines} effective lines, budget is 40`);
});

// Cap pin, raised on purpose from 38: 42 was approved, the options rules landed at 43 and the
// human approved 43 (2026-09-15). The next addition to new.md has to raise it again.
test('row 11: new.md stays within its pinned line budget of 43', () => {
  const lines = countEffectiveLines(pb('new.md'));
  assert.ok(lines <= 43, `new.md is ${lines} effective lines, budget is 43`);
});

test('row 12: a fresh claude install carries the options and picker rules', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res.status, 0, res.stderr);
  const installed = step5(fs.readFileSync(path.join(dir, 'sdlc/.playbook/new.md'), 'utf8'));
  assert.match(installed, /(two to four|2[–-]4) options/i);
  assert.match(installed, /AskUserQuestion/);
});

test('row 13: fresh lite-adapter installs embed an ambiguity line that names options', (t) => {
  for (const [tool, file] of [['cursor', '.cursor/rules/sdlc.mdc'], ['windsurf', '.windsurf/rules/sdlc.md'], ['kimi', '.kimi-code/AGENTS.md']]) {
    const dir = makeTempProject(t);
    const res = runCli(dir, ['init', '--tool', tool]);
    assert.equal(res.status, 0, res.stderr);
    const rendered = oneLine(fs.readFileSync(path.join(dir, file), 'utf8'));
    assert.match(rendered, /NEEDS CLARIFICATION.{0,400}\boptions\b/i, tool);
  }
});

// Contract rows for scoped-test-commands: sdlc/changes/scoped-test-commands/contract/tests.md.
// Each rule sentence is pinned verbatim (whitespace collapsed) inside a non-empty anchor, through
// tests/rule-pins.mjs. A list item is pinned by its text after the "- " marker, because the
// rule-pins collapse strips that marker from the anchor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli } from './helpers.mjs';
import { oneLine, payload, nonEmpty, body, section, step, assertRule, assertAbsent } from './rule-pins.mjs';
import { CAPS, countEffectiveLines } from '../lib/caps.mjs';

// Exact sentences from contract/tests.md.
const V1 = "Take the first rung that can run: the `fast test command` from `sdlc/harness.md`; the tests related to the touched files and the contract rows; the tests of the touched packages; and the full test command only when none of those can be named, when the diff is cross-cutting, or when the human asks for it.";
const V2 = "A harness command left as `<cmd>` counts as not named.";
const V2B = "A `single test command` that holds no `{files}` counts as not named.";
const V8 = "The same set binds a path handed to the runner's file filter and a row's direct run.";
const CB = "If the command is `<cmd>` or holds no `{files}`, use the test runner's own file filter; if a path you wrote is outside that set, run nothing and report it.";
const V3 ="Expand a placeholder before running the command or handing it to a subagent, each path within `[A-Za-z0-9._/-]` and not starting with `-`: `{changed}` is the files this change edited that still exist, by `git status` and the commits since it opened; `{files}` is the test files concerned.";
const V4 = "A placeholder with nothing to expand into, or with a path outside that set, makes that rung unusable; never run the command with the placeholder removed or a path left out.";
const V5 = "A scoped command that passes without running a contract row's test does not cover that row: run that row's test directly, and the row counts as covered only when it passes.";
const V5_AFTER = "Every row of `contract/tests.md` must be covered by a passing test.";
const V6 = "A fast-gate verify note says `scope=<full|scoped>`, pass or fail; when it ran the full test command it adds `reason=<no-subset|cross-cutting|human>`: `no-subset` when no narrower rung can be named, `cross-cutting` when the diff edits a root config, a lockfile or a test helper every package loads, `human` when the human asked for the full run.";
const V7 = "The second and third rungs run through the `single test command`, or the test runner's own file filter when it names none.";
const F1 = "On a fast-gate failure the note adds `scope=<full|scoped>` and, when that round ran the full test command, `reason=<no-subset|cross-cutting|human>`.";
const R1 = "The verify test run goes to `sdlc-runner` with the command the gate chose, its placeholders already expanded, and `contract/tests.md`; it returns pass/fail per contract row plus failure excerpts.";
const R2 = "A row it returns `uncovered` gets its own run of that row's test, through `sdlc-runner` again.";
const B1 = "Per-task self-check = that task's tests + lint only, through the `single test command` from `sdlc/harness.md` with `{files}` expanded to the test files of the task's contract rows, each path within `[A-Za-z0-9._/-]` and not starting with `-`, or the test runner's own file filter when it names none (a `<cmd>`, or a command without `{files}`, names none); never the full test command, which belongs to /sdlc:verify (moved, not removed).";
const B2 = "A task with no test files of its own, a test file path outside that set, or a project whose runner has no file filter, runs lint only and leaves its tests to /sdlc:verify.";
const C0 = "delegate to the `sdlc-contractor` agent (cheap tier) with ONLY tests.md + the delta + the project's test conventions + the `single test command` (a `<cmd>`, or a command without `{files}`, names none), whose `{files}` the contractor expands over the files it writes.";
const C1 = "Then run only the test files it wrote, through that command with `{files}` expanded, each path within `[A-Za-z0-9._/-]` and not starting with `-`, or the test runner's own file filter when the harness names none (a `<cmd>`, or a command without `{files}`, names none) — every new test must FAIL (red) now; a test that passes before implementation tests nothing.";
const C2 = "When no test file was written, or a path it wrote is outside that set, stop and report it, running nothing: nothing is red.";
const C3 = "The full test command runs here only when test files were written and the runner has no file filter, and the contract note then adds `scope=full reason=no-subset`.";
const C5 = "adding `scope=full reason=no-subset` when step 3 ran the full test command.";
const BA ="(self-check = those tests + lint only, through the `single test command` from `sdlc/harness.md` with `{files}` expanded, each path within `[A-Za-z0-9._/-]` and not starting with `-`, or the test runner's own file filter (a `<cmd>`, or a command without `{files}`, names none); no test files, a path outside that set or no filter means lint only, never the full test command, which belongs to verify)";
const CA = "Run the test command you are given on the test files you wrote, `{files}` expanded to them, each path within `[A-Za-z0-9._/-]` and not starting with `-`, never the full suite: every new test must FAIL (red)";
const I1 = "`sdlc/harness.md` — fill tools, the test commands (a fast or single command the project lacks stays `<cmd>`), sandbox notes;";
const H1 = "fast test command: `<cmd>` (optional — a quick scoped subset for verify fix rounds; `{changed}` expands to the files this change edited; without it verify takes the next rung)";
const H2 = "single test command: `<cmd>` (optional — the tests of named files, for a build task's self-check and the contract's red check; `{files}` expands to those files; without it the stage uses the test runner's own file filter)";

const TOKEN = 'reason=<no-subset|cross-cutting|human>';

// The sentence occurs exactly once in the collapsed anchor.
function pinOnce(anchor, sentence, where) {
  const text = oneLine(nonEmpty(anchor, where));
  const want = oneLine(sentence);
  const first = text.indexOf(want);
  assert.notEqual(first, -1, `${where} must state verbatim: "${sentence}"`);
  assert.equal(text.lastIndexOf(want), first, `${where} states "${sentence}" more than once`);
}

// Exactly once, and bounded where it stands (rule-pins decides the bounds).
function pin(anchor, sentence, where) {
  pinOnce(anchor, sentence, where);
  assertRule(anchor, sentence, where);
}

function inOrder(anchor, sentences, where) {
  const text = oneLine(anchor);
  const at = sentences.map((s) => text.indexOf(oneLine(s)));
  assert.deepEqual(at, [...at].sort((a, b) => a - b), `${where} must state these in order: ${sentences.join(' | ')}`);
}

const verifyStep1 = () => step(payload('playbook/verify.md'), 1);

test('row 1: verify.md step 1 states V1 once, names the full command only where allowed, and lacks the old fallback', () => {
  const verify = payload('playbook/verify.md');
  pin(step(verify, 1), V1, 'verify.md step 1');
  const count = oneLine(step(verify, 1)).split('full test command').length - 1;
  assert.equal(count, 3, 'verify.md step 1 names the full test command only in V1, V6 and the scope=full line');
  assertAbsent(verify, 'or the full test command when no such subset can be named', 'verify.md', 'the old fallback must not remain');
});

test('row 2: verify.md step 1 states V2, V3, V4 and V7, each once', () => {
  for (const s of [V2, V2B, V3, V4, V8, V7]) pin(verifyStep1(), s, 'verify.md step 1');
});

test('row 3: verify.md step 1 states V5 once, after the coverage sentence', () => {
  const anchor = verifyStep1();
  pin(anchor, V5, 'verify.md step 1');
  const text = oneLine(anchor);
  const after = text.indexOf(oneLine(V5_AFTER));
  assert.notEqual(after, -1, `verify.md step 1 must state "${V5_AFTER}" before V5`);
  assert.ok(text.indexOf(oneLine(V5)) > after, 'V5 must come after the coverage sentence');
});

test('row 4: verify.md step 1 states V6 once, and the failure note states F1 outside it', () => {
  const verify = payload('playbook/verify.md');
  pin(step(verify, 1), V6, 'verify.md step 1');
  const rest = verify.slice(verify.indexOf('On failure (either gate):'));
  pin(rest, F1, 'verify.md § On failure');
  assertAbsent(step(verify, 1), F1, 'verify.md step 1', 'F1 belongs to the failure section');
});

test('row 5: every reason= in verify.md is the closed-set token, and each member is defined in V6', () => {
  const verify = oneLine(payload('playbook/verify.md'));
  const starts = [...verify.matchAll(/reason\s*=/gi)].map((m) => m.index);
  assert.ok(starts.length > 0, 'verify.md carries no reason= token');
  for (const at of starts) {
    assert.equal(verify.slice(at, at + TOKEN.length), TOKEN, `every reason= must be exactly "${TOKEN}"`);
  }

  const anchor = oneLine(verifyStep1());
  const v6At = anchor.indexOf(oneLine(V6));
  assert.notEqual(v6At, -1, 'V6 must be stated in verify.md step 1');
  for (const member of ['no-subset', 'cross-cutting', 'human']) {
    const at = anchor.indexOf(`\`${member}\` when`, v6At);
    assert.ok(at >= v6At && at < v6At + oneLine(V6).length,
      `V6 must define \`${member}\` by its own backticked member`);
  }
});

test('row 6: routing.md § Unattended delegation states R1 and R2, and the file lacks the old wording', () => {
  const routing = payload('playbook/routing.md');
  const anchor = section(routing, 'Unattended delegation');
  pin(anchor, R1, 'routing.md § Unattended delegation');
  pin(anchor, R2, 'routing.md § Unattended delegation');
  assertAbsent(routing, 'with the test command and', 'routing.md', 'the test run is handed over by its command and contract, not by the old wording');
});

test('row 7: the harness seed states H1 then H2 directly after the test command line, and lacks the old fallback', () => {
  const seed = payload('templates/harness.md');
  pinOnce(seed, H1, 'templates/harness.md');
  pinOnce(seed, H2, 'templates/harness.md');
  const lines = seed.split(/\r?\n/).map(oneLine);
  const at = lines.findIndex((l) => l.startsWith('- test command:'));
  assert.notEqual(at, -1, 'templates/harness.md has no "- test command:" line');
  assert.equal(lines[at + 1], `- ${oneLine(H1)}`, 'the fast test command line must sit directly after the test command line');
  assert.equal(lines[at + 2], `- ${oneLine(H2)}`, 'the single test command line must sit directly after the fast test command line');
  assertAbsent(seed, 'without it verify derives one', 'templates/harness.md', 'the seed names no derived fallback');
});

test('row 8: a fresh claude install holds the three command lines in its sandbox section', (t) => {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'claude']).status, 0);
  const installed = fs.readFileSync(path.join(dir, 'sdlc', 'harness.md'), 'utf8');
  const lines = section(installed, 'Sandbox & execution').split(/\r?\n/);
  for (const prefix of ['- test command:', '- fast test command:', '- single test command:']) {
    assert.ok(lines.some((l) => l.startsWith(prefix)), `installed § Sandbox & execution has no "${prefix}" line`);
  }
});

test('row 9: the harness seed stays within the harness line cap', () => {
  const lines = countEffectiveLines(payload('templates/harness.md'));
  assert.ok(lines <= CAPS.harness, `templates/harness.md is ${lines} effective lines, cap is ${CAPS.harness}`);
});

test('row 10: build.md states B1 and B2 once each, and lacks the old full-run wording', () => {
  const build = payload('playbook/build.md');
  pin(build, B1, 'build.md');
  pin(build, B2, 'build.md');
  assertAbsent(build, 'the full test run belongs', 'build.md', 'the self-check runs only its own tests');
});

test('row 11: contract.md step 3 states C0 to C3 once each and in order, and lacks the harness test command run', () => {
  const anchor = step(payload('playbook/contract.md'), 3);
  for (const s of [C0, C1, C2, C3]) pin(anchor, s, 'contract.md step 3');
  inOrder(anchor, [C0, C1, C2, C3], 'contract.md step 3');
  pinOnce(step(payload('playbook/contract.md'), 5), C5, 'contract.md step 5');
  assertAbsent(anchor, 'Run the test command from', 'contract.md step 3', 'the red check runs only the generated tests');
});

test('row 12: sdlc-builder.md body states BA once, and lacks the old full-run wording', () => {
  const agent = body(payload('adapters/claude/agents/sdlc-builder.md'), 'sdlc-builder.md');
  // A parenthetical inside a sentence has no clause start to bound, so it is pinned verbatim.
  pinOnce(agent, BA, 'sdlc-builder.md body');
  assertAbsent(agent, 'the full run belongs to verify', 'sdlc-builder.md body', 'the self-check is not the full run');
});

test('row 13: sdlc-contractor.md body states CA once, and lacks the old run instruction', () => {
  const agent = body(payload('adapters/claude/agents/sdlc-contractor.md'), 'sdlc-contractor.md');
  pin(agent, CA, 'sdlc-contractor.md body');
  pin(agent, CB, 'sdlc-contractor.md body');
  assertAbsent(agent, 'Run the test command you are given:', 'sdlc-contractor.md body', 'the red check runs only the files it wrote');
});

test('row 14: init.md step 3 fills the test commands, and lacks the old single-command wording', () => {
  const anchor = step(payload('playbook/init.md'), 3);
  pinOnce(anchor, I1, 'init.md step 3');
  assertAbsent(anchor, 'fill tools, test command,', 'init.md step 3', 'init fills every level the project has');
});

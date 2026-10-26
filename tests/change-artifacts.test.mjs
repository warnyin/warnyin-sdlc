// Contract rows 1-4, 11-17, 19-25 of sdlc/changes/change-artifacts/contract/tests.md: the
// `artifact <id> <name>` stamp and its line grammar, the golden basis (`artifactBasis`), validate's
// artifact warnings, the write hook's silence on them, the conventions skill, and the lib/bin sweep.
// Rows 5-10, 18, 27 (on-disk), 28 and 30 (names, paths, links, escapes, stamp proof) are in
// tests/security-regressions.test.mjs. Rows 27 (unit), 29 and 31 are here. Row 26 is the existing
// suites, not a test here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  makeTempProject, runCli, runHook, writeChange, writeContractTests, STANDARD_BODY, PKG_ROOT, CLI,
} from './helpers.mjs';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// The golden basis, written from the contract recipe and NOT imported from lib/artifacts.mjs:
// each unfenced `## Design` / `## Delta:` section (heading + body up to the next unfenced `## `),
// trimEnd-ed, joined by "\n", after CRLF -> LF; first 12 hex of sha256.
function golden(text) {
  const sections = [];
  let cur = null;
  let fence = null;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const t = line.trimStart();
    if (fence !== null) {
      if (t.startsWith(fence)) fence = null;
    } else if (t.startsWith('```') || t.startsWith('~~~')) {
      fence = t.slice(0, 3);
    } else if (line.startsWith('## ')) {
      if (cur) sections.push(cur);
      cur = /^## (Design\s*$|Delta:)/.test(line) ? [line] : null;
      continue;
    }
    if (cur) cur.push(line);
  }
  if (cur) sections.push(cur);
  return sha(sections.map((s) => s.join('\n').trimEnd()).join('\n')).slice(0, 12);
}

// STANDARD_BODY plus a `## Design` section, so the basis has something to depict.
const BODY = STANDARD_BODY.replace('## Delta: auth', '## Design\n- decision: sms-free OTP\n\n## Delta: auth');
const STAMP_RE = /^- artifact\/plan\.html · basis: ([0-9a-f]{12})$/;
const FRONTMATTER = '---\nid: x\ntier: standard\nstatus: new\n---\n';

const changeFile = (root, id) => path.join(root, 'sdlc', 'changes', id, 'change.md');
const readText = (p) => fs.readFileSync(p, 'utf8');
const linesOf = (text) => text.split(/\r?\n/);
// The validate output lines that are warnings (`⚠ [id] msg`); errors are `✖`.
const warnLines = (text) => linesOf(text).filter((l) => l.startsWith('⚠'));

function setup(t, { id = 'x', body = BODY, status = 'new' } = {}) {
  const root = makeTempProject(t);
  assert.equal(runCli(root, ['init', '--tool', 'claude']).status, 0);
  const dir = writeChange(root, id, { status, body });
  if (status === 'verified') writeContractTests(dir);
  return { root, dir, id };
}

function writeArtifact(dir, name, text = '<!doctype html><p>plan</p>\n') {
  fs.mkdirSync(path.join(dir, 'artifact'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'artifact', name), text);
}

const loadBasis = async () =>
  (await import(pathToFileURL(path.join(PKG_ROOT, 'lib', 'artifacts.mjs')).href)).artifactBasis;

// A small change with two Delta capabilities, an Assumptions section and Tasks, for the basis rows.
const FIXTURE = [
  '# Change: Add two-factor auth', '',
  '## Why', 'Password-only login is weak.', '',
  '## Assumptions', '- SMS is out of scope', '',
  '## Design', '- decision: OTP from an authenticator app', '',
  '## Delta: auth', '',
  '### ADDED Requirement: Two-factor login',
  'The system SHALL require a second factor during login.', '',
  '#### Scenario: OTP required',
  '- WHEN a user submits valid credentials',
  '- THEN the system prompts for a one-time code', '',
  '## Delta: audit', '',
  '### ADDED Requirement: Audit',
  'The system SHALL log logins.', '',
  '## Tasks',
  '- [ ] T1 implement OTP flow [tier:balanced]', '',
].join('\n');

test('row 1: artifact <id> plan.html stamps exactly one line carrying the golden basis, exit 0', (t) => {
  const { root, dir, id } = setup(t);
  writeArtifact(dir, 'plan.html');
  const before = readText(changeFile(root, id));
  const res = runCli(root, ['artifact', id, 'plan.html']);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const hits = linesOf(readText(changeFile(root, id))).filter((l) => STAMP_RE.test(l));
  assert.equal(hits.length, 1, `exactly one stamped line expected, got ${JSON.stringify(hits)}`);
  assert.equal(STAMP_RE.exec(hits[0])[1], golden(before));
});

test('row 2: re-stamping after a Design edit leaves one line for plan.html carrying the new golden basis', (t) => {
  const { root, dir, id } = setup(t);
  writeArtifact(dir, 'plan.html');
  assert.equal(runCli(root, ['artifact', id, 'plan.html']).status, 0);
  const file = changeFile(root, id);
  fs.writeFileSync(file, readText(file).replace('sms-free OTP', 'email OTP'));
  const edited = readText(file);
  const res = runCli(root, ['artifact', id, 'plan.html']);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const forPlan = linesOf(readText(file)).filter((l) => l.includes('artifact/plan.html'));
  assert.equal(forPlan.length, 1, `one line for plan.html expected, got ${JSON.stringify(forPlan)}`);
  assert.ok(STAMP_RE.test(forPlan[0]), `the line must be the stamped form, got ${forPlan[0]}`);
  assert.equal(STAMP_RE.exec(forPlan[0])[1], golden(edited));
  // Nothing changed since: a third stamp succeeds and leaves every byte as it was.
  const settled = readText(file);
  assert.equal(runCli(root, ['artifact', id, 'plan.html']).status, 0, 'an unchanged re-stamp succeeds');
  assert.equal(readText(file), settled, 'an unchanged re-stamp writes nothing new');
});

// Each case: the bytes before, and the exact tail the stamp must append (the golden basis of the
// before-text). The tails follow the insertion rules: a missing final newline is added first, a
// blank separator precedes an appended section, and inserted lines use the file's own EOL.
const ART_LINE = (h) => `- artifact/plan.html · basis: ${h}`;
const OLDER_SECTION = '## Artifacts\n- [older](artifact/old.html) — kept\n';

test('row 3: a missing section, a missing final newline, CRLF, an empty section or a CRLF non-empty section each stamp to the exact expected bytes', (t) => {
  const root = makeTempProject(t);
  assert.equal(runCli(root, ['init', '--tool', 'claude']).status, 0);
  const cases = [
    { name: 'no Artifacts section', before: FRONTMATTER + STANDARD_BODY,
      tail: (h) => `\n## Artifacts\n${ART_LINE(h)}\n` },
    { name: 'no trailing newline', before: (FRONTMATTER + STANDARD_BODY).replace(/\n$/, ''),
      tail: (h) => `\n\n## Artifacts\n${ART_LINE(h)}\n` },
    { name: 'CRLF endings', before: (FRONTMATTER + STANDARD_BODY).replace(/\n/g, '\r\n'),
      tail: (h) => `\r\n## Artifacts\r\n${ART_LINE(h)}\r\n` },
    { name: 'empty Artifacts section', before: `${FRONTMATTER}${STANDARD_BODY}## Artifacts\n`,
      tail: (h) => `${ART_LINE(h)}\n` },
    { name: 'CRLF with a non-empty Artifacts section', before: `${FRONTMATTER}${STANDARD_BODY}${OLDER_SECTION}`.replace(/\n/g, '\r\n'),
      tail: (h) => `${ART_LINE(h)}\r\n` },
    // (f) the section is followed by another: the line goes after its last entry, the blank
    // separator and the next section stay where they were.
    { name: 'Artifacts followed by another section', before: `${FRONTMATTER}${STANDARD_BODY}${OLDER_SECTION}\n## Notes\nlater\n`,
      expect: (before, h) => before.replace('— kept\n', `— kept\n${ART_LINE(h)}\n`) },
    // (g) re-stamping a CRLF file's own line: only the basis token changes, its `\r` and its other
    // text are kept.
    { name: 'CRLF re-stamp of an existing line', before: `${FRONTMATTER}${STANDARD_BODY}## Artifacts\n- [Plan](artifact/plan.html) · basis: 000000000000 — v1\n`.replace(/\n/g, '\r\n'),
      expect: (before, h) => before.replace('basis: 000000000000', `basis: ${h}`) },
  ];
  cases.forEach(({ name, before, tail, expect }, k) => {
    const id = `case-${k}`;
    const dir = path.join(root, 'sdlc', 'changes', id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(changeFile(root, id), before);
    writeArtifact(dir, 'plan.html');
    const res = runCli(root, ['artifact', id, 'plan.html']);
    assert.equal(res.status, 0, `${name}: ${res.stdout}${res.stderr}`);
    const after = readText(changeFile(root, id));
    const want = expect ? expect(before, golden(before)) : before + tail(golden(before));
    assert.notEqual(want, before, `${name}: the fixture must expect a change`);
    assert.equal(after, want, `${name}: the file must equal the expected bytes`);
  });
});

// A hand-placed line keeps its own text; the stamp only sets or replaces its `basis:` token.
test('row 4: a hand-placed line for the path keeps its original text and gets the current basis, once, after a stamp and after a Design edit', (t) => {
  const root = makeTempProject(t);
  assert.equal(runCli(root, ['init', '--tool', 'claude']).status, 0);
  const fixtures = [
    { label: 'link with a label', line: '- [Plan v2](artifact/plan.html) — covers rollout', keep: '[Plan v2](artifact/plan.html) — covers rollout' },
    { label: 'bare path', line: '- artifact/plan.html', keep: 'artifact/plan.html' },
    { label: 'uppercase basis', line: '- artifact/plan.html · basis: ABCDEF012345', keep: 'artifact/plan.html' },
  ];
  fixtures.forEach(({ label, line, keep }, k) => {
    const id = `hand-${k}`;
    // A near-miss neighbour: the path match is exact, so this line is neither stamped nor counted.
    const NEIGHBOUR = '- artifact/plan.html.old';
    const NEIGHBOUR2 = '- artifact/plan.html-old';
    const dir = writeChange(root, id, { body: `${BODY}## Artifacts\n${line}\n${NEIGHBOUR}\n${NEIGHBOUR2}\n` });
    writeArtifact(dir, 'plan.html');
    const file = changeFile(root, id);
    for (const step of ['stamp', 'design-edit']) {
      if (step === 'design-edit') fs.writeFileSync(file, readText(file).replace('sms-free OTP', 'email OTP'));
      const res = runCli(root, ['artifact', id, 'plan.html']);
      assert.equal(res.status, 0, `${label} ${step}: ${res.stdout}${res.stderr}`);
      const text = readText(file);
      assert.ok(linesOf(text).includes(NEIGHBOUR), `${label} ${step}: the near-miss neighbour must stay untouched`);
      assert.ok(linesOf(text).includes(NEIGHBOUR2), `${label} ${step}: the -old neighbour must stay untouched`);
      // The path ends at whitespace, `)` or the end of the line — `plan.html-old` is not it.
      const forPlan = linesOf(text).filter((l) => /artifact\/plan\.html(?=[\s)]|$)/.test(l));
      assert.equal(forPlan.length, 1, `${label} ${step}: exactly one line for that path, got ${JSON.stringify(forPlan)}`);
      assert.ok(forPlan[0].includes(keep), `${label} ${step}: the line must keep "${keep}", got ${forPlan[0]}`);
      assert.equal(forPlan[0].match(/basis:/gi)?.length, 1, `${label} ${step}: one basis token, got ${forPlan[0]}`);
      assert.equal(forPlan[0].match(/basis:\s*([0-9a-f]{12})\b/)?.[1], golden(text), `${label} ${step}: the hex must be the current golden basis`);
    }
  });
});

test('row 11: artifact with no args, one arg or three args exits non-zero and prints its usage line', (t) => {
  const { root, dir, id } = setup(t);
  writeArtifact(dir, 'plan.html');
  const USAGE = 'usage: warnyin-sdlc artifact <change-id> <name>';
  for (const args of [['artifact'], ['artifact', id], ['artifact', id, 'plan.html', 'extra']]) {
    const res = runCli(root, args);
    assert.notEqual(res.status, 0, `${args.join(' ')} must exit non-zero`);
    assert.ok((res.stdout + res.stderr).includes(USAGE), `${args.join(' ')}: usage line missing`);
  }
  // Positive control on the same fixture: the two-argument form stamps.
  assert.equal(runCli(root, ['artifact', id, 'plan.html']).status, 0);
});

test('row 12: artifactBasis ignores Tasks, Assumptions, ## Artifacts and line endings; an empty Design or body-less Delta gives the golden value', async () => {
  const artifactBasis = await loadBasis();
  const base = artifactBasis(FIXTURE);
  assert.equal(base, golden(FIXTURE), 'the basis of the fixture must be the golden value');
  const same = {
    'Tasks ticked': FIXTURE.replace('- [ ] T1', '- [x] T1'),
    'Assumptions edited': FIXTURE.replace('SMS is out of scope', 'SMS comes later'),
    '## Artifacts added': `${FIXTURE}## Artifacts\n- artifact/plan.html · basis: ${base}\n`,
    'CRLF endings': FIXTURE.replace(/\n/g, '\r\n'),
  };
  for (const [name, text] of Object.entries(same)) {
    assert.equal(artifactBasis(text), base, `${name} must not change the basis`);
  }
  const emptyDesign = '# Change: x\n\n## Design\n\n## Delta: auth\n\n### ADDED Requirement: A\nThe system SHALL a.\n';
  assert.equal(artifactBasis(emptyDesign), golden(emptyDesign), 'an empty ## Design is hashed as its heading');
  const bodyless = '# Change: x\n\n## Delta: auth\n\n## Tasks\n- [ ] T1\n';
  assert.equal(artifactBasis(bodyless), golden(bodyless), 'a body-less ## Delta: is hashed as its heading');
});

test('row 13: one changed line of Design, of a second Delta, or the last line of a file with no final newline changes the basis', async () => {
  const artifactBasis = await loadBasis();
  const base = artifactBasis(FIXTURE);
  const changed = {
    'a Design line': FIXTURE.replace('OTP from an authenticator app', 'OTP from SMS'),
    'a line of the second Delta': FIXTURE.replace('The system SHALL log logins.', 'The system SHALL log every login.'),
  };
  for (const [name, text] of Object.entries(changed)) {
    assert.notEqual(artifactBasis(text), base, `${name} must change the basis`);
  }
  const tail = '# Change: x\n\n## Delta: auth\n\n### ADDED Requirement: A\nThe system SHALL a.\n\n#### Scenario: s\n- THEN the system shows X';
  assert.notEqual(
    artifactBasis(tail.replace('shows X', 'shows Y')), artifactBasis(tail),
    'the last line of a file with no final newline must count',
  );
});

test('row 14: a ## line inside a fence in Design does not end the section, so a Design line after the fence still counts', async () => {
  const artifactBasis = await loadBasis();
  const fenced = [
    '# Change: x', '', '## Design', '- decision: a', '',
    '```', '## X', '```', '- decision: b', '',
    '## Tasks', '- [ ] T1', '',
  ].join('\n');
  const edited = fenced.replace('- decision: b', '- decision: c');
  assert.notEqual(artifactBasis(edited), artifactBasis(fenced), 'a Design line after the fence must change the basis');
  assert.equal(artifactBasis(fenced), golden(fenced), 'the fenced ## line must not end the section');
});

test('row 15: a stamped LF change.md rewritten as CRLF gives validate no stale warning', (t) => {
  const { root, dir, id } = setup(t);
  writeArtifact(dir, 'plan.html');
  assert.equal(runCli(root, ['artifact', id, 'plan.html']).status, 0);
  const file = changeFile(root, id);
  fs.writeFileSync(file, readText(file).replace(/\r?\n/g, '\r\n'));
  const res = runCli(root, ['validate', id]);
  assert.doesNotMatch(res.stdout + res.stderr, /stale/, 'a CRLF rewrite is not a change of the plan');
  // Control: a real Design edit on the same CRLF file does give the stale warning.
  fs.writeFileSync(file, readText(file).replace('sms-free OTP', 'email OTP'));
  const edited = runCli(root, ['validate', id]);
  assert.ok(
    warnLines(edited.stdout).some((l) => l.includes('artifact/plan.html') && /stale/.test(l)),
    `a Design edit must warn stale, got ${edited.stdout}`,
  );
});

test('row 16: a stale stamped artifact warns at warn level in validate and --strict, exit 0, and archive still ships', (t) => {
  const { root, dir, id } = setup(t, { status: 'verified' });
  writeArtifact(dir, 'plan.html');
  assert.equal(runCli(root, ['artifact', id, 'plan.html']).status, 0);
  const staleLine = (res) => warnLines(res.stdout + res.stderr)
    .find((l) => l.includes('artifact/plan.html') && /stale/.test(l));
  const fresh = runCli(root, ['validate', id]);
  assert.equal(staleLine(fresh), undefined, 'control: a fresh stamp is not stale');
  const file = changeFile(root, id);
  fs.writeFileSync(file, readText(file).replace('sms-free OTP', 'email OTP'));
  for (const args of [['validate', id], ['validate', id, '--strict']]) {
    const res = runCli(root, args);
    assert.equal(res.status, 0, `${args.join(' ')} must exit 0: ${res.stdout}${res.stderr}`);
    assert.ok(staleLine(res), `${args.join(' ')} must warn stale for artifact/plan.html, got ${res.stdout}${res.stderr}`);
  }
  const shipped = runCli(root, ['archive', id]);
  assert.equal(shipped.status, 0, shipped.stdout + shipped.stderr);
  const archived = fs.readdirSync(path.join(root, 'sdlc', 'changes', 'archive')).find((n) => n.endsWith(`-${id}`));
  assert.ok(archived && fs.existsSync(path.join(root, 'sdlc', 'changes', 'archive', archived, 'artifact', 'plan.html')),
    'the archived change must carry artifact/plan.html');
});

test('row 17: a listed artifact whose file is absent warns naming it and missing, exit 0, also under --strict', (t) => {
  const { root, dir, id } = setup(t, { body: `${BODY}## Artifacts\n- artifact/x.md · basis: ${golden(BODY)}\n` });
  const missingLine = (res) => warnLines(res.stdout + res.stderr)
    .find((l) => l.includes('artifact/x.md') && /missing/.test(l));
  for (const args of [['validate', id], ['validate', id, '--strict']]) {
    const res = runCli(root, args);
    assert.equal(res.status, 0, `${args.join(' ')} must exit 0: ${res.stdout}${res.stderr}`);
    assert.ok(missingLine(res), `${args.join(' ')} must warn missing for artifact/x.md, got ${res.stdout}${res.stderr}`);
  }
  writeArtifact(dir, 'x.md', '# x\n');
  assert.equal(missingLine(runCli(root, ['validate', id])), undefined, 'control: a present file is not missing');
});

test('row 19: a present basis-less line and an unlisted file stay quiet; a listed missing file warns whether or not it has a basis; no ## Artifacts gives none', async (t) => {
  const { root, dir, id } = setup(t, {
    body: `${BODY}## Artifacts\n- [plan](artifact/plan.html)\n- artifact/z.md · basis: ${golden(BODY)}\n- artifact/gone.md\n`,
  });
  writeArtifact(dir, 'plan.html');
  writeArtifact(dir, 'y.md');
  const res = runCli(root, ['validate', id]);
  const hits = warnLines(res.stdout + res.stderr).filter((l) => l.includes('artifact/'));
  assert.equal(hits.length, 2, `exactly two artifact warnings expected, got ${JSON.stringify(hits)}`);
  assert.ok(hits.some((l) => l.includes('artifact/z.md') && /missing/.test(l)), `a stamped missing file warns, got ${JSON.stringify(hits)}`);
  // A basis-less line is still checked for existence (Delta: "checked only for existence").
  assert.ok(hits.some((l) => l.includes('artifact/gone.md') && /missing/.test(l)), `a basis-less missing file warns, got ${JSON.stringify(hits)}`);
  const plain = writeChange(root, 'plain', { body: BODY });
  const plainRes = runCli(root, ['validate', 'plain']);
  assert.doesNotMatch(plainRes.stdout + plainRes.stderr, /artifact/i, `a change with no ## Artifacts has no artifact output: ${plain}`);
  // "Same output as before the change": with no ## Artifacts, the artifact checks add nothing at all.
  const { validateChange } = await import(pathToFileURL(path.join(PKG_ROOT, 'lib', 'validate.mjs')).href);
  assert.deepEqual(validateChange(plain), validateChange(plain, { artifacts: false }),
    'a change with no ## Artifacts validates exactly as it would without the artifact checks');
});

test('row 20: a bare "- " bullet under ## Artifacts adds exactly one warning naming no readable path, and no error', (t) => {
  const root = makeTempProject(t);
  assert.equal(runCli(root, ['init', '--tool', 'claude']).status, 0);
  writeChange(root, 'control-empty', { body: `${BODY}## Artifacts\n\n` });
  // The bullet keeps its trailing space: `- ` with nothing after it is the fixture.
  writeChange(root, 'bad-bullet', { body: `${BODY}## Artifacts\n- \n` });
  const summary = (res) => res.stdout.match(/validate: (\d+) error\(s\), (\d+) warning\(s\)/);
  const control = runCli(root, ['validate', 'control-empty']);
  const bad = runCli(root, ['validate', 'bad-bullet']);
  const c = summary(control);
  const b = summary(bad);
  assert.ok(c && b, `summary lines expected, got ${control.stdout} / ${bad.stdout}`);
  const noPath = warnLines(bad.stdout + bad.stderr).filter((l) => /no readable path/.test(l));
  assert.equal(noPath.length, 1, `exactly one warning matching /no readable path/, got ${JSON.stringify(noPath)}`);
  assert.equal(Number(b[1]), 0, 'a bullet with no readable path is no error');
  assert.equal(Number(b[2]), Number(c[2]) + 1, `exactly one more warning than the control, got ${b[2]} vs ${c[2]}`);
});

test('row 21: a missing file listed only inside a fence is not warned; the same file listed in the real section is', (t) => {
  const ref = golden(BODY);
  const fenced = `${BODY}\`\`\`\n## Artifacts\n- artifact/a.md · basis: ${ref}\n\`\`\`\n## Artifacts\n- artifact/b.md · basis: ${ref}\n`;
  const { root, id } = setup(t, { id: 'fenced', body: fenced });
  const res = runCli(root, ['validate', id]);
  const warns = warnLines(res.stdout + res.stderr);
  assert.ok(warns.some((l) => l.includes('artifact/b.md')), `b.md must warn, got ${JSON.stringify(warns)}`);
  assert.ok(!warns.some((l) => l.includes('artifact/a.md')), `a.md is inside a fence and must not warn, got ${JSON.stringify(warns)}`);
  // Control: the same file listed in the real section does warn.
  writeChange(root, 'unfenced', { body: `${BODY}## Artifacts\n- artifact/a.md · basis: ${ref}\n- artifact/b.md · basis: ${ref}\n` });
  const control = runCli(root, ['validate', 'unfenced']);
  assert.ok(warnLines(control.stdout + control.stderr).some((l) => l.includes('artifact/a.md')),
    'control: a.md listed in the real section must warn');
});

test('row 22: archiving a change with artifacts keeps artifact/<file> under the archived folder (pin, green before)', (t) => {
  const { root, dir, id } = setup(t, { status: 'verified' });
  writeArtifact(dir, 'plan.html');
  const res = runCli(root, ['archive', id]);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const archived = fs.readdirSync(path.join(root, 'sdlc', 'changes', 'archive')).find((n) => n.endsWith(`-${id}`));
  assert.ok(archived, 'the archived folder exists with a date prefix');
  assert.ok(fs.existsSync(path.join(root, 'sdlc', 'changes', 'archive', archived, 'artifact', 'plan.html')),
    'artifact/plan.html must be under the archived change folder');
});

test('row 23: the write hook prints the marker issue and no artifact warning; validateChange has an artifact issue only by default', async (t) => {
  const body = BODY.replace('sms-free OTP', 'sms-free OTP [NEEDS CLARIFICATION: which factor]')
    + '## Artifacts\n- artifact/plan.html · basis: deadbeef0000\n';
  const { root, dir, id } = setup(t, { id: 'warn-hook', body });
  writeArtifact(dir, 'plan.html');
  const res = runHook(root, 'validate-artifact.mjs', {
    stdin: { tool_input: { file_path: `sdlc/changes/${id}/change.md` } },
  });
  assert.equal(res.status, 0, res.stderr);
  assert.ok(res.stdout.trim(), 'the hook must print the unresolved marker issue');
  const ctx = JSON.parse(res.stdout).hookSpecificOutput.additionalContext;
  assert.match(ctx, /NEEDS CLARIFICATION/, 'the marker issue must reach the hook output');
  assert.doesNotMatch(ctx, /artifact\//, 'the hook output must carry no artifact warning');

  const { validateChange } = await import(pathToFileURL(path.join(PKG_ROOT, 'lib', 'validate.mjs')).href);
  const artifactMsgs = (issues) => issues.filter((i) => /artifact/i.test(i.msg)).map((i) => i.msg);
  assert.deepEqual(artifactMsgs(validateChange(dir, { artifacts: false })), [], 'artifacts:false drops artifact issues');
  assert.ok(artifactMsgs(validateChange(dir)).length > 0, 'the default keeps the artifact warning');
});

test('row 24: the conventions skill says a stale artifact is not evidence, names change.md as source of truth, and names the stamp command', () => {
  const skill = fs.readFileSync(path.join(PKG_ROOT, 'payload', 'adapters', 'claude', 'skills', 'sdlc-conventions', 'SKILL.md'), 'utf8');
  // The whole rule, on the one line that states it: which artifacts are not evidence, and why.
  const rule = linesOf(skill).find((l) => l.includes('not evidence'));
  assert.ok(rule, 'the conventions skill must state that an artifact can be "not evidence"');
  for (const part of [/stale/, /absent/, /source of truth/, /artifact <id> <name>/]) {
    assert.match(rule, part, `the rule line must carry ${part}, got ${rule}`);
  }
});

// The source of `export function <name>(...) { ... }`, from its `{` to the matching `}`.
function functionBody(src, name) {
  const start = src.indexOf(`export function ${name}(`);
  if (start < 0) return null;
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  return null;
}

function listMjs(dir) {
  return fs.readdirSync(path.join(PKG_ROOT, dir))
    .filter((f) => f.endsWith('.mjs'))
    .map((f) => path.join(PKG_ROOT, dir, f));
}

test('row 25: each shared helper is defined once in its own module, the new modules import only node: and ./, validate has no error-level artifact check, docs/design.md has ## Artifacts', () => {
  const files = [...listMjs('lib'), ...listMjs('bin')];
  const rel = (f) => path.relative(PKG_ROOT, f).split(path.sep).join('/');
  const definedIn = (name) => files
    .filter((f) => new RegExp(`(function|const|let)\\s+${name}\\b`).test(readText(f)))
    .map(rel);
  assert.deepEqual(definedIn('linesOutsideFences'), ['lib/fences.mjs'], 'linesOutsideFences is declared once, in lib/fences.mjs');
  assert.deepEqual(definedIn('resolveChangeFile'), ['lib/change-file.mjs'], 'resolveChangeFile is declared once, in lib/change-file.mjs');
  const ruleHolders = files.filter((f) => readText(f).includes('com[1-9]')).map(rel);
  assert.equal(ruleHolders.length, 1, `the reserved-device rule com[1-9] appears in exactly one file, got ${JSON.stringify(ruleHolders)}`);

  // Delta: an artifact path is warned about "without opening" it. Nothing in lib/artifacts.mjs may
  // read, open, stat-through or resolve a path — lstat is the only filesystem call it makes.
  // An allowlist, not a list of forbidden names: any other fs member (readdirSync,
  // realpathSync.native, promises.*), a computed `fs[...]`, or a named/aliased import from node:fs
  // fails it.
  const artifactsSrc = readText(path.join(PKG_ROOT, 'lib', 'artifacts.mjs'));
  const fsMembers = [...new Set([...artifactsSrc.matchAll(/\bfs\s*\.\s*(\w+)/g)].map((m) => m[1]))];
  assert.deepEqual(fsMembers, ['lstatSync'], `lib/artifacts.mjs may use only fs.lstatSync, found ${JSON.stringify(fsMembers)}`);
  assert.doesNotMatch(artifactsSrc, /\bfs\s*\[/, 'lib/artifacts.mjs must not reach fs through a computed member');
  const fsImports = [...artifactsSrc.matchAll(/import\s+([^;]+?)\s+from\s+['"](?:node:)?fs(?:\/promises)?['"]/g)].map((m) => m[1].trim());
  assert.deepEqual(fsImports, ['fs'], `lib/artifacts.mjs must import node:fs only as the default "fs", found ${JSON.stringify(fsImports)}`);
  // Bare-token rule: every `fs` token is the import line or `fs.lstatSync` — an alias
  // (`const g = fs`) or optional call (`fs?.readFileSync`) would slip past the member scan.
  const strayFs = linesOf(artifactsSrc).flatMap((l, i) => {
    if (/^import\s+fs\s+from\s+['"]node:fs['"];?\s*$/.test(l.trim())) return [];
    return [...l.matchAll(/\bfs\b/g)].filter((m) => !l.slice(m.index).startsWith('fs.lstatSync')).map(() => `${i + 1}: ${l.trim()}`);
  });
  assert.deepEqual(strayFs, [], 'every fs token in lib/artifacts.mjs is the import or fs.lstatSync');
  for (const mod of ['lib/artifacts.mjs', 'lib/fences.mjs', 'lib/change-file.mjs']) {
    const src = readText(path.join(PKG_ROOT, mod)).split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n');
    for (const banned of [/\bimport\s*\(/, /createRequire/, /getBuiltinModule/, /process\s*(\?\.|\.|\[)\s*['"]?binding/]) {
      assert.doesNotMatch(src, banned, `${mod} must not match ${banned} — a module reached that way escapes the import scan`);
    }
  }

  for (const mod of ['lib/artifacts.mjs', 'lib/fences.mjs', 'lib/change-file.mjs']) {
    const p = path.join(PKG_ROOT, mod);
    assert.ok(fs.existsSync(p), `${mod} must exist`);
    const specs = [...readText(p).matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const s of specs) {
      assert.ok(s.startsWith('node:') || s.startsWith('./'), `${mod} imports "${s}" — only node: and ./ are allowed`);
    }
  }

  const validateSrc = readText(path.join(PKG_ROOT, 'lib', 'validate.mjs'));
  assert.match(validateSrc, /from '\.\/artifacts\.mjs'/, 'the artifact checks in validate come from lib/artifacts.mjs');
  // The artifact block: from its comment to the next blank line, scanned whole (a multi-line
  // issue(...) call must not hide an 'error' from a per-line scan).
  const vLines = linesOf(validateSrc);
  const blockStart = vLines.findIndex((l) => /Artifact findings/.test(l));
  assert.ok(blockStart >= 0, 'validate.mjs has the artifact block comment');
  let blockEnd = blockStart;
  while (blockEnd < vLines.length && vLines[blockEnd].trim() !== '') blockEnd++;
  const block = vLines.slice(blockStart, blockEnd).join('\n');
  assert.match(block, /artifactWarnings\(/, 'the artifact block calls artifactWarnings');
  assert.doesNotMatch(block, /'error'/, `the artifact block in validate must not be error-level:\n${block}`);

  // cmdArtifact: writes only through writeFileContained, then re-reads change.md and proves it.
  const cliSrc = readText(path.join(PKG_ROOT, 'bin', 'cli.mjs'));
  const cmd = functionBody(cliSrc, 'cmdArtifact');
  assert.ok(cmd, 'cmdArtifact is declared in bin/cli.mjs');
  assert.ok(cmd.includes('writeFileContained('), 'cmdArtifact writes through writeFileContained(');
  assert.doesNotMatch(cmd, /writeFileSync|writeFile\(/, 'cmdArtifact must not write any other way');
  const afterWrite = cmd.slice(cmd.indexOf('writeFileContained('));
  const readCall = afterWrite.indexOf('readArtifacts(');
  assert.ok(readCall > 0, 'cmdArtifact calls readArtifacts( after writeFileContained(');
  assert.ok(afterWrite.slice(0, readCall + 'readArtifacts('.length + 40).includes('readFileSync('),
    'the readArtifacts call after the write works on a re-read of change.md');

  const design = linesOf(readText(path.join(PKG_ROOT, 'docs', 'design.md')));
  assert.ok(design.some((l) => l.includes('## Artifacts')), 'docs/design.md must mention ## Artifacts in its ledger');
});

test('row 27: artifactNameError refuses a Windows reserved device stem with "reserved name", and accepts names that only start like one', async () => {
  const { artifactNameError } = await import(pathToFileURL(path.join(PKG_ROOT, 'lib', 'artifacts.mjs')).href);
  for (const name of ['con.html', 'nul.md', 'com1.png', 'lpt9.pdf', 'aux.md']) {
    const err = artifactNameError(name);
    assert.notEqual(err, null, `${name} must be refused`);
    assert.match(err, /reserved name/, `${name}: the reason must say reserved name, got ${err}`);
  }
  for (const name of ['console.md', 'nullable.md', 'com0.md']) {
    assert.equal(artifactNameError(name), null, `${name} is not a reserved name and must be accepted`);
  }
});

test('row 29: a change with neither a real ## Design nor a real ## Delta: is refused as nothing to depict, change.md byte-identical', (t) => {
  const NOTHING = [
    '# Change: x', '',
    '## Why', 'We add a ## Delta: section later, as prose only.', '',
    '```', '## Design', '- decision: fenced, not real', '```', '',
    '## Tasks', '- [ ] T1 do it [tier:balanced]', '',
  ].join('\n');
  const { root, dir, id } = setup(t, { id: 'nothing-depicted', body: NOTHING });
  writeArtifact(dir, 'plan.html');
  const file = changeFile(root, id);
  const before = fs.readFileSync(file);
  const res = runCli(root, ['artifact', id, 'plan.html']);
  assert.notEqual(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stderr, /nothing for a basis to depict/, 'stderr must say there is nothing for a basis to depict');
  assert.ok(fs.readFileSync(file).equals(before), 'change.md must be byte-identical');
  // Control: the same change with a real ## Design heading (outside any fence) stamps.
  fs.appendFileSync(file, '\n## Design\n- decision: real\n');
  assert.equal(runCli(root, ['artifact', id, 'plan.html']).status, 0, 'control: a real Design section stamps');
});

// spawnSync with a timeout, for rows that must finish in time; runCli has no timeout option.
function timedCli(cwd, args) {
  const started = Date.now();
  const res = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 20000,
    env: { ...process.env, NO_COLOR: '1', CLAUDE_CODE_SESSION_ID: undefined },
  });
  return { ...res, ms: Date.now() - started };
}

test('row 31: a 200 000-character ## Artifacts line lets validate and artifact each finish within 5 s; validate warns once, too long, exit 0', (t) => {
  const root = makeTempProject(t);
  assert.equal(runCli(root, ['init', '--tool', 'claude']).status, 0);
  const dir = writeChange(root, 'huge', { body: `${BODY}## Artifacts\n- ${'['.repeat(200000)}\n` });
  writeArtifact(dir, 'plan.html');
  const validate = timedCli(root, ['validate', 'huge']);
  const stamp = timedCli(root, ['artifact', 'huge', 'plan.html']);
  for (const [label, r] of [['validate', validate], ['artifact', stamp]]) {
    assert.equal(r.error, undefined, `${label} must run to completion, got ${r.error?.code}`);
    assert.equal(r.signal, null, `${label} must not be killed by a signal, got ${r.signal}`);
    assert.ok(r.ms < 5000, `${label} took ${r.ms} ms, must finish within 5 s`);
  }
  assert.equal(validate.status, 0, validate.stdout + validate.stderr);
  const tooLong = warnLines(validate.stdout + validate.stderr).filter((l) => /too long/.test(l));
  assert.equal(tooLong.length, 1, `exactly one warning matching /too long/, got ${JSON.stringify(tooLong)}`);
});

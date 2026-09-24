import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeTempProject, runCli, writeChange, STANDARD_BODY, PKG_ROOT } from './helpers.mjs';
import { buildReport, renderReport } from '../lib/observe.mjs';
import { countEffectiveLines } from '../lib/caps.mjs';

const pb = (n) => fs.readFileSync(path.join(PKG_ROOT, 'payload/playbook', n), 'utf8');
const stub = (n) => fs.readFileSync(
  path.join(PKG_ROOT, 'payload/adapters/claude/commands/sdlc', `${n}.md`), 'utf8');

// Telemetry for an open change lives out of tree; derive that stream from the change
// folder so these fixtures exercise the real residency, not the legacy read shim.
function journalLine(changeDir, event) {
  const live = path.resolve(changeDir, '..', '..', '.state', 'journal', `${path.basename(changeDir)}.ndjson`);
  fs.mkdirSync(path.dirname(live), { recursive: true });
  fs.appendFileSync(live, JSON.stringify(event) + '\n');
}

function projectWithChange(t, events) {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const changeDir = writeChange(dir, 'autopilot-test', { status: 'verified', body: STANDARD_BODY });
  for (const e of events) journalLine(changeDir, e);
  return buildReport(path.join(dir, 'sdlc'));
}
const change = (report) => report.changes.find((c) => c.id.endsWith('autopilot-test'));

// row 1: init installs autopilot command, playbook, and grill template
test('autopilot: init --tool claude installs autopilot.md, playbook, and grill.md template', (t) => {
  const dir = makeTempProject(t);
  const res = runCli(dir, ['init', '--tool', 'claude']);
  assert.equal(res.status, 0, res.stderr);

  const cmdPath = path.join(dir, '.claude/commands/sdlc/autopilot.md');
  assert.ok(fs.existsSync(cmdPath), 'autopilot command exists');

  const playbookPath = path.join(dir, 'sdlc/.playbook/autopilot.md');
  assert.ok(fs.existsSync(playbookPath), 'autopilot playbook exists');

  const grillPath = path.join(dir, 'sdlc/.playbook/templates/grill.md');
  assert.ok(fs.existsSync(grillPath), 'grill.md template exists');

  // Verify all three are in the manifest
  const manifestPath = path.join(dir, 'sdlc/.state/manifest');
  assert.ok(fs.existsSync(manifestPath), 'manifest exists');
  const manifest = fs.readFileSync(manifestPath, 'utf8');
  assert.match(manifest, /autopilot\.md/, 'autopilot command in manifest');
  assert.match(manifest, /\.playbook\/autopilot\.md/, 'autopilot playbook in manifest');
  assert.match(manifest, /templates\/grill\.md/, 'grill template in manifest');
});

// row 2: autopilot command stub points at playbook, has argument hint, body ≤15 lines
test('autopilot: command stub points at autopilot.md, has argument-hint, body ≤15 lines', () => {
  const text = stub('autopilot');
  assert.match(text, /sdlc\/\.playbook\/autopilot\.md/,
    'autopilot.md: command stub must reference autopilot.md playbook');
  assert.match(text, /argument-hint/,
    'autopilot.md: command stub must have argument-hint');
  const body = text.split('---').slice(2).join('---');
  const lines = body.split('\n').filter((l) => l.trim()).length;
  assert.ok(lines <= 15, `autopilot.md: command body has ${lines} lines (≤15)`);
});

// row 3: autopilot.md grills in rounds with frontier, numbered questions, recommended answers, facts looked up, picker available
test('autopilot: playbook grills in rounds with numbered questions, recommended answers, and pickers', () => {
  const t = pb('autopilot.md');
  assert.match(t, /round/i, 'autopilot.md must name rounds');
  assert.match(t, /(numbered|question)/i, 'autopilot.md must reference numbered questions');
  assert.match(t, /(recommend|suggest)/i, 'autopilot.md must offer recommended answers');
  assert.match(t, /(look up|looked up|facts|picker)/i, 'autopilot.md must mention facts looked up or picker');
});

// row 4: autopilot.md settles requirement, done, priority order (requirement/quality/time/cost), escalations, hard-floor items
test('autopilot: playbook settles requirement, done, priority order, escalation rows, hard-floor surfaces', () => {
  const t = pb('autopilot.md');
  assert.match(t, /(requirement|Done)/i, 'autopilot.md must settle what done looks like');
  assert.match(t, /(priority|order)/i, 'autopilot.md must establish priority order');
  assert.match(t, /(requirement|quality|standard|time|cost)/i, 'autopilot.md must cover decision criteria');
  assert.match(t, /(escalation|condition)/i, 'autopilot.md must enumerate escalations');
  assert.match(t, /(hard.?floor|surface)/i, 'autopilot.md must itemize hard-floor surfaces');
});

// row 5: autopilot.md states nothing written before confirmation, declined/edited reopens round or stops
test('autopilot: playbook states nothing written before confirmation, declined item reopens or stops', () => {
  const t = pb('autopilot.md');
  assert.match(t, /(nothing is written|no file is written|writes nothing|leaves nothing)/i,
    'autopilot.md must state nothing written before confirmation');
  assert.match(t, /(decline|refus|edit)/i, 'autopilot.md must allow decline/edit of items');
  assert.match(t, /(reopen|round|stop)/i, 'autopilot.md must describe reopen or stop on decline');
});

// row 6: autopilot.md states hard-floor mid-run is refusable confirmation item, refusal turns back to stop
test('autopilot: playbook states hard-floor found mid-run is decided without you (refusable)', () => {
  const t = pb('autopilot.md');
  assert.match(t, /(hard.?floor|hard-floor.*found mid-run|found mid-run.*decided)/i,
    'autopilot.md must address hard-floor found mid-run');
  assert.match(t, /(decided without you|decide.*alone)/i, 'autopilot.md must state it is decided autonomously');
  assert.match(t, /(refusable|refuse|decline)/i, 'autopilot.md must make this a refusable item');
  assert.match(t, /(condition.*back.*stop|turn.*stop)/i, 'autopilot.md must explain refusal turns condition to stop');
});

// row 7: grill.md is written after confirmation at sdlc/changes/<id>/grill.md
test('autopilot: playbook writes grill.md after confirmation at changes/<id>/grill.md', () => {
  const t = pb('autopilot.md');
  assert.match(t, /grill\.md/, 'autopilot.md must name grill.md');
  assert.match(t, /sdlc\/changes/, 'autopilot.md must reference changes/ path');
  assert.match(t, /(confirm|write|first write|after confirm)/i,
    'autopilot.md must describe grill.md as written after confirmation');
});

// row 8: payload/templates/grill.md carries 4 sections and cap:80 equals CAPS.grill
test('autopilot: grill.md template carries 4 sections and cap annotation', () => {
  const grillPath = path.join(PKG_ROOT, 'payload/templates/grill.md');
  assert.ok(fs.existsSync(grillPath), 'grill.md template must exist');

  const text = fs.readFileSync(grillPath, 'utf8');
  assert.match(text, /##\s+Delegation/, 'grill.md must have ## Delegation section');
  assert.match(text, /##\s+Priorities/, 'grill.md must have ## Priorities section');
  assert.match(text, /##\s+Mandate/, 'grill.md must have ## Mandate section');
  assert.match(text, /##\s+Decisions/, 'grill.md must have ## Decisions section');

  const m = text.match(/cap:(\d+)/);
  assert.ok(m, 'grill.md: missing cap:<n> annotation');
  const grillCap = 80; // Use hardcoded 80 since CAPS.grill is not yet implemented
  assert.equal(Number(m[1]), grillCap, `grill.md cap ${m[1]} != expected ${grillCap}`);
});

// row 9: change with valid grill.md within cap / validate runs / 0 errors
test('autopilot: validate accepts change with grill.md within cap and all sections', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const changeDir = writeChange(dir, 'grill-valid', {
    status: 'verified',
    body: STANDARD_BODY,
  });

  // Write contract/tests.md to satisfy verified status
  fs.mkdirSync(path.join(changeDir, 'contract'), { recursive: true }); fs.writeFileSync(path.join(changeDir, 'contract', 'tests.md'),
    '# Tests\n| # | Given | unit |\n|---|---|---|\n| 1 | x | y |\n');

  // Write valid grill.md with all sections within cap
  const grillContent = [
    '---',
    'id: grill-valid',
    '---',
    '# Grill: autopilot decision record',
    '',
    '## Delegation',
    'Delegated to Claude for this run only.',
    '',
    '## Priorities',
    'requirement > quality > time > cost',
    '',
    '## Mandate',
    'Implement 2FA login flow.',
    '',
    '## Decisions',
    '(none yet)',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(changeDir, 'grill.md'), grillContent);

  const res = runCli(dir, ['validate', 'grill-valid']);
  assert.equal(res.status, 0, `validate must pass for valid grill.md, got stderr: ${res.stderr}`);
});

// row 10: change with over-cap grill.md / validate runs / error naming change, file, count, cap; exit 1
test('autopilot: validate rejects grill.md exceeding cap', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const changeDir = writeChange(dir, 'grill-over-cap', {
    status: 'verified',
    body: STANDARD_BODY,
  });

  // Write contract/tests.md
  fs.mkdirSync(path.join(changeDir, 'contract'), { recursive: true }); fs.writeFileSync(path.join(changeDir, 'contract', 'tests.md'),
    '# Tests\n| # | Given | unit |\n|---|---|---|\n| 1 | x | y |\n');

  // Write grill.md exceeding cap
  const capPlus = 80 + 5; // grill cap is 80
  const lines = [];
  lines.push('---', 'id: grill-over-cap', '---', '# Grill', '', '## Delegation', 'Delegated.', '',
    '## Priorities', 'req > qual > time > cost', '', '## Mandate', 'Implement feature.', '', '## Decisions');
  // Add enough lines to exceed cap
  for (let i = 0; i < capPlus; i++) {
    lines.push(`Line ${i}`);
  }
  const grillContent = lines.join('\n');
  fs.writeFileSync(path.join(changeDir, 'grill.md'), grillContent);

  const res = runCli(dir, ['validate', 'grill-over-cap']);
  assert.equal(res.status, 1, 'validate must fail with exit 1 for over-cap grill.md');
  assert.match(res.stderr + res.stdout, /grill-over-cap/, 'error must name the change');
  assert.match(res.stderr + res.stdout, /grill\.md/, 'error must name the file');
  assert.match(res.stderr + res.stdout, /\d+/, 'error must mention line count');
  assert.match(res.stderr + res.stdout, /cap|budget|limit/i, 'error must mention cap/limit');
});

// row 11: change with missing sections / validate runs / error naming missing section; exit 1
test('autopilot: validate rejects grill.md with missing sections', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);

  // Test each missing section
  for (const missing of ['Delegation', 'Priorities', 'Mandate', 'Decisions']) {
    const changeId = `grill-missing-${missing.toLowerCase()}`;
    const cDir = writeChange(dir, changeId, { status: 'verified', body: STANDARD_BODY });

    // Write contract/tests.md
    fs.mkdirSync(path.join(cDir, 'contract'), { recursive: true }); fs.writeFileSync(path.join(cDir, 'contract', 'tests.md'),
      '# Tests\n| # | Given | unit |\n|---|---|---|\n| 1 | x | y |\n');

    // Build grill.md without this section
    const sections = ['Delegation', 'Priorities', 'Mandate', 'Decisions'].filter((s) => s !== missing);
    const lines = ['---', `id: ${changeId}`, '---', '# Grill', ''];
    for (const s of sections) {
      lines.push(`## ${s}`, `Content for ${s}.`, '');
    }
    fs.writeFileSync(path.join(cDir, 'grill.md'), lines.join('\n'));

    const res = runCli(dir, ['validate', changeId]);
    assert.equal(res.status, 1, `validate must fail for missing ${missing}`);
    assert.match(res.stderr + res.stdout, new RegExp(missing, 'i'),
      `error must name the missing section: ${missing}`);
  }
});

// row 12: change with NO grill.md / validate runs / no grill-related issue (regression guard, should PASS)
test('autopilot: validate does not require grill.md (presence is not required)', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const changeDir = writeChange(dir, 'no-grill', {
    status: 'verified',
    body: STANDARD_BODY,
  });

  // Write contract/tests.md to satisfy verified status
  fs.mkdirSync(path.join(changeDir, 'contract'), { recursive: true }); fs.writeFileSync(path.join(changeDir, 'contract', 'tests.md'),
    '# Tests\n| # | Given | unit |\n|---|---|---|\n| 1 | x | y |\n');
  // Do NOT write grill.md

  const res = runCli(dir, ['validate', 'no-grill']);
  assert.equal(res.status, 0, `validate must not fail when grill.md is absent, got: ${res.stderr}`);
  assert.doesNotMatch(res.stderr + res.stdout, /grill/i,
    'error message must not mention grill when it is absent (row 12 regression guard)');
});

// row 13: grill.md inside fenced code block or as ### Mandate / validate runs / reported missing
test('autopilot: validate rejects grill.md with sections only in code blocks or as ### instead of ##', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);

  // Test 1: sections in code block
  const changeId1 = 'grill-in-fence';
  const cDir1 = writeChange(dir, changeId1, { status: 'verified', body: STANDARD_BODY });
  fs.mkdirSync(path.join(cDir1, 'contract'), { recursive: true }); fs.writeFileSync(path.join(cDir1, 'contract', 'tests.md'),
    '# Tests\n| # | Given | unit |\n|---|---|---|\n| 1 | x | y |\n');
  const grillInFence = [
    '---',
    `id: ${changeId1}`,
    '---',
    '# Grill',
    '',
    '```',
    '## Delegation',
    '## Priorities',
    '## Mandate',
    '## Decisions',
    '```',
  ].join('\n');
  fs.writeFileSync(path.join(cDir1, 'grill.md'), grillInFence);
  const res1 = runCli(dir, ['validate', changeId1]);
  assert.equal(res1.status, 1, 'validate must fail for sections in code block');
  assert.match(res1.stderr + res1.stdout, /(Delegation|Priorities|Mandate|Decisions)/i,
    'error must report missing sections');

  // Test 2: sections as ### instead of ##
  const changeId2 = 'grill-subheadings';
  const cDir2 = writeChange(dir, changeId2, { status: 'verified', body: STANDARD_BODY });
  fs.mkdirSync(path.join(cDir2, 'contract'), { recursive: true }); fs.writeFileSync(path.join(cDir2, 'contract', 'tests.md'),
    '# Tests\n| # | Given | unit |\n|---|---|---|\n| 1 | x | y |\n');
  const grillSubheadings = [
    '---',
    `id: ${changeId2}`,
    '---',
    '# Grill',
    '### Delegation',
    'Text',
    '### Priorities',
    'Text',
    '### Mandate',
    'Text',
    '### Decisions',
    'Text',
  ].join('\n');
  fs.writeFileSync(path.join(cDir2, 'grill.md'), grillSubheadings);
  const res2 = runCli(dir, ['validate', changeId2]);
  assert.equal(res2.status, 1, 'validate must fail for ### instead of ## sections');
  assert.match(res2.stderr + res2.stdout, /(Delegation|Priorities|Mandate|Decisions)/i,
    'error must report missing sections');
});

// row 14: grill.md unreadable (directory in place) / validate runs / issue naming change, never throws
test('autopilot: validate handles grill.md directory gracefully (unreadable)', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const changeDir = writeChange(dir, 'grill-dir', {
    status: 'verified',
    body: STANDARD_BODY,
  });

  // Write contract/tests.md
  fs.mkdirSync(path.join(changeDir, 'contract'), { recursive: true }); fs.writeFileSync(path.join(changeDir, 'contract', 'tests.md'),
    '# Tests\n| # | Given | unit |\n|---|---|---|\n| 1 | x | y |\n');

  // Create grill.md as a directory instead of a file
  const grillPath = path.join(changeDir, 'grill.md');
  fs.mkdirSync(grillPath, { recursive: true });

  // Should not throw; should report an issue
  const res = runCli(dir, ['validate', 'grill-dir']);
  assert.equal(res.status, 1, 'validate must fail with exit 1 for unreadable grill.md');
  assert.match(res.stderr + res.stdout, /grill-dir/, 'error must name the change');
  assert.doesNotMatch(res.stderr + res.stdout, /throw|crash|exception/i,
    'error handling must never crash (row 14 constraint)');
});

// row 15: escalation not pre-approved decided by priority order, run continues
test('autopilot: playbook decides unapproved escalations by priority order, never stops', () => {
  const t = pb('autopilot.md');
  assert.match(t, /(escalation|condition).*not pre-approv/i,
    'autopilot.md must address conditions not pre-approved');
  assert.match(t, /(priority order|decide|continue)/i,
    'autopilot.md must decide by priority and continue without stopping');
  assert.match(t, /(never stop|don't stop|continue.*ask|without asking)/i,
    'autopilot.md must state it never stops to ask after confirmation');
});

// row 16: autopilot.md names cap-pin-exceeded and final-gate-env-failures as decided, not stopped
test('autopilot: playbook names cap-pin-exceeded and final-gate-env-failures as decided', () => {
  const t = pb('autopilot.md');
  assert.match(t, /cap.?pin.?exceed/i,
    'autopilot.md must mention cap-pin-exceeded condition');
  assert.match(t, /final.?gate.*env.?fail|env.?fail.*final.?gate/i,
    'autopilot.md must mention final-gate-env-failures condition');
  assert.match(t, /(decided|decide|continue|never stop)/i,
    'autopilot.md must state these are decided, not stopped');
});

// row 17: tie-break prefers reversible option, then priority order; mandate check before decisions
test('autopilot: playbook prefers reversible option, then priority order; mandate check before decisions', () => {
  const t = pb('autopilot.md');
  assert.match(t, /(revers|reversible|option)/i,
    'autopilot.md must prefer reversible options');
  assert.match(t, /(tie.?break|prefer)/i, 'autopilot.md must name tie-breaking rule');
  assert.match(t, /(priority order|criteria)/i, 'autopilot.md must apply priority order');
  assert.match(t, /(mandate|check).*before/i,
    'autopilot.md must state mandate check precedes each decision');
});

// row 18: pilot decision journals exact format; grill.md Decisions with condition/options/choice/recovery
test('autopilot: playbook journals pilot decisions with exact format and grill.md line format', () => {
  const t = pb('autopilot.md');
  // Check for exact journal format
  assert.match(t, /note escalation condition=/i, 'autopilot.md must mention journal format');
  assert.match(t, /preauth=pilot/i, 'autopilot.md must mention preauth=pilot');
  assert.match(t, /priority=/i, 'autopilot.md must mention priority= field');
  assert.match(t, /reversible=/i, 'autopilot.md must mention reversible= field');
  assert.match(t, /hardfloor=/i, 'autopilot.md must mention hardfloor= field');

  assert.match(t, /grill\.md.*§.*Decisions|Decisions.*grill\.md/i,
    'autopilot.md must write grill.md Decisions section');
  assert.match(t, /(condition|option|choice|recover)/i, 'autopilot.md must record all four elements');
});

// row 19: irreversible choice recovery line written BEFORE the action
test('autopilot: playbook writes irreversible choice recovery line BEFORE the action', () => {
  const t = pb('autopilot.md');
  assert.match(t, /(irreversible|recovery).*before|before.*recovery/i,
    'autopilot.md must state recovery written before irreversible action');
  assert.match(t, /(write|record|journal).*before.*(action|execute|run)/i,
    'autopilot.md must emphasize before-action write order');
});

// row 20: human-written grill answers through file tool, never shell argument
test('autopilot: playbook states grill answers via file tool, never shell argument', () => {
  const t = pb('autopilot.md');
  assert.match(t, /(file tool|write.*file|grill\.md)/i,
    'autopilot.md must mention file tool for grill answers');
  assert.match(t, /(never.*argument|not.*argument|not.*shell)/i,
    'autopilot.md must state answers never passed as shell arguments');
});

// row 21: ship.md digest lists preauth=pilot escalations, hard-floor first, apart from preauth=yes
test('autopilot: ship.md digest lists preauth=pilot escalations', () => {
  const t = pb('ship.md');
  assert.match(t, /preauth=pilot|pilot/, 'ship.md must mention pilot decisions');
  assert.match(t, /(hard.?floor.*first|first.*hard.?floor)/i,
    'ship.md must list hard-floor escalations first');
  assert.match(t, /(apart from|separate from|not.*preauth=yes|unlike preauth=yes)/i,
    'ship.md must distinguish pilot decisions from pre-authorized ones');
});

// row 22: journal with 2 pilot, 1 yes, 1 no / buildReport / pilot = 2, preauthorized = 1
test('autopilot: buildReport counts pilot escalations separately from preauthorized', (t) => {
  const report = projectWithChange(t, [
    { ts: '2026-08-10T02:00:00Z', event: 'escalation', condition: 'verify-budget', preauth: 'pilot' },
    { ts: '2026-08-10T02:15:00Z', event: 'escalation', condition: 'deep-ship', preauth: 'pilot' },
    { ts: '2026-08-10T03:00:00Z', event: 'escalation', condition: 'cap-pin', preauth: 'yes' },
    { ts: '2026-08-10T04:00:00Z', event: 'escalation', condition: 'ambiguity', preauth: 'no' },
  ]);
  const c = change(report);
  assert.ok(c, 'change must exist in report');
  assert.equal(c.pilot, 2, 'pilot count must be 2');
  assert.equal(c.preauthorized, 1, 'preauthorized count must be 1 (pilot separate)');
});

// row 23: renderReport shows pilot×N; observe --json carries pilot; change with no pilot has pilot: 0, no pilot× text
test('autopilot: renderReport shows pilot×N; observe --json carries pilot; change with no pilot has pilot: 0, no pilot× text', (t) => {
  // Test 1: renderReport with pilot decisions
  const report1 = projectWithChange(t, [
    { ts: '2026-08-10T02:00:00Z', event: 'escalation', condition: 'verify-budget', preauth: 'pilot' },
    { ts: '2026-08-10T02:15:00Z', event: 'escalation', condition: 'deep-ship', preauth: 'pilot' },
    { ts: '2026-08-10T03:00:00Z', event: 'escalation', condition: 'cap-pin', preauth: 'yes' },
  ]);
  const rendered1 = renderReport(report1);
  assert.match(rendered1, /pilot×2/, 'renderReport must show pilot×2');
  assert.match(rendered1, /unattended×1/, 'renderReport must show unattended×1 (preauth=yes)');

  // Test 2: observe --json with pilot field
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const changeDir = writeChange(dir, 'json-test', { status: 'verified', body: STANDARD_BODY });
  journalLine(changeDir, { ts: '2026-08-10T02:00:00Z', event: 'escalation', condition: 'verify-budget', preauth: 'pilot' });

  const res = runCli(dir, ['observe', '--json']);
  assert.equal(res.status, 0, `observe --json must succeed, got: ${res.stderr}`);
  const json = JSON.parse(res.stdout);
  const jTestChange = json.changes.find((c) => c.id.endsWith('json-test'));
  assert.ok(jTestChange, 'change must exist in JSON output');
  assert.equal(jTestChange.pilot, 1, 'JSON must carry pilot: 1');

  // Test 3: change with no pilot events
  const report3 = projectWithChange(t, [
    { ts: '2026-08-10T02:00:00Z', event: 'escalation', condition: 'cap-pin', preauth: 'yes' },
  ]);
  const c3 = change(report3);
  assert.equal(c3.pilot, 0, 'change with no pilot events must have pilot: 0');
  const rendered3 = renderReport(report3);
  assert.doesNotMatch(rendered3, /pilot×/,
    'renderReport must not show pilot× when pilot count is 0');
});

// row 24: auto.md contains no "pilot"/"autopilot" and still states the stop rule
test('autopilot: auto.md contains no pilot/autopilot and states stop rule unchanged (regression guard)', () => {
  const t = pb('auto.md');
  assert.doesNotMatch(t, /autopilot|pilot/i,
    'auto.md must not mention autopilot or pilot (unattended behavior unchanged)');
  assert.match(t, /(condition outside|not covered|nobody pre-approv).*stop/i,
    'auto.md must still state "condition outside the confirmed set stops the run"');
});

// row 25: README.md rows for autopilot; docs/design.md ledger row for grill.md
test('autopilot: README.md and payload/playbook/README.md mention /sdlc:autopilot', () => {
  const readmePath = path.join(PKG_ROOT, 'README.md');
  const playbook_readmePath = path.join(PKG_ROOT, 'payload/playbook/README.md');

  // Check main README
  if (fs.existsSync(readmePath)) {
    const mainReadme = fs.readFileSync(readmePath, 'utf8');
    assert.match(mainReadme, /\/sdlc:autopilot/, 'README.md must mention /sdlc:autopilot');
  }

  // Check playbook README
  assert.ok(fs.existsSync(playbook_readmePath), 'payload/playbook/README.md must exist');
  const playbookReadme = fs.readFileSync(playbook_readmePath, 'utf8');
  assert.match(playbookReadme, /\/sdlc:autopilot/, 'payload/playbook/README.md must mention /sdlc:autopilot');
});

test('autopilot: docs/design.md ledger lists grill.md artifact', () => {
  const designPath = path.join(PKG_ROOT, 'docs/design.md');
  assert.ok(fs.existsSync(designPath), 'docs/design.md must exist');
  const design = fs.readFileSync(designPath, 'utf8');
  assert.match(design, /grill\.md/, 'docs/design.md ledger must list grill.md');
});

// row 26: resume with grill.md present does not re-grill but re-asks delegation once
test('autopilot: playbook resume does not re-grill requirement but re-asks delegation items once', () => {
  const t = pb('autopilot.md');
  assert.match(t, /resume/i, 'autopilot.md must address resume behavior');
  assert.match(t, /(grill\.md|not re.?grill|don't re.?grill)/i, 'autopilot.md must not re-grill with existing grill.md');
  assert.match(t, /(delegation|ask)/i, 'autopilot.md must re-ask delegation items');
  assert.match(t, /(one run|this run|authority)/i, 'autopilot.md must note delegation covers one run');
});

// row 27: mandate check before each decision; human-refused condition stops and asks
test('autopilot: playbook mandate check before decisions; refused condition stops', () => {
  const t = pb('autopilot.md');
  assert.match(t, /(mandate|check).*before|before.*(decision|act)/i,
    'autopilot.md must mandate check before each decision');
  assert.match(t, /grill\.md.*§.*Mandate|Mandate.*grill\.md/i,
    'autopilot.md must look up condition in grill.md § Mandate');
  assert.match(t, /(refuse|refuse.*stop|stop.*refuse)/i,
    'autopilot.md must stop when human refuses a condition');
});

// row 28: journal 2 pilot + grill.md 1 line / validate --strict / error naming counts; non-strict warns
test('autopilot: validate --strict cross-checks pilot journal events vs grill.md Decisions lines', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const changeDir = writeChange(dir, 'pilot-count-mismatch', {
    status: 'verified',
    body: STANDARD_BODY,
  });

  // Write contract/tests.md
  fs.mkdirSync(path.join(changeDir, 'contract'), { recursive: true }); fs.writeFileSync(path.join(changeDir, 'contract', 'tests.md'),
    '# Tests\n| # | Given | unit |\n|---|---|---|\n| 1 | x | y |\n');

  // Write grill.md with only 1 Decisions line
  const grillContent = [
    '---',
    'id: pilot-count-mismatch',
    '---',
    '# Grill',
    '',
    '## Delegation',
    'Delegated.',
    '',
    '## Priorities',
    'req > qual',
    '',
    '## Mandate',
    'Feature X',
    '',
    '## Decisions',
    '- verify-budget · options: stop/continue · chose: continue · recover: logs',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(changeDir, 'grill.md'), grillContent);

  // Journal a delegation, then 2 pilot events — only verify-budget is explained
  journalLine(changeDir, { ts: '2026-08-10T01:00:00Z', event: 'delegation' });
  journalLine(changeDir, { ts: '2026-08-10T02:00:00Z', event: 'escalation', condition: 'verify-budget', preauth: 'pilot', priority: 'requirement', reversible: 'yes', hardfloor: 'no' });
  journalLine(changeDir, { ts: '2026-08-10T03:00:00Z', event: 'escalation', condition: 'cap-pin', preauth: 'pilot', priority: 'quality', reversible: 'no', hardfloor: 'no' });

  // Strict validate should error
  const resStrict = runCli(dir, ['validate', 'pilot-count-mismatch', '--strict']);
  assert.equal(resStrict.status, 1, 'validate --strict must fail on pilot count mismatch');
  assert.match(resStrict.stderr + resStrict.stdout, /pilot-count-mismatch/i, 'error must name change');
  assert.match(resStrict.stderr + resStrict.stdout, /cap-pin/, 'error must name the unexplained condition');

  // Non-strict validate should only warn
  const resNonStrict = runCli(dir, ['validate', 'pilot-count-mismatch']);
  assert.equal(resNonStrict.status, 0, 'non-strict validate only warns (row 28)');
  assert.match(resNonStrict.stderr + resNonStrict.stdout, /pilot/i, 'non-strict must still warn about the pilot decision');
});

// row 29: same with 2 lines, and pilot events with no grill.md / validate --strict / first clean, second errors
test('autopilot: validate --strict error when pilot events have no grill.md', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);

  // Test 1: 2 pilot events + 2 grill.md Decisions lines = clean
  const changeDir1 = writeChange(dir, 'pilot-count-match', {
    status: 'verified',
    body: STANDARD_BODY,
  });
  fs.mkdirSync(path.join(changeDir1, 'contract'), { recursive: true }); fs.writeFileSync(path.join(changeDir1, 'contract', 'tests.md'),
    '# Tests\n| # | Given | unit |\n|---|---|---|\n| 1 | x | y |\n');

  const grillContent1 = [
    '---',
    'id: pilot-count-match',
    '---',
    '# Grill',
    '',
    '## Delegation',
    'Delegated.',
    '',
    '## Priorities',
    'req > qual',
    '',
    '## Mandate',
    'Feature X',
    '',
    '## Decisions',
    '- verify-budget · options: stop/continue · chose: continue · recover: logs',
    '- cap-pin · options: raise/trim · chose: trim · recover: git revert',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(changeDir1, 'grill.md'), grillContent1);
  journalLine(changeDir1, { ts: '2026-08-10T01:00:00Z', event: 'delegation' });
  journalLine(changeDir1, { ts: '2026-08-10T02:00:00Z', event: 'escalation', condition: 'verify-budget', preauth: 'pilot', priority: 'requirement', reversible: 'yes', hardfloor: 'no' });
  journalLine(changeDir1, { ts: '2026-08-10T03:00:00Z', event: 'escalation', condition: 'cap-pin', preauth: 'pilot', priority: 'quality', reversible: 'no', hardfloor: 'no' });

  const resClean = runCli(dir, ['validate', 'pilot-count-match', '--strict']);
  assert.equal(resClean.status, 0, 'validate --strict must pass when pilot count matches grill.md lines');

  // Test 2: pilot events but no grill.md
  const changeDir2 = writeChange(dir, 'pilot-no-grill', {
    status: 'verified',
    body: STANDARD_BODY,
  });
  fs.mkdirSync(path.join(changeDir2, 'contract'), { recursive: true }); fs.writeFileSync(path.join(changeDir2, 'contract', 'tests.md'),
    '# Tests\n| # | Given | unit |\n|---|---|---|\n| 1 | x | y |\n');
  // NO grill.md
  journalLine(changeDir2, { ts: '2026-08-10T02:00:00Z', event: 'escalation', condition: 'verify-budget', preauth: 'pilot', priority: 'requirement', reversible: 'yes', hardfloor: 'no' });

  const resNoGrill = runCli(dir, ['validate', 'pilot-no-grill', '--strict']);
  assert.equal(resNoGrill.status, 1, 'validate --strict must error when pilot events exist but no grill.md');
  assert.match(resNoGrill.stderr + resNoGrill.stdout, /pilot-no-grill/i, 'error must name change');
  assert.match(resNoGrill.stderr + resNoGrill.stdout, /pilot|grill/i, 'error must mention pilot/grill mismatch');
});

// row 30: valid grill.md with CRLF line endings / validate runs / 0 errors
test('autopilot: validate accepts grill.md with CRLF line endings', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const changeDir = writeChange(dir, 'grill-crlf', {
    status: 'verified',
    body: STANDARD_BODY,
  });

  // Write contract/tests.md
  fs.mkdirSync(path.join(changeDir, 'contract'), { recursive: true }); fs.writeFileSync(path.join(changeDir, 'contract', 'tests.md'),
    '# Tests\n| # | Given | unit |\n|---|---|---|\n| 1 | x | y |\n');

  // Write grill.md with CRLF line endings
  const grillLines = [
    '---',
    'id: grill-crlf',
    '---',
    '# Grill',
    '',
    '## Delegation',
    'Delegated.',
    '',
    '## Priorities',
    'req > qual > time > cost',
    '',
    '## Mandate',
    'Implement feature.',
    '',
    '## Decisions',
    '(none yet)',
    '',
  ];
  const grillContent = grillLines.join('\r\n'); // CRLF
  fs.writeFileSync(path.join(changeDir, 'grill.md'), grillContent);

  const res = runCli(dir, ['validate', 'grill-crlf']);
  assert.equal(res.status, 0, `validate must accept CRLF grill.md, got stderr: ${res.stderr}`);
});

// row 31: resume open change without grill.md: uses status's stage per auto.md/next.md, never rewrites change.md, grills unsettled items only
test('autopilot: playbook resume open change at status stage, never rewrites change.md, grills unsettled items', () => {
  const t = pb('autopilot.md');
  assert.match(t, /(argument|open change|active change)/i,
    'autopilot.md must address resuming an open/active change');
  assert.match(t, /(status.*stage|next\.md|auto\.md)/i,
    'autopilot.md must consult status for stage (per auto.md/next.md)');
  assert.match(t, /(never rewrite|never re.?write|not rewrite|keeps.*change\.md)/i,
    'autopilot.md must never rewrite existing change.md');
  assert.match(t, /(never re.?run|not re.?run|finished stage)/i,
    'autopilot.md must not re-run a finished stage');
  assert.match(t, /(grill.*unsettled|unsettled.*grill|priorit|escalation|delegation)/i,
    'autopilot.md must grill only unsettled items');
  assert.match(t, /\[NEEDS CLARIFICATION\]/i,
    'autopilot.md must mention open [NEEDS CLARIFICATION] markers');
});

// row 32: fresh start (full grill) happens only when argument matches no open change
test('autopilot: playbook fresh start (full grill) only when argument matches no open change', () => {
  const t = pb('autopilot.md');
  assert.match(t, /(fresh|new grill|full grill)/i,
    'autopilot.md must name the fresh start / full grill concept');
  assert.match(t, /(matches no|no open|only when|never when open)/i,
    'autopilot.md must state fresh start only when no matching open change');
  assert.match(t, /(open change|active change|match.*no)/i,
    'autopilot.md must check for existing open changes before full grill');
});


// ---------- review round 1 (F1–F6): rows 33–39 ----------

function grillFile({ mandate = ['- May decide alone: all'], decisions = [] } = {}) {
  return ['# Grill', '', '## Delegation', '- Delegated by: owner', '', '## Priorities', '1. requirement', '',
    '## Mandate', ...mandate, '', '## Decisions', ...decisions, ''].join('\n');
}

function pilotChange(t, id, { grill, events }) {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  const changeDir = writeChange(dir, id, { status: 'verified', body: STANDARD_BODY });
  fs.mkdirSync(path.join(changeDir, 'contract'), { recursive: true });
  fs.writeFileSync(path.join(changeDir, 'contract', 'tests.md'), '# Tests\n| # | Given | unit |\n|---|---|---|\n| 1 | x | y |\n');
  if (grill !== undefined) fs.writeFileSync(path.join(changeDir, 'grill.md'), grill);
  events.forEach((e, i) => journalLine(changeDir, { ts: `2026-08-10T0${i}:00:00Z`, ...e }));
  const strict = runCli(dir, ['validate', id, '--strict']);
  return { dir, changeDir, strict, out: strict.stderr + strict.stdout };
}
const pilot = (condition, extra = {}) => ({ event: 'escalation', condition, preauth: 'pilot', ...extra });
const bullet = (c) => `- ${c} · options: a/b · chose: a · priority: quality · reversible: yes · hard-floor: no · recover: git revert`;

// row 33
test('autopilot: a pilot condition that is not a kebab token fails strict validation', (t) => {
  for (const bad of ['a b', 'x;y', 'a'.repeat(60)]) {
    const r = pilotChange(t, 'bad-token', { grill: grillFile({ decisions: [bullet('ok')] }),
      events: [{ event: 'delegation' }, pilot(bad)] });
    assert.equal(r.strict.status, 1, `condition ${JSON.stringify(bad)} must fail`);
    assert.match(r.out, /bad-token/);
    assert.match(r.out, /token/i, 'the error must say the condition is not a token');
  }
  const ok = pilotChange(t, 'good-token', { grill: grillFile({ decisions: [bullet('cap-pin-exceeded')] }),
    events: [{ event: 'delegation' }, pilot('cap-pin-exceeded')] });
  assert.equal(ok.strict.status, 0, ok.out);
});

// row 34
test('autopilot: each journaled pilot condition needs its own § Decisions bullet; prose lines do not count', (t) => {
  const r = pilotChange(t, 'unexplained', {
    grill: grillFile({ decisions: [bullet('cap-pin-exceeded'), bullet('cap-pin-exceeded'), 'final-gate was handled somehow'] }),
    events: [{ event: 'delegation' }, pilot('cap-pin-exceeded'), pilot('cap-pin-exceeded'), pilot('final-gate')] });
  assert.equal(r.strict.status, 1);
  assert.match(r.out, /final-gate/, 'the unexplained condition must be named');
  assert.doesNotMatch(r.out, /cap-pin-exceeded/, 'explained conditions must not be reported');
});

// row 35
test('autopilot: a pilot decision on a condition the Mandate refused fails strict validation', (t) => {
  const r = pilotChange(t, 'refused', {
    grill: grillFile({ mandate: ['- May decide alone: verify-rounds', '- Refused (stops the run): ship-approval, data-loss'],
      decisions: [bullet('ship-approval')] }),
    events: [{ event: 'delegation' }, pilot('ship-approval')] });
  assert.equal(r.strict.status, 1);
  assert.match(r.out, /ship-approval/);
  assert.match(r.out, /refused/i);
});

// row 36
test('autopilot: pilot decisions need a delegation confirmed in the same session', (t) => {
  const g = grillFile({ decisions: [bullet('cap-pin')] });
  const other = pilotChange(t, 'deleg-other', { grill: g,
    events: [{ event: 'delegation', session: 'A' }, pilot('cap-pin', { session: 'B' })] });
  assert.equal(other.strict.status, 1, 'a delegation from another session must not cover this run');
  assert.match(other.out, /delegation/i);
  const same = pilotChange(t, 'deleg-same', { grill: g,
    events: [{ event: 'delegation', session: 'A' }, { event: 'delegation', session: 'B' }, pilot('cap-pin', { session: 'B' })] });
  assert.equal(same.strict.status, 0, same.out);
  const none = pilotChange(t, 'deleg-none', { grill: g, events: [pilot('cap-pin')] });
  assert.equal(none.strict.status, 1, 'pilot decisions with no delegation at all must fail');
  assert.match(none.out, /delegation/i);
});

// row 37
test('autopilot: journal.mjs note records the session when the harness provides one', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  writeChange(dir, 'sess', { body: STANDARD_BODY });
  const journal = path.join(dir, 'sdlc/.hooks/journal.mjs');
  const env = { ...process.env, CLAUDE_CODE_SESSION_ID: '', NO_UPDATE_NOTIFIER: '1' };
  spawnSync(process.execPath, [journal, 'set-active', 'sess'], { cwd: dir, env, input: '' });
  spawnSync(process.execPath, [journal, 'note', 'x'], { cwd: dir, env: { ...env, CLAUDE_CODE_SESSION_ID: 's1' }, input: '' });
  spawnSync(process.execPath, [journal, 'note', 'y'], { cwd: dir, env, input: '' });
  const file = [path.join(dir, 'sdlc/.state/journal/sess.ndjson'), path.join(dir, 'sdlc/.state/journal.ndjson')]
    .filter((f) => fs.existsSync(f));
  const lines = file.flatMap((f) => fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l)));
  const x = lines.find((e) => e.event === 'x');
  const y = lines.find((e) => e.event === 'y');
  assert.equal(x?.session, 's1');
  assert.ok(y && !('session' in y), 'no session key without one');
});

// row 38
test('autopilot: § Decisions is outside the grill.md cap; the mandate is inside it', (t) => {
  const many = Array.from({ length: 90 }, (_, i) => bullet(`d-${i}`));
  const long = pilotChange(t, 'long-decisions', { grill: grillFile({ decisions: many }), events: [] });
  assert.doesNotMatch(long.out, /cap/i, 'a long § Decisions must not trip the cap');
  const bigMandate = Array.from({ length: 90 }, (_, i) => `- scope item ${i}`);
  const big = pilotChange(t, 'long-mandate', { grill: grillFile({ mandate: bigMandate }), events: [] });
  assert.equal(big.strict.status, 1);
  assert.match(big.out, /cap/i);
});

// row 39
test('autopilot: every anchor autopilot.md cites still exists in the file it names', () => {
  const t = pb('autopilot.md');
  assert.match(pb('auto.md'), /\|\s*Condition\s*\|\s*Pre-approvable as\s*\|/, 'auto.md escalation table');
  assert.match(pb('auto.md'), /\*\*Gather\.\*\*/, 'auto.md Gather step');
  assert.match(pb('auto.md'), /\*\*Run\.\*\*/, 'auto.md Run step');
  assert.match(pb('next.md'), /^2\./m, 'next.md §2');
  assert.match(pb('groom.md'), /^1\. Grill/m, 'groom.md step 1');
  assert.match(pb('new.md'), /^5\. Ambiguity/m, 'new.md §5');
  const quotes = [...t.matchAll(/overrides[^\n]*?"([^"]{12,})"/g)];
  assert.ok(quotes.length >= 2, 'autopilot.md must quote the auto.md sentences it overrides');
  const auto = pb('auto.md').replace(/\s+/g, ' ');
  for (const q of quotes) {
    assert.ok(auto.includes(q[1].replace(/\s+/g, ' ')), `autopilot.md quotes auto.md verbatim: "${q[1]}"`);
  }
});

// ---------- review round 2 (G1–G4): rows 40–45 ----------

const ESCALATION_TOKENS = ['clarification', 'verify-rounds-exceeded', 'review-blockers', 'ship-approval',
  'final-gate', 'token-budget', 'hardfloor-midrun'];
const FORESEEN_TOKENS = ['cap-pin-exceeded', 'final-gate-env-failures'];

// row 40
test('autopilot: every grill issue that echoes a pilot condition escapes it', (t) => {
  const evil = 'x‮evil';
  const r = pilotChange(t, 'escaped', { grill: grillFile({ decisions: [] }), events: [pilot(evil)] });
  assert.equal(r.strict.status, 1);
  assert.ok(!r.out.includes('‮'), 'no issue line may carry the raw bidi override');
  const lines = r.out.split('\n').filter((l) => l.includes('evil'));
  assert.ok(lines.length >= 3, `token, bullet and delegation issues all name it (got ${lines.length})`);
  for (const l of lines) assert.match(l, /\\u\{202e\}/i, `escaped: ${l}`);
});

// row 41
test('autopilot: journal.mjs note never lets args overwrite event, ts or session', (t) => {
  const dir = makeTempProject(t);
  runCli(dir, ['init', '--tool', 'claude']);
  writeChange(dir, 'forge', { body: STANDARD_BODY });
  const journal = path.join(dir, 'sdlc/.hooks/journal.mjs');
  const env = { ...process.env, CLAUDE_CODE_SESSION_ID: '', NO_UPDATE_NOTIFIER: '1' };
  spawnSync(process.execPath, [journal, 'set-active', 'forge'], { cwd: dir, env, input: '' });
  spawnSync(process.execPath, [journal, 'note', 'x', 'event=delegation', 'ts=2000-01-01T00:00:00Z', 'session=forged', 'k=v'],
    { cwd: dir, env, input: '' });
  const f = path.join(dir, 'sdlc/.state/journal/forge.ndjson');
  const e = fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).find((ev) => ev.k === 'v');
  assert.ok(e, 'the note was written');
  assert.equal(e.event, 'x');
  assert.notEqual(e.ts, '2000-01-01T00:00:00Z');
  assert.ok(!('session' in e), 'a session may only come from the harness');
});

// row 42
test('autopilot: a sessionless pilot event fails when the journal carries sessions; a sessionless journal does not', (t) => {
  const g = grillFile({ decisions: [bullet('cap-pin')] });
  const mixed = pilotChange(t, 'mixed', { grill: g, events: [{ event: 'delegation', session: 'A' }, pilot('cap-pin')] });
  assert.equal(mixed.strict.status, 1);
  assert.match(mixed.out, /delegation|session/i);
  const plain = pilotChange(t, 'plain', { grill: g, events: [{ event: 'delegation' }, pilot('cap-pin')] });
  assert.equal(plain.strict.status, 0, plain.out);
});

// row 43
test('autopilot: Refused is read case-insensitively, and a non-token refused entry warns', (t) => {
  const lower = pilotChange(t, 'lower-refused', {
    grill: grillFile({ mandate: ['- refused (stops the run): ship-approval'], decisions: [bullet('ship-approval')] }),
    events: [{ event: 'delegation' }, pilot('ship-approval')] });
  assert.equal(lower.strict.status, 1);
  assert.match(lower.out, /refused/i);
  const merged = pilotChange(t, 'merged-refused', {
    grill: grillFile({ mandate: ['- Refused: ship-approval data-loss'] }), events: [] });
  assert.match(merged.out, /ship-approval data-loss/);
  assert.match(merged.out, /token/i);
});

// row 44
test('autopilot: the grill template fixes one token per escalation, and autopilot.md reuses them within 60 lines', () => {
  const tpl = fs.readFileSync(path.join(PKG_ROOT, 'payload/templates/grill.md'), 'utf8');
  for (const tok of [...ESCALATION_TOKENS, ...FORESEEN_TOKENS]) assert.match(tpl, new RegExp(`\\b${tok}\\b`), `template names ${tok}`);
  const rows = pb('auto.md').split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*(Condition|---)/.test(l));
  assert.equal(rows.length, ESCALATION_TOKENS.length - 1, 'one token per auto.md escalation row, plus hardfloor-midrun');
  const t = pb('autopilot.md');
  assert.match(t, /hardfloor-midrun/);
  assert.match(t, /(reuse|same) (the )?template'?s? tokens?|tokens? (from|in) the template/i);
  assert.ok(countEffectiveLines(t) <= 60, `autopilot.md is ${countEffectiveLines(t)} effective lines (≤60)`);
});

// row 39 (cont.): the Confirm step and next.md §2 anchors
test('autopilot: row 39 anchors are specific — Confirm step and next.md §2 text', () => {
  assert.match(pb('auto.md'), /\*\*Confirm\.\*\*/, 'auto.md Confirm step');
  assert.match(pb('next.md'), /^2\. Answer for the current change/m, 'next.md §2');
});

// ---------- review round 3 (H1): rows 46–47 ----------

// row 46
test('autopilot: a malformed Refused entry is an error under strict, and still refuses its token', (t) => {
  const r = pilotChange(t, 'cased-refused', {
    grill: grillFile({ mandate: ['- Refused (stops the run): Ship-Approval'], decisions: [bullet('ship-approval')] }),
    events: [{ event: 'delegation' }, pilot('ship-approval')] });
  assert.equal(r.strict.status, 1);
  const lines = r.out.split(/\r?\n/);
  assert.ok(lines.some((l) => l.includes('✖') && l.includes('Ship-Approval') && /token/i.test(l)),
    'the malformed entry is an error line under strict');
  assert.ok(lines.some((l) => l.includes('✖') && l.includes('ship-approval') && /refused/i.test(l)),
    'the decision on it is still refused');
});

// row 47
test('autopilot: refusing hardfloor-midrun refuses every pilot decision flagged hardfloor=yes', (t) => {
  const g = grillFile({ mandate: ['- Refused (stops the run): hardfloor-midrun'], decisions: [bullet('auth-change')] });
  const yes = pilotChange(t, 'hf-yes', { grill: g, events: [{ event: 'delegation' }, pilot('auth-change', { hardfloor: 'yes' })] });
  assert.equal(yes.strict.status, 1);
  assert.match(yes.out, /auth-change/);
  assert.match(yes.out, /hard-?floor/i);
  const no = pilotChange(t, 'hf-no', { grill: g, events: [{ event: 'delegation' }, pilot('auth-change', { hardfloor: 'no' })] });
  assert.equal(no.strict.status, 0, no.out);
});

// ---------- review round 4 (I1): the whole "a value compared verbatim lets a no slip" class ----------

// row 48
test('autopilot: preauth, event and hardfloor are read fail-closed — casing or absence never escapes a refusal', (t) => {
  const g = grillFile({ mandate: ['- Refused (stops the run): hardfloor-midrun'],
    decisions: ['a', 'b', 'c', 'd', 'e'].map((x) => bullet(`hf-${x}`)) });
  const events = [{ event: 'delegation' },
    { event: 'escalation', condition: 'hf-a', preauth: 'Pilot', hardfloor: 'yes' },
    { event: 'Escalation', condition: 'hf-b', preauth: 'pilot', hardfloor: 'yes' },
    pilot('hf-c', { hardfloor: 'YES' }), pilot('hf-d', { hardfloor: 'true' }), pilot('hf-e')];
  const r = pilotChange(t, 'fold', { grill: g, events });
  assert.equal(r.strict.status, 1);
  for (const x of ['a', 'b', 'c', 'd', 'e']) {
    assert.ok(r.out.split(/\r?\n/).some((l) => l.includes(`hf-${x}`) && /hard-?floor/i.test(l)),
      `hf-${x} must be refused as a hard-floor decision`);
  }
  const report = buildReport(path.join(r.dir, 'sdlc'));
  assert.equal(report.changes.find((c) => c.id.endsWith('fold')).pilot, 5, 'observe counts every pilot decision');
});

// row 49
test('autopilot: a declined hard-floor surface must be on the Refused line; hardfloor=approved is not refused', (t) => {
  for (const entry of ['- payments: no', '- payments: declined', '* payments: approved', '- payments']) {
    const declined = pilotChange(t, 'declined-surface', {
      grill: grillFile({ mandate: ['- May decide alone: final-gate', '### Hard floors', entry] }), events: [] });
    assert.equal(declined.strict.status, 1, `${entry} must fail strict`);
    assert.ok(declined.out.split(/\r?\n/).some((l) => l.includes('payments') && /refused|approved/i.test(l)),
      `${entry}: the error names the surface and the allowed form`);
  }
  const mandate = ['- Refused (stops the run): hardfloor-midrun', '### Hard floors', '- payments: approved'];
  const approved = pilotChange(t, 'approved-surface', {
    grill: grillFile({ mandate, decisions: [bullet('payments-change')] }),
    events: [{ event: 'delegation' }, pilot('payments-change', { hardfloor: 'approved', surface: 'payments' })] });
  assert.equal(approved.strict.status, 0, approved.out);
  for (const extra of [{}, { surface: 'auth' }]) {
    const unbacked = pilotChange(t, 'unbacked-approved', {
      grill: grillFile({ mandate, decisions: [bullet('auth-change')] }),
      events: [{ event: 'delegation' }, pilot('auth-change', { hardfloor: 'approved', ...extra })] });
    assert.equal(unbacked.strict.status, 1, `approved with surface ${JSON.stringify(extra.surface)} must be refused`);
    assert.ok(unbacked.out.split(/\r?\n/).some((l) => l.includes('auth-change') && /hard-?floor/i.test(l)));
  }
});

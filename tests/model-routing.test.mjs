import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempProject, runCli, runHook, writeChange, STANDARD_BODY, PKG_ROOT } from './helpers.mjs';
import { buildReport } from '../lib/observe.mjs';
import { parseFrontmatter } from '../lib/frontmatter.mjs';
import { countEffectiveLines, CAPS } from '../lib/caps.mjs';

const pb = (n) => fs.readFileSync(path.join(PKG_ROOT, 'payload/playbook', n), 'utf8');
const STUB_DIR = path.join(PKG_ROOT, 'payload/adapters/claude/commands/sdlc');
const AGENT_DIR = path.join(PKG_ROOT, 'payload/adapters/claude/agents');
const stub = (n) => fs.readFileSync(path.join(STUB_DIR, `${n}.md`), 'utf8');
const agent = (n) => {
  const p = path.join(AGENT_DIR, `${n}.md`);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
};
const modelOf = (text) => parseFrontmatter(text).data.model;

// A rule is stated when one paragraph carries every token of it, not scattered words.
const paragraphWith = (text, ...res) => text.split(/\n\s*\n/).find((p) => res.every((r) => r.test(p)));

// Stage → command model: haiku = cheap, sonnet = balanced, null = session (no override).
const STAGE_TIERS = Object.freeze({
  verify: 'haiku', next: 'haiku', observe: 'haiku', update: 'haiku',
  contract: 'sonnet', build: 'sonnet', review: 'sonnet',
  groom: null, new: null, design: null, init: null, steer: null,
  converge: null, feedback: null, auto: null, autopilot: null, ship: null,
});
const TIER_OF = { haiku: 'cheap', sonnet: 'balanced' };
const tierOf = (stage) => (STAGE_TIERS[stage] ? TIER_OF[STAGE_TIERS[stage]] : 'session');
const stagesWith = (model) => Object.keys(STAGE_TIERS).filter((s) => STAGE_TIERS[s] === model);

function stageTable(text) {
  const section = text.split(/^## Stage routing[^\n]*\n/m)[1];
  if (section === undefined) return null;
  const body = section.split(/^## /m)[0];
  const rows = new Map();
  for (const line of body.split('\n')) {
    const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2 || /^-+$/.test(cells[0]) || /^stage$/i.test(cells[0])) continue;
    rows.set(cells[0].replace(/`/g, '').replace(/^\/sdlc:/, '').toLowerCase(),
      cells[1].replace(/`/g, '').toLowerCase());
  }
  return rows;
}

// row 1
test('model-routing: row 1: verify, next, observe, update declare exactly model: haiku', () => {
  for (const s of stagesWith('haiku')) {
    assert.equal(modelOf(stub(s)), 'haiku', `${s}: must declare model: haiku`);
  }
});

// row 2
test('model-routing: row 2: contract, build, review declare exactly model: sonnet', () => {
  for (const s of stagesWith('sonnet')) {
    assert.equal(modelOf(stub(s)), 'sonnet', `${s}: must declare model: sonnet`);
  }
});

// row 3 (green by design: forces every future stub to pick a tier)
test('model-routing: row 3: every stub is classified in the stage tier table', () => {
  for (const f of fs.readdirSync(STUB_DIR).filter((x) => x.endsWith('.md'))) {
    const s = f.replace(/\.md$/, '');
    assert.ok(s in STAGE_TIERS, `${s}: not classified — a new stage must pick a tier`);
  }
});

// row 4 (green by design)
test('model-routing: row 4: judgment stages carry no model: key', () => {
  for (const s of stagesWith(null)) {
    assert.equal(modelOf(stub(s)), undefined, `${s}: must NOT carry a model: key`);
  }
});

// row 5 (green by design)
test('model-routing: row 5: init --tool kimi puts no model: in sdlc-*/SKILL.md', (t) => {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'kimi']).status, 0);
  const skills = path.join(dir, '.kimi-code/skills');
  const dirs = fs.readdirSync(skills).filter((f) => f.startsWith('sdlc-'));
  assert.ok(dirs.length >= Object.keys(STAGE_TIERS).length - 1, 'kimi skills must be installed');
  for (const d of dirs) {
    const text = fs.readFileSync(path.join(skills, d, 'SKILL.md'), 'utf8');
    assert.doesNotMatch(text, /^model:/m, `${d}: must not carry a model: key`);
  }
});

// row 6 — both halves survive install: an override where set, none where not
test('model-routing: row 6: installed commands keep their model split', (t) => {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'claude']).status, 0);
  const installed = (s) => fs.readFileSync(path.join(dir, '.claude/commands/sdlc', `${s}.md`), 'utf8');
  assert.equal(modelOf(installed('verify')), 'haiku');
  assert.equal(modelOf(installed('build')), 'sonnet');
  for (const s of stagesWith(null)) {
    assert.equal(modelOf(installed(s)), undefined, `installed ${s}: must NOT carry a model: key`);
  }
});

// row 7
test('model-routing: row 7: harness template Stage routing names every stage with its tier', () => {
  const rows = stageTable(fs.readFileSync(path.join(PKG_ROOT, 'payload/templates/harness.md'), 'utf8'));
  assert.ok(rows, 'harness.md must have "## Stage routing"');
  for (const [s, tier] of rows) {
    assert.ok(['cheap', 'balanced', 'deepest', 'session'].includes(tier), `${s}: bad tier ${tier}`);
  }
  for (const s of Object.keys(STAGE_TIERS)) {
    assert.equal(rows.get(s), tierOf(s), `${s}: harness tier must agree with its command model`);
  }
});

// row 8
test('model-routing: row 8: seeded harness.md carries Stage routing within CAPS.harness', (t) => {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'claude']).status, 0);
  const harness = fs.readFileSync(path.join(dir, 'sdlc/harness.md'), 'utf8');
  assert.match(harness, /^## Stage routing/m);
  const n = countEffectiveLines(harness);
  assert.ok(n <= CAPS.harness, `harness.md is ${n} lines, cap is ${CAPS.harness}`);
});

// row 9
test('model-routing: row 9: routing.md holds stage defaults and the harness fallback rule', () => {
  const routing = pb('routing.md');
  const rows = stageTable(routing);
  assert.ok(rows, 'routing.md must carry a "## Stage routing" defaults table');
  for (const s of Object.keys(STAGE_TIERS)) {
    assert.equal(rows.get(s), tierOf(s), `routing.md default for ${s}`);
  }
  assert.ok(paragraphWith(routing, /harness\.md/, /Stage routing/, /fall(s)? back/i,
    /never ask|without asking|not ask/i),
  'one rule: read harness.md § Stage routing, fall back to these defaults, never ask the human to add it');
});

// row 10
test('model-routing: row 10: routing.md maps tiers to Claude Code models, session = no override', () => {
  const routing = pb('routing.md');
  assert.match(routing, /cheap\s*→\s*haiku/i);
  assert.match(routing, /balanced\s*→\s*sonnet/i);
  assert.match(routing, /deepest\s*→\s*opus/i);
  assert.match(routing, /session\s*→[^\n]*(inherit|no override)/i);
});

// row 11
test('model-routing: row 11: routing.md sends every build task to sdlc-builder at its tier', () => {
  assert.ok(paragraphWith(pb('routing.md'), /sdlc-builder/, /\[tier:/, /--auto/, /autopilot/,
    /whatever the (task )?count|regardless of (task )?count|every build task/i),
  'one rule: every build task, whatever the count, goes to sdlc-builder at its [tier:x] in auto/autopilot/--auto');
  assert.ok(paragraphWith(pb('auto.md'), /routing.md/, /Unattended delegation/),
    'auto.md must defer to routing.md § Unattended delegation');
});

// row 12
test('model-routing: row 12: routing.md sends the verify test run to sdlc-runner', () => {
  assert.ok(paragraphWith(pb('routing.md'), /sdlc-runner/, /verify/i, /pass\/fail per (contract )?row/i),
    'verify test run goes to sdlc-runner, returning pass/fail per contract row');
});

// row 13
test('model-routing: row 13: grill, confirmation and escalation decisions stay in the main session', () => {
  assert.ok(paragraphWith(pb('routing.md'), /grill/i, /confirm/i, /escalation/i, /main session/i,
    /never delegat/i), 'they stay in the main session and are never delegated');
});

// row 14
test('model-routing: row 14: no subagents → the unit runs in the main session, journaled mode=solo', () => {
  assert.ok(paragraphWith(pb('routing.md'), /subagents? (are unavailable|cannot run)/i, /main session/i,
    /mode=solo/), 'no subagents: the unit runs in the main session and journals mode=solo');
});

// row 15
test('model-routing: row 15: build.md limits conductor mode to attended runs', () => {
  const build = pb('build.md');
  const conductor = build.split('\n').find((l) => /\*\*Conductor\*\*/.test(l)) ?? '';
  assert.match(conductor, /\battended\b/i, 'conductor mode must be limited to attended runs');
  assert.ok(paragraphWith(build, /unattended|--auto/i, /sdlc-builder/, /auto\.md/),
    'build.md must defer unattended runs to auto.md delegation via sdlc-builder');
});

// row 16
test('model-routing: row 16: verify.md runs an unattended fast gate through sdlc-runner', () => {
  assert.ok(paragraphWith(pb('verify.md'), /sdlc-runner/, /unattended|--auto/i),
    'verify.md: an unattended fast gate runs its tests through sdlc-runner');
});

// row 17
test('model-routing: row 17: sdlc-runner is haiku with Bash and no write tools', () => {
  const text = agent('sdlc-runner');
  assert.ok(text, 'sdlc-runner.md must exist');
  assert.equal(modelOf(text), 'haiku');
  const tools = String(parseFrontmatter(text).data.tools ?? '').split(',').map((x) => x.trim());
  assert.ok(tools.includes('Bash'), 'tools must include Bash');
  for (const w of ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']) {
    assert.ok(!tools.includes(w), `tools must exclude ${w}`);
  }
});

// row 18
test('model-routing: row 18: init installs sdlc-runner and manifests it', (t) => {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'claude']).status, 0);
  assert.ok(fs.existsSync(path.join(dir, '.claude/agents/sdlc-runner.md')));
  const manifest = fs.readFileSync(path.join(dir, 'sdlc/.state/manifest'), 'utf8');
  assert.match(manifest, /\s\.claude\/agents\/sdlc-runner\.md$/m);
});

// row 19
test('model-routing: row 19: sdlc-runner never edits and reports an excerpt', () => {
  const text = agent('sdlc-runner');
  assert.ok(text, 'sdlc-runner.md must exist');
  assert.match(text, /never edit/i);
  assert.match(text, /excerpt/i);
});

// row 20
test('model-routing: row 20: no agent on opus; panel on sonnet/haiku', () => {
  for (const f of fs.readdirSync(AGENT_DIR).filter((x) => x.endsWith('.md'))) {
    assert.notEqual(modelOf(fs.readFileSync(path.join(AGENT_DIR, f), 'utf8')), 'opus', `${f}: opus`);
  }
  assert.equal(modelOf(agent('sdlc-architect')), 'sonnet');
  assert.equal(modelOf(agent('sdlc-security')), 'sonnet');
  assert.equal(modelOf(agent('sdlc-quality')), 'haiku');
  assert.equal(modelOf(agent('sdlc-ops')), 'haiku');
});

// row 21
test('model-routing: row 21: review.md no longer labels the architect deepest', () => {
  const line = pb('review.md').split('\n').find((l) => /sdlc-architect/.test(l)) ?? '';
  assert.ok(line, 'review.md must still name sdlc-architect');
  assert.doesNotMatch(line, /deepest/i);
});

// The paragraph a stage playbook gives to `--auto`.
const autoParagraph = (stage) => paragraphWith(pb(`${stage}.md`), /^`--auto`:/m) ?? '';
const TIERED = stagesWith('haiku').concat(stagesWith('sonnet'))
  .filter((s) => /--auto/.test(parseFrontmatter(stub(s)).data['argument-hint'] ?? ''));

// row 22
test('model-routing: row 22: tiered stages hand --auto off to /sdlc:auto; session stages continue', () => {
  assert.deepEqual([...TIERED].sort(), ['build', 'contract', 'review', 'verify']);
  for (const s of TIERED) {
    const p = autoParagraph(s);
    assert.match(p, /\/sdlc:auto <id>/, `${s}: must hand the rest to /sdlc:auto <id>`);
    assert.doesNotMatch(p, /continue to ship/i, `${s}: must not carry on to ship itself`);
  }
  for (const s of ['new', 'design', 'ship']) {
    assert.match(autoParagraph(s), /continue to ship/i, `${s}: session-tier stage still continues`);
  }
  assert.ok(paragraphWith(pb('auto.md'), /With `--auto` on a stage command/, /`model:`/, /\/sdlc:auto <id>/),
    "auto.md's entry-stage rule must carry the same exception");
});

// row 23
test('model-routing: row 23: the hand-off names auto.md and the cheaper model as its reason', () => {
  for (const s of TIERED) {
    const p = autoParagraph(s);
    assert.match(p, /auto\.md/, `${s}: still names auto.md`);
    assert.match(p, /cheaper model/i, `${s}: names why it stops`);
  }
});

// row 24
test('model-routing: row 24: build and verify rows feed delegation as the per-call model', () => {
  const r = pb('routing.md');
  assert.ok(paragraphWith(r, /`build` row/, /`verify` row/, /sdlc-runner/, /per-call|`model` (parameter|argument)/i),
    'routing.md must say the build and verify rows set the builder default and the runner model per call');
});

// row 25
test('model-routing: row 25: the harness table says which rows feed delegation', () => {
  const h = fs.readFileSync(path.join(PKG_ROOT, 'payload/templates/harness.md'), 'utf8');
  const section = h.split(/^## Stage routing/m)[1]?.split(/^## /m)[0] ?? '';
  assert.match(section, /build[^\n]*verify[^\n]*delegation|delegation[^\n]*build[^\n]*verify/i);
  assert.match(section, /`model:`/);
});

// row 26
test('model-routing: row 26: a hard-floor task never runs below balanced', () => {
  assert.ok(paragraphWith(pb('routing.md'), /hard-floor/i, /never\s+below\s+balanced|at\s+least\s+balanced/i),
    'routing.md must pin hard-floor tasks to balanced or above');
});

// row 27
test('model-routing: row 27: verify reads the runner report as data', () => {
  assert.ok(paragraphWith(pb('verify.md'), /sdlc-runner/, /as data/i, /never (as )?instructions/i),
    'verify.md must treat the runner report, excerpts included, as data');
});

// row 28
test('model-routing: row 28: design.md records the runner Bash gap', () => {
  const d = fs.readFileSync(path.join(PKG_ROOT, 'docs/design.md'), 'utf8');
  assert.ok(paragraphWith(d, /sdlc-runner/, /Bash/, /Edit/), 'design.md must record sdlc-runner Bash as an accepted gap');
});

// rows 29–31: a session's usage includes its subagents
const line = (model, i, o) => JSON.stringify({ message: { model, usage: { input_tokens: i, output_tokens: o } } }) + '\n';
function sessionWith(t, build) {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'claude']).status, 0);
  const tp = path.join(dir, 'sess-1.jsonl');
  fs.writeFileSync(tp, line('claude-sonnet-5', 100, 50));
  const sub = path.join(dir, 'sess-1', 'subagents');
  build?.(sub, dir);
  const res = runHook(dir, 'session-summary.mjs', { stdin: { transcript_path: tp, session_id: 'sess-1' } });
  // No active change: the session event lands in the global journal.
  const jfile = path.join(dir, 'sdlc/.state/journal.ndjson');
  const events = fs.existsSync(jfile)
    ? fs.readFileSync(jfile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  return { res, session: events.filter((e) => e.event === 'session').pop() };
}

// row 29
test('model-routing: row 29: subagent usage is added to the session totals', (t) => {
  const { res, session } = sessionWith(t, (sub) => {
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(sub, 'agent-a.jsonl'), line('claude-haiku-4-5', 40, 10));
  });
  assert.equal(res.status, 0);
  assert.ok(session, 'a session event must be journaled');
  assert.equal(session.totals.input, 140);
  assert.equal(session.totals.output, 60);
  assert.ok(session.models['claude-sonnet-5'] && session.models['claude-haiku-4-5']);
});

// row 30
test('model-routing: row 30: non-file entries in subagents/ are skipped', (t) => {
  const { res, session } = sessionWith(t, (sub, dir) => {
    fs.mkdirSync(path.join(sub, 'agent-b.jsonl'), { recursive: true });
    fs.writeFileSync(path.join(sub, 'agent-a.jsonl'), line('claude-haiku-4-5', 40, 10));
    const outside = path.join(dir, 'elsewhere.jsonl');
    fs.writeFileSync(outside, line('claude-haiku-4-5', 1000, 1000));
    try { fs.symlinkSync(outside, path.join(sub, 'agent-c.jsonl')); } catch { /* no symlink rights: the dir case still runs */ }
  });
  assert.equal(res.status, 0);
  assert.equal(session.totals.input, 140);
  assert.equal(session.totals.output, 60);
});

// row 31
test('model-routing: row 31: no subagents folder → main transcript alone', (t) => {
  const { res, session } = sessionWith(t);
  assert.equal(res.status, 0);
  assert.equal(session.totals.input, 100);
  assert.equal(session.totals.output, 50);
});

// rows 32–33: observe counts each session once, at its latest (running) total
function reportFor(t, sessionEvents) {
  const dir = makeTempProject(t);
  assert.equal(runCli(dir, ['init', '--tool', 'claude']).status, 0);
  writeChange(dir, 'x-cost', { status: 'building', body: STANDARD_BODY });
  const live = path.join(dir, 'sdlc/.state/journal/x-cost.ndjson');
  fs.mkdirSync(path.dirname(live), { recursive: true });
  for (const e of sessionEvents) fs.appendFileSync(live, JSON.stringify({ event: 'session', ...e }) + '\n');
  return buildReport(path.join(dir, 'sdlc')).changes.find((c) => c.id.endsWith('x-cost'));
}
const tot = (input) => ({ input, output: 0, cacheRead: 0, cacheWrite: 0 });

// row 32
test('model-routing: row 32: a session recorded every turn is counted once, at its latest total', (t) => {
  const c = reportFor(t, [
    { session: 'S', totals: tot(100), costUsd: 1 },
    { session: 'S', totals: tot(250), costUsd: 2 },
    { session: 'T', totals: tot(50), costUsd: 0.5 },
    { session: 'S', totals: tot(400), costUsd: 3 },
    { session: null, totals: tot(30) },
  ]);
  assert.equal(c.tokens.input, 480);
  assert.equal(c.sessions, 3);
  assert.equal(c.costUsd, 3.5);
});

// row 33 (green by design: one record per session sums as before)
test('model-routing: row 33: one record per session sums exactly as before', (t) => {
  const c = reportFor(t, [
    { session: 'A', totals: tot(10), costUsd: 1 },
    { session: 'B', totals: tot(20), costUsd: 2 },
  ]);
  assert.equal(c.tokens.input, 30);
  assert.equal(c.sessions, 2);
  assert.equal(c.costUsd, 3);
});

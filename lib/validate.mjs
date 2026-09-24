// Structural validator — the tool-agnostic enforcement floor.
// Used by: CLI (`warnyin-sdlc validate`), CI, and the PostToolUse hook.
// Exit codes: 0 = clean (warnings allowed), 1 = errors found, 2 = usage/setup error.

import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { CAPS, TIERS, STATUSES, countEffectiveLines, capForChange } from './caps.mjs';
import { parseDelta, parseSpec, scenarioDrift, describeDrift } from './delta.mjs';
import { lensErrors } from './lenses.mjs';
import { analyze, listOpenChangeIds, escapeEntry } from './relations.mjs';
import { readChangeJournal, isPilotEscalation, isDelegation, hardFloorLevel, foldValue } from './journal.mjs';

const CLARIFICATION_RE = /\[NEEDS CLARIFICATION/g;
const GRILL_SECTIONS = ['Delegation', 'Priorities', 'Mandate', 'Decisions'];
// Up to 3 leading spaces tolerated (F5) — some editors/templates indent a heading
// under a list without meaning to nest it.
const HEADING_RE = /^ {0,3}##\s+(.+?)\s*$/;
const ANY_HEADING_RE = /^ {0,3}##\s+/;
// A pilot `condition=` token is a coined kebab identifier, never free text (F1):
// it becomes a shell arg (`journal.mjs note escalation condition=<name>`) and is
// echoed into terminals/context, so its shape is fixed at the source.
const KEBAB_TOKEN_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
// `- <condition> · ...` — the leading token is the condition a § Decisions bullet explains.
const DECISION_BULLET_RE = /^- ([a-z0-9][a-z0-9-]{0,47}) · /;
// `- Refused (stops the run): a, b, c` inside § Mandate. Case-insensitive (G4): a human
// or template variant like `- refused:` must still be read as the refusal line it is.
const REFUSED_LINE_RE = /^- Refused[^:]*:\s*(.*)$/i;

export function statusRank(status) {
  const i = STATUSES.indexOf(status);
  return i === -1 ? 0 : i;
}

function issue(level, where, msg) {
  return { level, where, msg };
}

// ---------- change validation ----------

export function validateChange(changeDir, { strict = false, specsDir = null, sdlcRoot = null } = {}) {
  const issues = [];
  const id = path.basename(changeDir);
  const changePath = path.join(changeDir, 'change.md');
  if (!fs.existsSync(changePath)) {
    return [issue('error', id, 'change.md is missing')];
  }
  // Present but unreadable — a directory in its place, a permission bit. Reported as an issue
  // naming the change, never thrown: this runs inside a PostToolUse hook, where an exception
  // is a crash the human sees instead of the problem.
  let text;
  try {
    text = fs.readFileSync(changePath, 'utf8');
  } catch (err) {
    return [issue('error', id, `change.md cannot be read (${err.code ?? err.message})`)];
  }
  const { data } = parseFrontmatter(text);

  if (!data.id) issues.push(issue('error', id, 'frontmatter: missing id'));
  else if (data.id !== id) issues.push(issue('error', id, `frontmatter id "${data.id}" != folder name "${id}"`));
  if (!TIERS.includes(data.tier)) issues.push(issue('error', id, `frontmatter: tier must be one of ${TIERS.join('|')}`));
  if (!STATUSES.includes(data.status)) issues.push(issue('error', id, `frontmatter: status must be one of ${STATUSES.join('|')}`));
  for (const msg of lensErrors(data.lenses)) issues.push(issue('error', id, `frontmatter: ${msg}`));

  const tier = TIERS.includes(data.tier) ? data.tier : 'standard';
  const status = STATUSES.includes(data.status) ? data.status : 'new';

  const lines = countEffectiveLines(text);
  const cap = capForChange(tier);
  if (lines > cap) issues.push(issue('error', id, `change.md is ${lines} effective lines (cap for ${tier}: ${cap})`));

  const markers = (text.match(CLARIFICATION_RE) ?? []).length;
  if (markers > 0) {
    const level = strict || status !== 'new' ? 'error' : 'warn';
    issues.push(issue(level, id, `${markers} unresolved [NEEDS CLARIFICATION] marker(s)`));
  }

  const { deltas, errors: deltaErrors } = parseDelta(text);
  for (const e of deltaErrors) issues.push(issue('error', id, `delta: ${e}`));
  if (tier !== 'vibe' && deltas.length === 0) {
    issues.push(issue('warn', id, 'no ## Delta section — spec-driven changes should state their behavior delta'));
  }

  // MODIFIED/REMOVED must target requirements that exist in living specs.
  if (specsDir) {
    for (const d of deltas) {
      const specPath = path.join(specsDir, d.capability, 'spec.md');
      const spec = fs.existsSync(specPath) ? parseSpec(fs.readFileSync(specPath, 'utf8')) : null;
      const byName = new Map((spec?.requirements ?? []).map((r) => [r.name.toLowerCase(), r]));
      for (const op of d.ops) {
        const target = byName.get(op.name.toLowerCase());
        if ((op.op === 'MODIFIED' || op.op === 'REMOVED') && !target) {
          issues.push(issue(strict ? 'error' : 'warn', id,
            `${op.op} Requirement "${op.name}" not found in specs/${d.capability}/spec.md`));
          continue;
        }
        // MODIFIED is a full replacement: report the scenarios it carries away
        // before ship merges it. Always a warning — dropping a scenario can be
        // the point of the change; doing it silently never is.
        if (op.op === 'MODIFIED' && target) {
          for (const msg of describeDrift(d.capability, op.name, scenarioDrift(target.body, op.body))) {
            issues.push(issue('warn', id, msg));
          }
        }
      }
    }
  }

  // Contract requirements by status/tier.
  const testsPath = path.join(changeDir, 'contract', 'tests.md');
  const evalsPath = path.join(changeDir, 'contract', 'evals.md');
  if (tier !== 'vibe' && statusRank(status) >= statusRank('contracted') && !fs.existsSync(testsPath)) {
    issues.push(issue('error', id, `status "${status}" requires contract/tests.md`));
  }
  if (tier === 'deep' && statusRank(status) >= statusRank('contracted') && !fs.existsSync(evalsPath)) {
    issues.push(issue('error', id, 'deep tier requires contract/evals.md'));
  }
  if (fs.existsSync(testsPath)) {
    const n = countEffectiveLines(fs.readFileSync(testsPath, 'utf8'));
    if (n > CAPS.contractTests) issues.push(issue('error', id, `contract/tests.md is ${n} lines (cap ${CAPS.contractTests})`));
  }
  if (fs.existsSync(evalsPath)) {
    const n = countEffectiveLines(fs.readFileSync(evalsPath, 'utf8'));
    if (n > CAPS.contractEvals) issues.push(issue('error', id, `contract/evals.md is ${n} lines (cap ${CAPS.contractEvals})`));
  }

  // `sdlcRoot` is normally two segments up from a change folder (changes/<id>); accepted
  // as an option so a caller that already resolved it (validateAll) need not re-derive it,
  // and so a future caller with a differently-shaped tree is not forced onto that guess.
  const root = sdlcRoot ?? path.dirname(path.dirname(changeDir));
  issues.push(...validateGrill(changeDir, id, { strict, sdlcRoot: root }));

  return issues;
}

// ---------- grill.md (autopilot mandate) validation ----------

// Marks each body line with whether it sits inside a fenced code block (``` or ~~~).
// A heading that only appears inside a fence must not count as present.
function linesOutsideFences(body) {
  let inFence = false;
  return body.split(/\r?\n/).map((line) => {
    const t = line.trim();
    if (t.startsWith('```') || t.startsWith('~~~')) {
      inFence = !inFence;
      return { line, fenced: true };
    }
    return { line, fenced: inFence };
  });
}

// Required sections are `^## <Name>\s*$` (up to 3 leading spaces) only — a `###`
// subheading or a heading text inside a fence never counts. `sectionStart` locates the
// first heading line of each recognized section, for the range scans below.
function grillHeadings(body) {
  const entries = linesOutsideFences(body);
  const found = new Set();
  const sectionStart = new Map();
  entries.forEach(({ line, fenced }, i) => {
    if (fenced) return;
    const m = line.match(HEADING_RE);
    if (!m) return;
    const name = m[1].trim();
    if (!GRILL_SECTIONS.includes(name)) return;
    found.add(name);
    if (!sectionStart.has(name)) sectionStart.set(name, i);
  });
  return { entries, found, sectionStart };
}

// The index just past a section's body: the next `## ` heading (any name, outside a
// fence) after `start`, or the end of the file.
function sectionEndIndex(entries, start) {
  for (let i = start + 1; i < entries.length; i++) {
    const { line, fenced } = entries[i];
    if (!fenced && ANY_HEADING_RE.test(line)) return i;
  }
  return entries.length;
}

// [start, end) body range of a named section (heading line excluded), or null when the
// section is absent — callers then treat it as having no entries rather than throwing.
function sectionBodyRange(entries, sectionStart, name) {
  const start = sectionStart.get(name);
  if (start === undefined) return null;
  return [start + 1, sectionEndIndex(entries, start)];
}

// Effective lines (F5) with § Decisions bullets removed: a delegate logging one line per
// decision must never deadlock the file against its own cap. Only bullets in the
// journaled `- <token> · ...` shape are exempt — stray prose left in that section (or a
// filler line planted there) still costs budget, same as everywhere else in the file.
function effectiveLinesExcludingDecisions(entries, sectionStart) {
  const range = sectionBodyRange(entries, sectionStart, 'Decisions');
  let count = 0;
  entries.forEach(({ line }, i) => {
    const t = line.trim();
    if (t === '' || (t.startsWith('<!--') && t.endsWith('-->'))) return;
    if (range && i >= range[0] && i < range[1] && DECISION_BULLET_RE.test(t)) return;
    count++;
  });
  return count;
}

// `- <token> · ...` bullets inside a section range — a prose line (no leading `- token ·`)
// never counts, in either direction (F2).
function bulletTokens(entries, range, re) {
  if (!range) return [];
  const [start, end] = range;
  const tokens = [];
  for (let i = start; i < end; i++) {
    const { line, fenced } = entries[i];
    if (fenced) continue;
    const m = line.trim().match(re);
    if (m) tokens.push(m[1]);
  }
  return tokens;
}

// `- Refused (...): a, b, c` lines inside § Mandate — comma-separated kebab tokens.
function refusedTokens(entries, mandateRange) {
  if (!mandateRange) return [];
  const [start, end] = mandateRange;
  const tokens = [];
  for (let i = start; i < end; i++) {
    const { line, fenced } = entries[i];
    if (fenced) continue;
    const m = line.trim().match(REFUSED_LINE_RE);
    if (!m) continue;
    for (const part of m[1].split(',')) {
      const tok = part.trim();
      if (tok) tokens.push(tok);
    }
  }
  return tokens;
}

// Journal reads are best-effort evidence — a malformed/missing stream must never fail
// validation, so any read error is treated as "nothing recorded".
function readJournalEvents(sdlcRoot, id) {
  try {
    return readChangeJournal(sdlcRoot, id);
  } catch {
    return [];
  }
}

function pilotEvents(events) {
  return events.filter(isPilotEscalation);
}

// G3: every issue that echoes a value the journal or grill.md handed us goes through
// this one path — bidi overrides and control characters never reach a terminal raw.
function showEntry(value) {
  return JSON.stringify(escapeEntry(typeof value === 'string' ? value : String(value ?? ''), 60));
}

// F1: a `condition=` that reaches a shell arg must already be a coined kebab token.
function tokenShapeIssues(pilots, id, strict) {
  const issues = [];
  for (const e of pilots) {
    const cond = typeof e.condition === 'string' ? e.condition : '';
    if (KEBAB_TOKEN_RE.test(cond)) continue;
    issues.push(issue(strict ? 'error' : 'warn', id,
      `pilot decision condition ${showEntry(e.condition)} is not a kebab token (^[a-z0-9][a-z0-9-]{0,47}$)`));
  }
  return issues;
}

// F2: each journaled pilot condition must consume one § Decisions bullet with the same
// token — a multiset match, so two pilot events on the same condition need two bullets.
function unexplainedIssues(pilots, decisionTokens, id, strict) {
  const remaining = [...decisionTokens];
  const issues = [];
  for (const e of pilots) {
    const cond = e.condition;
    const at = remaining.indexOf(cond);
    if (at !== -1) { remaining.splice(at, 1); continue; }
    issues.push(issue(strict ? 'error' : 'warn', id,
      `pilot decision ${showEntry(cond)} is journaled but not explained in grill.md § Decisions`));
  }
  return issues;
}

// F2: a condition § Mandate lists as refused must stop the run, never be decided alone.
// H1: matched case-folded, so `Ship-Approval` still refuses `ship-approval`; and refusing
// `hardfloor-midrun` refuses every unapproved hard-floor decision (I1: `hardfloor` read fail-closed —
// anything but `no`/`approved`, casing or absence included, is `yes`), whatever its token.
// J1: `approved` is a claim that the human said yes, so it counts only when the event names a
// `surface=` the human listed as `<surface>: approved` in `### Hard floors`; otherwise it is `yes`.
function refusedIssues(pilots, refused, approvedSurfaces, id, strict) {
  const refusedSet = new Set(refused.map((tok) => tok.toLowerCase()));
  const hardFloorRefused = refusedSet.has('hardfloor-midrun');
  const reported = new Set();
  const issues = [];
  for (const e of pilots) {
    const cond = String(e.condition);
    const byToken = refusedSet.has(cond.toLowerCase());
    const level = hardFloorLevel(e);
    const backed = level === 'approved' && approvedSurfaces.has(foldValue(e.surface));
    const byFloor = hardFloorRefused && (level === 'yes' || (level === 'approved' && !backed));
    if ((!byToken && !byFloor) || reported.has(cond)) continue;
    reported.add(cond);
    const why = byToken ? 'is refused in grill.md § Mandate'
      : 'is a hard-floor decision and grill.md § Mandate refuses hardfloor-midrun';
    issues.push(issue(strict ? 'error' : 'warn', id, `pilot decision ${showEntry(cond)} ${why} but was decided alone`));
  }
  return issues;
}

// G4: a Mandate `- Refused` entry that is not a kebab token names nothing a pilot `condition=`
// is written as — e.g. a missing comma folding two tokens into one phrase. H1: under strict
// (what archive runs) it is an error: it is the human's "no", and must not fail quietly.
function refusedShapeIssues(refused, id, strict) {
  const issues = [];
  for (const tok of refused) {
    if (KEBAB_TOKEN_RE.test(tok)) continue;
    issues.push(issue(strict ? 'error' : 'warn', id,
      `grill.md § Mandate refused entry ${showEntry(tok)} is not a kebab token — write it lowercase with hyphens, one token per comma, or it may not refuse what you meant`));
  }
  return issues;
}

// I1/J1: `### Hard floors` is an allowlist — each entry is exactly `- <surface>: approved`. A
// surface the human declined belongs on the Refused line, the only place a "no" is enforced, so
// anything else here (`: no`, `: declined`, a `*` bullet, a bare name) is an error under strict.
// Returns the approved surfaces too: they are what a `hardfloor=approved surface=…` event must name.
function hardFloorsScan(entries, mandateRange, id, strict) {
  const approved = new Set();
  const issues = [];
  if (!mandateRange) return { approved, issues };
  let inHardFloors = false;
  for (let i = mandateRange[0]; i < mandateRange[1]; i++) {
    const { line, fenced } = entries[i];
    if (fenced) continue;
    const t = line.trim();
    if (/^###\s+/.test(t)) { inHardFloors = /^###\s+hard floors\s*$/i.test(t); continue; }
    if (!inHardFloors || !/^[-*+]\s+/.test(t)) continue;
    const m = t.match(/^-\s+([a-z0-9][a-z0-9-]{0,47})\s*:\s*approved\s*$/i);
    if (m) { approved.add(m[1].toLowerCase()); continue; }
    issues.push(issue(strict ? 'error' : 'warn', id,
      `grill.md § Mandate ### Hard floors entry ${showEntry(t)} is not "- <surface>: approved" — a declined surface belongs on the Refused line as a token, or it is not enforced`));
  }
  return { approved, issues };
}

// F3/G1: "one run only" — a pilot decision needs a `delegation` event earlier in the SAME
// journal order. One with a session needs a delegation carrying that session. One with no
// session needs any earlier delegation at all — UNLESS this journal records sessions on
// some other event, in which case a sessionless pilot event can never be tied to a run and
// is itself the violation (G1: it must not ride on "any earlier delegation" as cover).
function delegationIssues(events, id, strict) {
  const seenSessions = new Set();
  let seenAny = false;
  const hasAnySession = events.some((e) => e && typeof e === 'object' && typeof e.session === 'string' && e.session);
  const issues = [];
  for (const e of events) {
    if (!e || typeof e !== 'object') continue;
    if (isDelegation(e)) {
      seenAny = true;
      if (typeof e.session === 'string' && e.session) seenSessions.add(e.session);
      continue;
    }
    if (!isPilotEscalation(e)) continue;
    const session = typeof e.session === 'string' && e.session ? e.session : null;
    const cond = typeof e.condition === 'string' ? e.condition : '(unknown)';
    if (session) {
      if (seenSessions.has(session)) continue;
      issues.push(issue(strict ? 'error' : 'warn', id,
        `pilot decision ${showEntry(cond)} (session ${showEntry(session)}) has no delegation confirmed in its run`));
      continue;
    }
    if (hasAnySession) {
      issues.push(issue(strict ? 'error' : 'warn', id,
        `pilot decision ${showEntry(cond)} has no session although the run records sessions`));
      continue;
    }
    if (seenAny) continue;
    issues.push(issue(strict ? 'error' : 'warn', id,
      `pilot decision ${showEntry(cond)} has no delegation confirmed in its run`));
  }
  return issues;
}

function validateGrill(changeDir, id, { strict = false, sdlcRoot } = {}) {
  const issues = [];
  const grillPath = path.join(changeDir, 'grill.md');
  const root = sdlcRoot ?? path.dirname(path.dirname(changeDir));

  if (!fs.existsSync(grillPath)) {
    const pilotCount = pilotEvents(readJournalEvents(root, id)).length;
    if (pilotCount > 0) {
      issues.push(issue(strict ? 'error' : 'warn', id,
        `${pilotCount} pilot decision(s) journaled but grill.md is missing`));
    }
    return issues;
  }

  let text;
  try {
    text = fs.readFileSync(grillPath, 'utf8');
  } catch (err) {
    issues.push(issue('error', id, `grill.md cannot be read (${err.code ?? err.message})`));
    return issues;
  }

  const { body } = parseFrontmatter(text);
  const { entries, found, sectionStart } = grillHeadings(body);

  const lines = effectiveLinesExcludingDecisions(entries, sectionStart);
  if (lines > CAPS.grill) issues.push(issue('error', id, `grill.md is ${lines} effective lines (cap ${CAPS.grill})`));

  for (const name of GRILL_SECTIONS) {
    if (!found.has(name)) issues.push(issue('error', id, `grill.md is missing required section "## ${name}"`));
  }

  const events = readJournalEvents(root, id);
  const pilots = pilotEvents(events);
  // Shape of the refused list is checked whenever § Mandate exists, independent of
  // whether this run happens to hold any pilot decisions yet (G4).
  const mandateRange = sectionBodyRange(entries, sectionStart, 'Mandate');
  const refused = refusedTokens(entries, mandateRange);
  issues.push(...refusedShapeIssues(refused, id, strict));
  const hardFloors = hardFloorsScan(entries, mandateRange, id, strict);
  issues.push(...hardFloors.issues);
  if (pilots.length > 0) {
    const decisionTokens = bulletTokens(entries, sectionBodyRange(entries, sectionStart, 'Decisions'), DECISION_BULLET_RE);
    issues.push(...tokenShapeIssues(pilots, id, strict));
    issues.push(...unexplainedIssues(pilots, decisionTokens, id, strict));
    issues.push(...refusedIssues(pilots, refused, hardFloors.approved, id, strict));
    issues.push(...delegationIssues(events, id, strict));
  }

  return issues;
}

// ---------- context / harness validation ----------

export function validateContext(sdlcRoot) {
  const issues = [];
  const constitutionPath = path.join(sdlcRoot, 'context', 'constitution.md');
  let alwaysLines = 0;

  if (fs.existsSync(constitutionPath)) {
    const n = countEffectiveLines(fs.readFileSync(constitutionPath, 'utf8'));
    alwaysLines += n;
    if (n > CAPS.constitution) {
      issues.push(issue('error', 'context', `constitution.md is ${n} lines (cap ${CAPS.constitution})`));
    }
  } else {
    issues.push(issue('warn', 'context', 'constitution.md is missing (run /sdlc:init)'));
  }

  const steeringDir = path.join(sdlcRoot, 'context', 'steering');
  if (fs.existsSync(steeringDir)) {
    for (const f of fs.readdirSync(steeringDir).filter((f) => f.endsWith('.md')).sort()) {
      const raw = fs.readFileSync(path.join(steeringDir, f), 'utf8');
      const { data } = parseFrontmatter(raw);
      const n = countEffectiveLines(raw);
      if (n > CAPS.steeringFile) {
        issues.push(issue('error', `steering/${f}`, `${n} lines (cap ${CAPS.steeringFile})`));
      }
      const mode = data.inclusion ?? 'manual';
      if (!['always', 'paths', 'manual', 'agent'].includes(mode)) {
        issues.push(issue('error', `steering/${f}`, `inclusion "${mode}" must be always|paths|manual|agent`));
      }
      if (mode === 'paths' && !Array.isArray(data.pathMatch)) {
        issues.push(issue('error', `steering/${f}`, 'inclusion: paths requires pathMatch: ["glob", ...]'));
      }
      if (mode === 'always') alwaysLines += n;
    }
  }

  if (alwaysLines > CAPS.alwaysBudget) {
    issues.push(issue('error', 'context',
      `always-loaded budget is ${alwaysLines} lines (cap ${CAPS.alwaysBudget}) — demote steering or distill the constitution`));
  }

  const harnessPath = path.join(sdlcRoot, 'harness.md');
  if (fs.existsSync(harnessPath)) {
    const n = countEffectiveLines(fs.readFileSync(harnessPath, 'utf8'));
    if (n > CAPS.harness) issues.push(issue('error', 'harness', `harness.md is ${n} lines (cap ${CAPS.harness})`));
  }

  const specsDir = path.join(sdlcRoot, 'specs');
  if (fs.existsSync(specsDir)) {
    for (const cap of fs.readdirSync(specsDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const specPath = path.join(specsDir, cap.name, 'spec.md');
      if (!fs.existsSync(specPath)) continue;
      const n = countEffectiveLines(fs.readFileSync(specPath, 'utf8'));
      if (n > CAPS.spec) {
        issues.push(issue('warn', `specs/${cap.name}`, `spec.md is ${n} lines (soft cap ${CAPS.spec}) — consider splitting the capability`));
      }
    }
  }

  return issues;
}

// Delegates so there is one answer to "which folders are open changes". The rule it carries
// is case-insensitive on `archive`, which matters on a filesystem where `ARCHIVE` opens it.
export function listChangeDirs(sdlcRoot) {
  const changesDir = path.join(sdlcRoot, 'changes');
  return listOpenChangeIds(sdlcRoot).map((id) => path.join(changesDir, id));
}

export function validateAll(sdlcRoot, { strict = false, changeId = null } = {}) {
  const specsDir = path.join(sdlcRoot, 'specs');
  const issues = [...validateContext(sdlcRoot)];
  const dirs = changeId
    ? [path.join(sdlcRoot, 'changes', changeId)]
    : listChangeDirs(sdlcRoot);
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      issues.push(issue('error', path.basename(dir), 'change folder not found'));
      continue;
    }
    issues.push(...validateChange(dir, { strict, specsDir, sdlcRoot }));
  }
  // Relations need the sibling set, which only this entry point holds. A cycle or an
  // unreadable change.md belongs to the graph rather than to any one change, so it is
  // reported even when a single change was asked about — that is what makes a ship, which
  // validates one id, see the same verdict as a project-wide run.
  const relations = analyze(sdlcRoot, { rank: false });
  // A change whose neighbour is unreadable can still merge correctly, so on the single-change
  // path (which is the ship path) this is a warning; project-wide it is an error to fix.
  for (const msg of relations.readErrors) issues.push(issue(changeId ? 'warn' : 'error', 'relations', msg));
  for (const msg of relations.graphWide.errors) issues.push(issue('error', 'relations', msg));
  for (const msg of relations.graphWide.warnings) issues.push(issue('warn', 'relations', msg));
  for (const [id, messages] of relations.perChange) {
    if (changeId && id !== changeId) continue;
    for (const msg of messages) issues.push(issue('error', id, `frontmatter: ${msg}`));
  }
  return issues;
}

export function formatIssues(issues) {
  return issues
    .map((i) => `${i.level === 'error' ? '✖' : '⚠'} [${i.where}] ${i.msg}`)
    .join('\n');
}

// Observability aggregation — reads journals + context files, computes the
// numbers /sdlc:observe reports. Pure given an sdlc root; no LLM involved.

import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { analyze, listOpenChangeIds } from './relations.mjs';
import { CAPS, countEffectiveLines } from './caps.mjs';
import { readChangeJournal, readJournalFile, sealedJournalPath, globalJournalPath } from './journal.mjs';

// An open change's telemetry lives out of tree (plus a legacy in-tree stream in
// projects installed before that); a shipped one carries its sealed journal in the
// archived folder. Reading only the folder would report an open change as having done
// nothing, which reads as a quiet change rather than as a broken reader.
//
// `id` means different things on the two branches — a change id when open, the dated
// archive folder name when shipped — so the directory is derived here rather than
// passed in, and the layout rule stays in one place.
function changeEvents(sdlcRoot, id, archived) {
  if (archived) return readJournalFile(sealedJournalPath(path.join(sdlcRoot, 'changes', 'archive', id)));
  return readChangeJournal(sdlcRoot, id);
}

// A round is what the 3-round budget spends: every fast-gate outcome and every final-gate
// failure. Notes from before the gates split carry no gate and an unrecognised gate is
// counted too — an unreadable label must not hide a round. First-pass is the first outcome,
// cleared by any gated failure before the final gate first passes; a pre-split journal keeps
// its old reading, the first outcome alone.
function countVerify(verify, gates, e) {
  const gate = String(e.gate ?? '').trim().toLowerCase();
  // a skipped final gate ran nothing: it neither spends a round nor judges first-pass.
  if (gate === 'final' && e.result === 'skipped') return;
  const pass = e.result === 'pass';
  if (gate !== 'final' || !pass) verify.rounds++;
  if (verify.firstPass === null) verify.firstPass = pass;
  else if (gate && !pass && !gates.finalPassed) verify.firstPass = false;
  if (gate === 'final' && pass) gates.finalPassed = true;
}

function summarizeChange(sdlcRoot, dir, id, archived) {
  const events = changeEvents(sdlcRoot, id, archived);
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let costUsd = 0;
  let costKnown = false;
  let sessions = 0;
  const verify = { rounds: 0, firstPass: null };
  const gates = { finalPassed: false };
  // null = the journal never said; a run that predates provenance must not be
  // read as independently judged.
  let selfJudged = null;
  // escalations the run passed without a human, because one was pre-approved.
  let preauthorized = 0;
  let guards = 0;
  let compacts = 0;

  for (const e of events) {
    if (e.event === 'escalation' && e.preauth === 'yes') preauthorized++;
    if (e.event === 'verify' || e.event === 'review') {
      // the weakest link decides: one self-produced judgment marks the change.
      if (e.mode === 'solo') selfJudged = true;
      else if (e.mode === 'panel' && selfJudged === null) selfJudged = false;
    }
    if (e.event === 'session') {
      sessions++;
      for (const k of Object.keys(tokens)) tokens[k] += e.totals?.[k] ?? 0;
      if (typeof e.costUsd === 'number') { costUsd += e.costUsd; costKnown = true; }
    } else if (e.event === 'verify') {
      countVerify(verify, gates, e);
    } else if (e.event === 'guard') guards++;
    else if (e.event === 'compact') compacts++;
  }

  const first = events[0]?.ts ? Date.parse(events[0].ts) : null;
  const shipEvent = events.find((e) => e.event === 'ship');
  const shippedAt = shipEvent?.ts ? Date.parse(shipEvent.ts) : null;
  const leadTimeMs = first != null && shippedAt != null ? shippedAt - first : null;

  let tier = null;
  let status = null;
  const changePath = path.join(dir, 'change.md');
  if (fs.existsSync(changePath)) {
    const { data } = parseFrontmatter(fs.readFileSync(changePath, 'utf8'));
    tier = data.tier ?? null;
    status = data.status ?? null;
  }

  return {
    id, archived, tier, status, sessions, tokens,
    costUsd: costKnown ? Number(costUsd.toFixed(4)) : null,
    verify, selfJudged, preauthorized, guards, compacts, leadTimeMs, shippedAt,
    lastEventAt: events[events.length - 1]?.ts ? Date.parse(events[events.length - 1].ts) : null,
    digest: archived ? fs.existsSync(path.join(dir, 'digest.md')) : null,
  };
}

export function buildReport(sdlcRoot) {
  const changes = [];

  const changesDir = path.join(sdlcRoot, 'changes');
  if (fs.existsSync(changesDir)) {
    for (const id of listOpenChangeIds(sdlcRoot)) {
      changes.push(summarizeChange(sdlcRoot, path.join(changesDir, id), id, false));
    }
    const archiveDir = path.join(changesDir, 'archive');
    if (fs.existsSync(archiveDir)) {
      for (const d of fs.readdirSync(archiveDir, { withFileTypes: true })) {
        if (!d.isDirectory()) continue;
        changes.push(summarizeChange(sdlcRoot, path.join(archiveDir, d.name), d.name, true));
      }
    }
  }

  // Residency: constitution + always-steering effective lines vs budget.
  let alwaysLines = 0;
  const constitutionPath = path.join(sdlcRoot, 'context', 'constitution.md');
  if (fs.existsSync(constitutionPath)) {
    alwaysLines += countEffectiveLines(fs.readFileSync(constitutionPath, 'utf8'));
  }
  const steering = [];
  const pointerHits = new Map();
  for (const c of changes) {
    for (const e of changeEvents(sdlcRoot, c.id, c.archived)) {
      if (e.event === 'pointer' && e.steering) {
        pointerHits.set(e.steering, (pointerHits.get(e.steering) ?? 0) + 1);
      }
    }
  }
  // Global journal (events with no active change) counts too.
  for (const e of readJournalFile(globalJournalPath(sdlcRoot))) {
    if (e.event === 'pointer' && e.steering) {
      pointerHits.set(e.steering, (pointerHits.get(e.steering) ?? 0) + 1);
    }
  }

  const steeringDir = path.join(sdlcRoot, 'context', 'steering');
  if (fs.existsSync(steeringDir)) {
    for (const f of fs.readdirSync(steeringDir).filter((n) => n.endsWith('.md')).sort()) {
      const raw = fs.readFileSync(path.join(steeringDir, f), 'utf8');
      const { data } = parseFrontmatter(raw);
      const inclusion = data.inclusion ?? 'manual';
      if (inclusion === 'always') alwaysLines += countEffectiveLines(raw);
      steering.push({ file: f, inclusion, pointerHits: pointerHits.get(f) ?? 0 });
    }
  }

  // Flags — plain strings the playbook can surface with suggested fixes.
  const flags = [];
  if (alwaysLines > CAPS.alwaysBudget) {
    flags.push(`residency: always-loaded is ${alwaysLines}/${CAPS.alwaysBudget} lines — distill via /sdlc:steer`);
  }
  const shipped = changes.filter((c) => c.archived);
  for (const s of steering.filter((s) => s.inclusion === 'paths' && s.pointerHits === 0)) {
    if (shipped.length >= 2) {
      flags.push(`steering/${s.file}: zero pointer hits across ${shipped.length} shipped changes — demote or delete`);
    }
  }
  for (const c of changes) {
    if (c.compacts > 0) flags.push(`${c.id}: ${c.compacts} compact event(s) — context overflowed, find the resident artifact`);
    if (c.verify.rounds > 3) flags.push(`${c.id}: ${c.verify.rounds} verify rounds — contract or routing needs attention`);
  }
  for (const c of shipped.filter((c) => c.digest === false)) {
    flags.push(`${c.id}: archived without digest.md — ship playbook step 4 was skipped`);
  }

  // Relations: a change nobody freed on purpose, and a change too many are waiting on.
  const shippedAtById = new Map();
  for (const c of shipped) {
    shippedAtById.set(c.id.replace(/^\d{4}-\d{2}-\d{2}-/, ''), c.shippedAt);
  }
  const lastEventById = new Map(changes.map((c) => [c.id, c.lastEventAt]));
  for (const node of analyze(sdlcRoot, { rank: false }).nodes) {
    if (node.waitedOnBy.length > 1) {
      flags.push(`${node.id}: ${node.waitedOnBy.length} changes are waiting on it — ship it or split it`);
    }
    // A change parked on purpose is not forgotten work; nagging about it teaches the human
    // to ignore the flag that matters.
    if (node.parked || node.declaredBlockedBy.length === 0 || node.blockedBy.length > 0) continue;
    const freedAt = node.declaredBlockedBy
      .map((b) => shippedAtById.get(b) ?? null)
      .reduce((a, b) => (b != null && (a == null || b > a) ? b : a), null);
    const lastEvent = lastEventById.get(node.id) ?? null;
    if (freedAt != null && (lastEvent == null || lastEvent < freedAt)) {
      flags.push(`${node.id}: every change it waited on has shipped — freed but not resumed`);
    }
  }

  const firstPassRuns = changes.filter((c) => c.verify.firstPass !== null);
  const summary = {
    active: changes.filter((c) => !c.archived).length,
    shipped: shipped.length,
    firstPassRate: firstPassRuns.length
      ? Number((firstPassRuns.filter((c) => c.verify.firstPass).length / firstPassRuns.length).toFixed(2))
      : null,
  };

  return {
    summary,
    changes,
    residency: { alwaysLines, budget: CAPS.alwaysBudget },
    steering,
    flags,
  };
}

const fmtK = (n) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n));

export function renderReport(report) {
  const lines = [];
  const { summary, residency } = report;
  lines.push(`changes: ${summary.active} active · ${summary.shipped} shipped`
    + (summary.firstPassRate != null ? ` · first-pass ${(summary.firstPassRate * 100).toFixed(0)}%` : ''));
  lines.push(`residency: ${residency.alwaysLines}/${residency.budget} always-loaded lines`);
  for (const c of report.changes) {
    const t = c.tokens;
    const lead = c.leadTimeMs != null ? ` · lead ${(c.leadTimeMs / 3_600_000).toFixed(1)}h` : '';
    lines.push(`  ${c.archived ? '✓' : '·'} ${c.id} [${c.tier ?? '?'}]`
      + ` ${fmtK(t.input)}in/${fmtK(t.output)}out`
      + (c.costUsd != null ? ` $${c.costUsd}` : '')
      + ` · verify×${c.verify.rounds}${c.selfJudged === true ? ' · self-judged' : ''}`
      + (c.preauthorized > 0 ? ` · unattended×${c.preauthorized}` : '')
      + `${lead}`);
  }
  for (const s of report.steering) {
    lines.push(`  steering/${s.file} [${s.inclusion}] hits:${s.pointerHits}`);
  }
  for (const f of report.flags) lines.push(`  ⚠ ${f}`);
  return lines.join('\n');
}

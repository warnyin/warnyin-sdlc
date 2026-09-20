// Relations between changes — which change waits on which, and which was discovered from
// which. The edge is stored ONLY on the waiting side; the reverse direction is
// derived by scanning the open changes, so there is never a second copy to drift.
//
// Shared by the CLI, the validator and the installed hooks, so `node:*` only, and no
// assumption that the process runs from the repo root.
//
// Everything here treats `sdlc/changes/**/change.md` as untrusted: a relation entry is a
// human-written string that becomes a lookup key and is echoed into a terminal and into a
// model's context, so it is shape-checked before it is used and escaped before it is shown.

import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { isSafeChangeId, readChangeJournal } from './journal.mjs';

export const BLOCKED_BY = 'blocked-by';
export const SPAWNED_FROM = 'spawned-from';
export const PARKED = 'parked';

// Beyond this many changes in one waiting chain, the shape is the problem, not the order.
export const MAX_CHAIN = 3;

// Stricter than `isSafeChangeId`, which permits anything without a separator, a trailing
// dot/space or a reserved device name — an ANSI escape or a bare CR passes it. Both rules
// are applied: this one bounds the alphabet, that one keeps the OS-specific hazards.
const ENTRY_RE = /^[A-Za-z0-9._-]{1,100}$/;

const ARCHIVE_DIR = 'archive';
// `changes/archive/<YYYY-MM-DD>-<id>`. The date prefix is fixed width, so the id is the
// remainder — never a suffix match, which would let `auth` be satisfied by `add-auth`.
const ARCHIVED_RE = /^\d{4}-\d{2}-\d{2}-(.+)$/;

const TIER_RANK = Object.freeze({ deep: 3, standard: 2, vibe: 1 });

// What reaches a terminal and a model's context. Control characters become visible escapes
// and the result is length-capped, so a relation entry cannot repaint the output or bury
// the message it is quoted in.
export function escapeEntry(value, max = 80) {
  const raw = typeof value === 'string' ? value : String(value);
  let out = '';
  for (const ch of raw) {
    const code = ch.codePointAt(0);
    // C0 and DEL repaint the line; Cf (bidi overrides, isolates, zero-width) reorder what it
    // says without changing a byte of it — Trojan-Source in a terminal and in a model's context.
    const hazard = code < 0x20 || code === 0x7f || /[\p{Cf}\u2028\u2029]/u.test(ch);
    out += hazard ? `\\u{${code.toString(16)}}` : ch;
  }
  return out.length > max ? `${out.slice(0, max)}…` : out;
}

// A reason is a reason only if it says something. `parked:` with nothing after it parses as an
// empty LIST, `parked: true` as a boolean, and whitespace is not a sentence — each is a stored
// value that cannot be shown to anyone, so none of them counts as parked.
export function parkReason(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parkValueIsInvalid(value) {
  return value !== undefined && parkReason(value) === null;
}

// The single answer to "which folders are open changes", so the five callers that used to
// each decide for themselves cannot disagree. Case-insensitive on `archive`, because on a
// case-insensitive filesystem `ARCHIVE` opens the archive folder.
export function listOpenChangeIds(sdlcRoot) {
  try {
    return fs.readdirSync(path.join(sdlcRoot, 'changes'), { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.toLowerCase() !== ARCHIVE_DIR)
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

// A folder name is a claim, not a receipt. `changes/archive/` is ordinary repo content, so a
// planted empty directory would otherwise retire a blocker that is still open and let the
// change waiting on it ship. The shipped change itself has to say so.
export function archivedIds(sdlcRoot) {
  const archiveDir = path.join(sdlcRoot, 'changes', ARCHIVE_DIR);
  const ids = new Set();
  try {
    for (const d of fs.readdirSync(archiveDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const m = d.name.match(ARCHIVED_RE);
      if (!m) continue;
      try {
        const { data } = parseFrontmatter(fs.readFileSync(path.join(archiveDir, d.name, 'change.md'), 'utf8'));
        if (data.id === m[1] && data.status === 'shipped') ids.add(m[1]);
      } catch { /* an archive entry that cannot vouch for itself retires nothing */ }
    }
  } catch { /* nothing archived yet */ }
  return ids;
}

// Reads every open change's frontmatter. A change.md that is absent is left to the
// validator's own "change.md is missing"; one that exists but cannot be READ (a directory
// in its place, a permission bit) is a graph-wide error, because no honest answer about
// who is waiting can be given without it.
export function buildGraph(sdlcRoot) {
  const nodes = [];
  const readErrors = [];
  for (const id of listOpenChangeIds(sdlcRoot)) {
    const changePath = path.join(sdlcRoot, 'changes', id, 'change.md');
    if (!fs.existsSync(changePath)) continue;
    let data;
    try {
      data = parseFrontmatter(fs.readFileSync(changePath, 'utf8')).data;
    } catch (err) {
      readErrors.push({ id, msg: err.code ?? err.message });
      continue;
    }
    nodes.push({
      id,
      tier: data.tier ?? null,
      status: data.status ?? null,
      rawBlockedBy: data[BLOCKED_BY],
      rawSpawnedFrom: data[SPAWNED_FROM],
      rawParked: data[PARKED],
    });
  }
  return { nodes, archived: archivedIds(sdlcRoot), readErrors };
}

// Shape and identity checks for one list-valued key. Returns the entries worth resolving
// plus the errors for the ones that are not; an entry is never both.
function checkEntries(node, key, raw) {
  const errors = [];
  if (raw === undefined) return { errors, entries: [] };
  if (!Array.isArray(raw)) {
    return { errors: [`${key} must be a list, got "${escapeEntry(raw)}"`], entries: [] };
  }
  const entries = [];
  const seen = new Set();
  for (const value of raw) {
    const shown = escapeEntry(value);
    if (typeof value !== 'string') {
      errors.push(`${key} entry "${shown}" must be a change id, not a ${typeof value}`);
    } else if (!ENTRY_RE.test(value) || !isSafeChangeId(value)) {
      errors.push(`${key} entry "${shown}" is not a change id — remove it from ${key}`);
    } else if (value.toLowerCase() === ARCHIVE_DIR) {
      errors.push(`${key} entry "${shown}" names the archive folder, not a change — remove it from ${key}`);
    } else if (value === node.id) {
      errors.push(`${key} entry "${shown}" is this change itself — remove it from ${key}`);
    } else if (seen.has(value)) {
      errors.push(`${key} entry "${shown}" is listed twice — remove the repeat`);
    } else {
      seen.add(value);
      entries.push(value);
    }
  }
  return { errors, entries };
}

// Depth-first cycle hunt over one direction's edges. Returns the member ids of every cycle
// found, so a refusal can name the changes that form it rather than just assert one exists.
function findCycles(edges) {
  const state = new Map();
  const stack = [];
  const cycles = [];
  const walk = (id) => {
    const seen = state.get(id);
    if (seen === 'done') return;
    if (seen === 'open') {
      cycles.push(stack.slice(stack.indexOf(id)));
      return;
    }
    state.set(id, 'open');
    stack.push(id);
    for (const next of edges.get(id) ?? []) walk(next);
    stack.pop();
    state.set(id, 'done');
  };
  for (const id of edges.keys()) walk(id);
  return cycles;
}

// Longest waiting chain, in changes. Only called once the direction is known acyclic, so
// the memo cannot recurse forever.
function longestChain(edges) {
  const memo = new Map();
  const depth = (id) => {
    if (memo.has(id)) return memo.get(id);
    memo.set(id, 1);
    let best = 1;
    for (const next of edges.get(id) ?? []) {
      if (edges.has(next)) best = Math.max(best, depth(next) + 1);
    }
    memo.set(id, best);
    return best;
  };
  let longest = 0;
  for (const id of edges.keys()) longest = Math.max(longest, depth(id));
  return longest;
}

// Milliseconds since a change's last recorded event, or null when nothing was ever
// recorded — which is every change in a fresh checkout, since `sdlc/.state/` is gitignored.
function idleMs(sdlcRoot, id, now) {
  try {
    const events = readChangeJournal(sdlcRoot, id);
    const last = events[events.length - 1]?.ts;
    const ts = last ? Date.parse(last) : NaN;
    return Number.isNaN(ts) ? null : now - ts;
  } catch {
    return null;
  }
}

// The whole picture, computed once: per-change issues (owned by the change that declared
// them), graph-wide issues (owned by nobody — a cycle belongs to the shape), the resolved
// nodes, and the order among the ready ones.
export function analyze(sdlcRoot, { now = Date.now(), rank = true } = {}) {
  const graph = buildGraph(sdlcRoot);
  const openIds = new Set(graph.nodes.map((n) => n.id));
  const perChange = new Map();
  const graphWide = { errors: [], warnings: [] };

  const addIssue = (id, msg) => {
    if (!perChange.has(id)) perChange.set(id, []);
    perChange.get(id).push(msg);
  };

  // Kept apart from the rest: project-wide validation must call an unreadable change an error,
  // but one unreadable neighbour must not stop every other change in the project from shipping.
  const readErrors = graph.readErrors.map(
    ({ id, msg }) => `${id}: change.md cannot be read (${escapeEntry(msg)}) — relations involving it are unknown`,
  );

  const parked = new Map();
  for (const node of graph.nodes) {
    if (parkValueIsInvalid(node.rawParked)) {
      addIssue(node.id, `${PARKED} must be a non-empty reason, got "${escapeEntry(node.rawParked)}"`);
    } else {
      const reason = parkReason(node.rawParked);
      if (reason) parked.set(node.id, reason);
    }
  }

  const resolved = [];
  const blockEdges = new Map();
  const spawnEdges = new Map();
  let entryErrors = 0;

  for (const node of graph.nodes) {
    const blocked = checkEntries(node, BLOCKED_BY, node.rawBlockedBy);
    const spawned = checkEntries(node, SPAWNED_FROM, node.rawSpawnedFrom);
    const declared = [];
    // A well-shaped entry stays visible even when it resolves to nothing: hiding it would
    // report a change as ready while its frontmatter still says otherwise.
    for (const entry of blocked.entries) {
      declared.push(entry);
      if (graph.archived.has(entry)) continue;
      if (!openIds.has(entry)) {
        blocked.errors.push(`${BLOCKED_BY} entry "${escapeEntry(entry)}" names no change — remove it from ${BLOCKED_BY}, or restore the change`);
      } else if (parked.has(entry)) {
        blocked.errors.push(`${BLOCKED_BY} entry "${escapeEntry(entry)}" is parked (${escapeEntry(parked.get(entry), 60)}) — unpark it or remove it from ${BLOCKED_BY}`);
      }
    }
    for (const entry of spawned.entries) {
      if (!openIds.has(entry) && !graph.archived.has(entry)) {
        spawned.errors.push(`${SPAWNED_FROM} entry "${escapeEntry(entry)}" names no change — remove it from ${SPAWNED_FROM}`);
      }
    }
    for (const msg of [...blocked.errors, ...spawned.errors]) addIssue(node.id, msg);
    entryErrors += blocked.errors.length + spawned.errors.length;

    blockEdges.set(node.id, declared.filter((e) => openIds.has(e)));
    spawnEdges.set(node.id, spawned.entries.filter((e) => openIds.has(e)));
    resolved.push({
      id: node.id,
      tier: node.tier,
      status: node.status,
      declaredBlockedBy: declared,
      // What is still in the way: an archived blocker is satisfied, an open one is not,
      // and an entry naming nothing stays visible rather than being quietly dropped.
      blockedBy: declared.filter((e) => !graph.archived.has(e)),
      spawnedFrom: spawned.entries,
      parked: parked.get(node.id) ?? null,
      waitedOnBy: [],
    });
  }

  const byId = new Map(resolved.map((n) => [n.id, n]));
  for (const node of resolved) {
    for (const blocker of node.blockedBy) byId.get(blocker)?.waitedOnBy.push(node.id);
  }

  const blockCycles = findCycles(blockEdges);
  const spawnCycles = findCycles(spawnEdges);
  for (const cycle of blockCycles) {
    graphWide.errors.push(`waiting cycle: ${cycle.join(' → ')} → ${cycle[0]} — one of these must stop waiting`);
  }
  for (const cycle of spawnCycles) {
    graphWide.errors.push(`${SPAWNED_FROM} cycle: ${cycle.join(' → ')} → ${cycle[0]} — a change cannot descend from itself`);
  }

  const resolvable = graphWide.errors.length === 0 && readErrors.length === 0 && entryErrors === 0;
  if (resolvable) {
    const chain = longestChain(blockEdges);
    if (chain > MAX_CHAIN) {
      graphWide.warnings.push(`waiting chain is ${chain} changes deep (over ${MAX_CHAIN}) — the scope is splitting faster than it ships`);
    }
  }

  return {
    nodes: resolved,
    byId,
    archived: graph.archived,
    perChange,
    graphWide,
    readErrors,
    resolvable,
    // Ranking costs one journal read per ready change, so callers that only want the issues
    // (the validator) do not pay for an array they throw away.
    order: rank && resolvable ? rankReady(sdlcRoot, resolved, now) : [],
  };
}

// Ready = not parked and waiting on nothing. Ordered by how many changes it frees, then by
// stakes, then by how long it has sat — and finally by id, so a checkout with no recorded
// activity at all still answers the same way twice.
function rankReady(sdlcRoot, nodes, now) {
  return nodes
    .filter((n) => !n.parked && n.blockedBy.length === 0)
    .map((n) => ({ node: n, idle: idleMs(sdlcRoot, n.id, now) }))
    .sort((a, b) => (
      b.node.waitedOnBy.length - a.node.waitedOnBy.length
      || (TIER_RANK[b.node.tier] ?? 0) - (TIER_RANK[a.node.tier] ?? 0)
      || (b.idle ?? -1) - (a.idle ?? -1)
      || a.node.id.localeCompare(b.node.id)
    ))
    .map((entry) => entry.node.id);
}

// Who this ship sets free, and who is still waiting. Computed BEFORE anything is merged —
// after the folder moves there is nothing left to read and nothing that may throw.
export function shipImpact(analysis, changeId) {
  const freed = [];
  const waiting = [];
  // A parked change that stops waiting is not resumable: `set-active` refuses it while parked,
  // so offering the command would hand the human one the tool then rejects.
  const stillParked = [];
  for (const node of analysis.nodes) {
    if (node.id === changeId) continue;
    if (!node.blockedBy.includes(changeId)) continue;
    const remaining = node.blockedBy.filter((b) => b !== changeId);
    const bucket = remaining.length ? waiting : (node.parked ? stillParked : freed);
    bucket.push({ id: node.id, remaining, parked: node.parked });
  }
  const freedIds = new Set(freed.map((f) => f.id));
  // One hop further: a change waiting on something this ship just freed is closer, but not
  // free. Saying so is the difference between counting and announcing an all-clear.
  for (const node of analysis.nodes) {
    if (node.id === changeId || freedIds.has(node.id)) continue;
    if (waiting.some((w) => w.id === node.id)) continue;
    if (node.blockedBy.some((b) => freedIds.has(b))) {
      waiting.push({ id: node.id, remaining: node.blockedBy });
    }
  }
  return { freed, waiting, stillParked };
}

export function renderShipImpact({ freed, waiting, stillParked = [] }) {
  const lines = [];
  for (const f of freed) {
    lines.push(`↳ ${f.id} is free to resume — node sdlc/.hooks/journal.mjs set-active ${f.id}`);
  }
  for (const p of stillParked) {
    lines.push(`↳ ${p.id} is no longer waiting, but parked (${escapeEntry(p.parked, 60)}) — unpark it to pick it up`);
  }
  for (const w of waiting) {
    const parked = w.parked ? ` · parked (${escapeEntry(w.parked, 60)})` : '';
    lines.push(`↳ ${w.id} waits on: ${w.remaining.join(', ')}${parked}`);
  }
  return lines;
}

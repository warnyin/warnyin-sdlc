// Overlap comparison: this change's Delta against what one other git ref holds. Pure — texts in,
// hits out. No git, no fs; the reads live in bin/git-refs.mjs. Everything a ref says is untrusted:
// identity comes from the folder name only, and anything malformed is dropped and counted.
//
// `./delta.mjs` and `node:*` only (copied into projects as sdlc/.hooks/lib/).

import { parseDelta, parseSpec, CAPABILITY_RE } from './delta.mjs';

const ID_RE = /^[A-Za-z0-9._-]{1,100}$/;
const ARCHIVE_PREFIX_RE = /^\d{4}-\d{2}-\d{2}-(.+)$/;
const MAX_NAME = 200;
const MAX_LISTED = 20;
const KIND_ORDER = { spec: 0, archived: 1, open: 2 };

const lc = (s) => s.toLowerCase();
const byCode = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// '<YYYY-MM-DD>-<id>' reads as '<id>'; any other folder name is its own id.
export function archivedId(folder) {
  const m = folder.match(ARCHIVE_PREFIX_RE);
  return m ? m[1] : folder;
}

// capability (lowercased) -> { names: Set<lowercased op names>, ops: [{op,name}] } for a Delta text.
function deltaByCapability(text) {
  const out = new Map();
  for (const d of parseDelta(text).deltas) out.set(lc(d.capability), d);
  return out;
}

// List at most MAX_LISTED names; the ones cut are counted, never silent.
function cut(names, state) {
  const listed = names.slice(0, MAX_LISTED);
  state.ignored += names.length - listed.length;
  return listed;
}

// Keep names that fit (the rest are counted), then cut.
function listNames(names, state) {
  const kept = names.filter((n) => n.length <= MAX_NAME);
  state.ignored += names.length - kept.length;
  return cut(kept, state);
}

/**
 * compareRef(input) -> { hits: [{kind, id, capability, requirements}], ignored }
 *
 * input = {
 *   self:  { id, delta },                       // this change: its id and its change.md text
 *   local: {                                    // this branch
 *     specs:    [{ capability, text }],         // living specs
 *     archived: [folderName],                   // changes/archive/* folder names
 *     open:     [{ id, text }],                 // open changes (id = folder name; may include self)
 *   },
 *   ref: {                                      // the other ref
 *     specs:    [{ capability, text }],         // capability = folder name under sdlc/specs/
 *     archived: [{ folder, text }],             // changes/archive/<folder>/change.md
 *     open:     [{ id, text }],                 // changes/<id>/change.md
 *     ignored:  number,                         // entries the reader already skipped
 *   },
 * }
 * For spec hits `capability` is the key and `requirements` are the ref-spec names missing here (the
 * CLI JSON prints `id: null` for them; bin/git-refs.mjs overlapReport does that mapping); for
 * archived/open they are the requirement names shared with this Delta (the ref's spelling).
 */
export function compareRef({ self, local, ref }) {
  const state = { ignored: ref.ignored ?? 0 };
  const mine = deltaByCapability(self.delta);
  if (mine.size === 0) return { hits: [], ignored: state.ignored };

  const localArchived = new Set(local.archived.map(archivedId));
  const localOpen = new Set(local.open.map((o) => o.id));
  const localSpecs = new Map(local.specs.map((s) => [lc(s.capability), s.text]));
  const hits = [];

  // Requirement names the REF's copy of a change that is open here adds or modifies, per capability:
  // that change is on the ref, so its names in the ref's spec are not an overlap. A change the ref lacks,
  // or whose ref copy names other things, explains nothing; this change's own ref copy counts like any.
  const pending = new Map();
  for (const [id, text] of [...ref.archived.map((a) => [archivedId(a.folder), a.text]), ...ref.open.map((o) => [o.id, o.text])]) {
    if (!localOpen.has(id)) continue;
    for (const [cap, d] of deltaByCapability(text)) {
      if (!pending.has(cap)) pending.set(cap, new Set());
      for (const op of d.ops) if (op.op !== 'REMOVED') pending.get(cap).add(lc(op.name));
    }
  }

  for (const s of ref.specs) {
    if (!CAPABILITY_RE.test(s.capability)) { state.ignored++; continue; }
    const key = lc(s.capability);
    if (!mine.has(key)) continue;
    const have = new Set((localSpecs.has(key) ? parseSpec(localSpecs.get(key)).requirements : []).map((r) => lc(r.name)));
    const skip = pending.get(key) ?? new Set();
    const missing = parseSpec(s.text).requirements.map((r) => r.name).filter((n) => !have.has(lc(n)) && !skip.has(lc(n)));
    if (missing.length === 0) continue;
    hits.push({ kind: 'spec', id: s.capability, capability: s.capability, requirements: listNames(missing, state) });
  }

  const changeHits = (kind, id, text) => {
    if (!ID_RE.test(id)) { state.ignored++; return; }
    if (id === self.id || localArchived.has(id) || localOpen.has(id)) return;
    for (const d of parseDelta(text).deltas) {
      if (!CAPABILITY_RE.test(d.capability)) { state.ignored++; continue; }
      const theirs = mine.get(lc(d.capability));
      if (!theirs) continue;
      const shared = new Set(theirs.ops.map((o) => lc(o.name)));
      // Every name the ref shows is checked, shared or not: an oversize one is counted, never silent.
      const fit = d.ops.map((o) => o.name).filter((n) => n.length <= MAX_NAME);
      state.ignored += d.ops.length - fit.length;
      hits.push({ kind, id, capability: d.capability, requirements: cut(fit.filter((n) => shared.has(lc(n))), state) });
    }
  };
  for (const a of ref.archived) changeHits('archived', archivedId(a.folder), a.text);
  for (const o of ref.open) changeHits('open', o.id, o.text);

  hits.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || byCode(a.id, b.id) || byCode(a.capability, b.capability));
  return { hits, ignored: state.ignored };
}

// ---------- decision lines ----------

// True when change.md has a bullet in `## Assumptions`, outside code fences, whose whitespace-split
// tokens hold `overlap:`, the ref exactly and the hit's id (its capability for a spec hit) exactly.
// The fence rule matches lib/fences.mjs (kept inline: this module may import only ./delta.mjs).
export function hasOverlapDecision(changeText, ref, hit) {
  const want = hit.kind === 'spec' ? hit.capability : hit.id;
  let fence = null;
  let inAssumptions = false;
  for (const line of (changeText ?? '').split(/\r?\n/)) {
    const t = line.trim();
    if (fence !== null) {
      if (t.length >= fence.length && t === fence[0].repeat(t.length)) fence = null;
      continue;
    }
    const open = t.match(/^(`{3,}|~{3,})/);
    if (open) { fence = open[1]; continue; }
    if (/^ {0,3}##\s+/.test(line)) { inAssumptions = /^ {0,3}##\s+Assumptions\s*$/.test(line); continue; }
    if (!inAssumptions || !/^\s*[-*+]\s/.test(line)) continue;
    const tokens = t.split(/\s+/);
    if (tokens.includes('overlap:') && tokens.includes(ref) && tokens.includes(want)) return true;
  }
  return false;
}

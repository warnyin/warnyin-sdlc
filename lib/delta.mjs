// Delta-spec grammar (parser keys are frozen English regardless of any
// UI language):
//
//   ## Delta: <capability>
//   ### ADDED Requirement: <name>
//   The system SHALL <behavior>.
//   #### Scenario: <name>
//   - WHEN <condition>
//   - THEN <outcome>
//   ### MODIFIED Requirement: <existing name>   ← full replacement body
//   ### REMOVED Requirement: <existing name>
//
// Requirement heading text is the identity key (OpenSpec convention).
// `mergeDelta` applies ops mechanically to a living spec; a missing key on
// MODIFIED/REMOVED is a hard error — never merge silently. MODIFIED replaces
// the whole body, so it can also drop a scenario the spec still carries: that
// is legal (removing a promise is sometimes the point) but never silent —
// `scenarioDrift` reports it and callers surface it as a warning.

const DELTA_HEAD = /^## Delta:\s*(.+?)\s*$/;
const OP_HEAD = /^### (ADDED|MODIFIED|REMOVED) Requirement:\s*(.+?)\s*$/;
const BAD_OP_HEAD = /^### (\w+) Requirement:/;
const SPEC_REQ_HEAD = /^### Requirement:\s*(.+?)\s*$/;
const SCENARIO_HEAD = /^#### Scenario:\s*(.+?)\s*$/;
const ANY_HEAD = /^#{1,6}\s/;

export function parseDelta(changeText) {
  const lines = (changeText ?? '').split(/\r?\n/);
  const deltas = [];
  const errors = [];
  let current = null;   // { capability, ops }
  let currentOp = null; // { op, name, bodyLines }

  const closeOp = () => {
    if (!currentOp) return;
    const body = currentOp.bodyLines.join('\n').trim();
    if (currentOp.op !== 'REMOVED' && body === '') {
      errors.push(`${currentOp.op} Requirement "${currentOp.name}" has an empty body`);
    }
    current.ops.push({ op: currentOp.op, name: currentOp.name, body });
    currentOp = null;
  };

  for (const line of lines) {
    const deltaMatch = line.match(DELTA_HEAD);
    if (deltaMatch) {
      closeOp();
      // Repeated `## Delta: <cap>` blocks merge into one entry — otherwise the
      // last block would silently overwrite the first at ship time.
      const existing = deltas.find((d) => d.capability.toLowerCase() === deltaMatch[1].toLowerCase());
      current = existing ?? { capability: deltaMatch[1], ops: [] };
      if (!existing) deltas.push(current);
      continue;
    }
    if (/^## /.test(line) && !deltaMatch) {
      closeOp();
      current = null; // left the delta section
      continue;
    }
    if (!current) continue;

    const opMatch = line.match(OP_HEAD);
    if (opMatch) {
      closeOp();
      currentOp = { op: opMatch[1], name: opMatch[2], bodyLines: [] };
      continue;
    }
    const badOp = line.match(BAD_OP_HEAD);
    if (badOp && !opMatch) {
      errors.push(`Unknown delta operation "${badOp[1]}" (use ADDED, MODIFIED, or REMOVED)`);
      continue;
    }
    if (currentOp) currentOp.bodyLines.push(line);
  }
  closeOp();

  for (const d of deltas) {
    const seen = new Set();
    for (const op of d.ops) {
      const key = op.name.toLowerCase();
      if (seen.has(key)) errors.push(`Duplicate requirement "${op.name}" in Delta: ${d.capability}`);
      seen.add(key);
    }
    if (d.ops.length === 0) errors.push(`Delta: ${d.capability} declares no requirement operations`);
  }

  return { deltas, errors };
}

export function parseSpec(specText) {
  const lines = (specText ?? '').split(/\r?\n/);
  const requirements = [];
  const preamble = [];
  let current = null;

  for (const line of lines) {
    const reqMatch = line.match(SPEC_REQ_HEAD);
    if (reqMatch) {
      current = { name: reqMatch[1], bodyLines: [] };
      requirements.push(current);
      continue;
    }
    if (current) current.bodyLines.push(line);
    else preamble.push(line);
  }

  return {
    preamble: preamble.join('\n').replace(/\n+$/, ''),
    requirements: requirements.map((r) => ({
      name: r.name,
      body: r.bodyLines.join('\n').trim(),
    })),
  };
}

export function renderSpec({ preamble, requirements }) {
  const parts = [preamble.replace(/\n+$/, '')];
  for (const r of requirements) {
    parts.push(`\n### Requirement: ${r.name}\n${r.body}`);
  }
  return parts.join('\n').replace(/\n+$/, '\n');
}

export function newSpecPreamble(capability) {
  return [
    `# Spec: ${capability}`,
    '',
    '## Purpose',
    '<!-- one or two lines; commands grep this header first (progressive disclosure) -->',
    '',
    '## Requirements',
  ].join('\n');
}

// ---------- scenario drift (what a MODIFIED body silently drops) ----------

// A clause is one WHEN/THEN line; compare on normalized text so indentation,
// bullet marker and trailing whitespace never read as a behavior change.
function normalizeClause(line) {
  const stripped = line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').trim();
  if (stripped === '' || /^<!--.*-->$/.test(stripped)) return null;
  return stripped.replace(/\s+/g, ' ');
}

export function parseScenarios(body) {
  const scenarios = [];
  let current = null;
  for (const line of (body ?? '').split(/\r?\n/)) {
    const head = line.match(SCENARIO_HEAD);
    if (head) {
      current = { name: head[1], clauses: [] };
      scenarios.push(current);
      continue;
    }
    if (ANY_HEAD.test(line)) { current = null; continue; }
    if (!current) continue;
    const clause = normalizeClause(line);
    if (clause) current.clauses.push(clause);
  }
  return scenarios;
}

// Two shapes of loss, both invisible in the merged output:
//   dropped  — the scenario name is gone from the replacement body
//   weakened — the name survives but clauses the spec stated have no counterpart
export function scenarioDrift(oldBody, newBody) {
  const after = new Map(parseScenarios(newBody).map((s) => [s.name.toLowerCase(), s]));
  const dropped = [];
  const weakened = [];
  for (const before of parseScenarios(oldBody)) {
    const next = after.get(before.name.toLowerCase());
    if (!next) { dropped.push(before.name); continue; }
    const kept = new Set(next.clauses.map((c) => c.toLowerCase()));
    const lost = before.clauses.filter((c) => !kept.has(c.toLowerCase()));
    if (lost.length) weakened.push({ name: before.name, lost });
  }
  return { dropped, weakened };
}

// One wording, used by both the archiver and the validator.
export function describeDrift(capability, requirement, drift) {
  const where = `specs/${capability}/spec.md`;
  const messages = [];
  for (const name of drift.dropped) {
    messages.push(`MODIFIED Requirement "${requirement}" drops scenario "${name}" that ${where} still carries`);
  }
  for (const { name, lost } of drift.weakened) {
    const shown = lost.slice(0, 2).map((c) => `"${c}"`).join(', ');
    const rest = lost.length > 2 ? `, +${lost.length - 2} more` : '';
    messages.push(`MODIFIED Requirement "${requirement}" rewrites scenario "${name}": ${lost.length} clause(s) in ${where} have no counterpart in the new body (${shown}${rest})`);
  }
  return messages;
}

// Apply one capability's ops to a living spec (or null to create it).
// Returns { ok, content, errors, warnings }.
export function mergeDelta(specText, ops, capability) {
  const errors = [];
  const warnings = [];
  const spec = specText == null
    ? { preamble: newSpecPreamble(capability), requirements: [] }
    : parseSpec(specText);

  const byName = new Map(spec.requirements.map((r) => [r.name.toLowerCase(), r]));

  for (const { op, name, body } of ops) {
    const key = name.toLowerCase();
    const existing = byName.get(key);
    if (op === 'ADDED') {
      if (existing) { errors.push(`ADDED Requirement "${name}" already exists in spec "${capability}"`); continue; }
      const req = { name, body };
      spec.requirements.push(req);
      byName.set(key, req);
    } else if (op === 'MODIFIED') {
      if (!existing) { errors.push(`MODIFIED Requirement "${name}" not found in spec "${capability}"`); continue; }
      warnings.push(...describeDrift(capability, name, scenarioDrift(existing.body, body)));
      existing.body = body;
    } else if (op === 'REMOVED') {
      if (!existing) { errors.push(`REMOVED Requirement "${name}" not found in spec "${capability}"`); continue; }
      spec.requirements = spec.requirements.filter((r) => r.name.toLowerCase() !== key);
      byName.delete(key);
    }
  }

  if (errors.length) return { ok: false, content: null, errors, warnings };
  return { ok: true, content: renderSpec(spec), errors: [], warnings };
}

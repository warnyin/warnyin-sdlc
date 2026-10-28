// Canonical line-cap table — the single source of truth for artifact
// residency budgets. Templates quote these numbers in HTML comments and
// tests/caps-sync.test.mjs asserts both stay identical.
//
// Rationale (Day-1 economics): every resident line is paid for in every
// turn. Caps make "learning = distilling" structural, not disciplinary.

import { parseFrontmatter } from './frontmatter.mjs';

export const CAPS = Object.freeze({
  constitution: 30,     // sdlc/context/constitution.md — always loaded
  steeringFile: 40,     // each sdlc/context/steering/*.md
  alwaysBudget: 60,     // constitution + all `inclusion: always` steering, combined
  harness: 60,          // sdlc/harness.md
  spec: 150,            // sdlc/specs/<capability>/spec.md (soft — split capability beyond)
  change: Object.freeze({ vibe: 40, standard: 100, deep: 150 }),
  contractTests: 60,    // changes/<id>/contract/tests.md
  contractEvals: 40,    // changes/<id>/contract/evals.md
  grill: 80,             // changes/<id>/grill.md — autopilot mandate + decisions
  lensCatalog: 70,      // payload/playbook/lenses.md — read by /sdlc:new on every change
  runbook: 60,          // changes/<id>/runbook.md — required once a change records the deploy lens
  // Payload authoring budgets — enforced by tests only (no template quotes them, nothing at
  // runtime reads them). Pinned just above the count so the next addition is a decision somebody
  // makes on purpose: a raise edits only this file, with its approval noted beside the value.
  playbook: Object.freeze({
    new: 50,            // 38 → 42 → 43 (question options, approved 2026-09-15) → 46 (verify-or-mark, 2026-09-19) → 50 (overlap step, approved 2026-10-27)
    rulesCard: 40,      // embedded in every non-Claude tool's rules file; no raise recorded
    auto: 75,           // already 2–3x its sibling playbooks; no raise recorded
    autopilot: 60,      // no raise recorded
  }),
  commandStub: 15,      // non-blank body lines of a Claude command stub (thin-adapter rule)
});

export const TIERS = Object.freeze(['vibe', 'standard', 'deep']);

export const STATUSES = Object.freeze([
  'new', 'contracted', 'building', 'verified', 'shipped',
]);

// Effective lines = body lines after frontmatter, excluding blanks and
// single-line HTML comments. Caps meter prose the model must carry, not
// machine metadata or annotation comments.
export function countEffectiveLines(text) {
  const { body } = parseFrontmatter(text ?? '');
  return body
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (t === '') return false;
      if (t.startsWith('<!--') && t.endsWith('-->')) return false;
      return true;
    })
    .length;
}

// A tier outside TIERS reads as standard, the rule validate states. `CAPS.change[tier]` alone would
// hand `tier: toString` a prototype function for a cap.
export function effectiveTier(tier) {
  return TIERS.includes(tier) ? tier : 'standard';
}

export function capForChange(tier) {
  return CAPS.change[effectiveTier(tier)];
}

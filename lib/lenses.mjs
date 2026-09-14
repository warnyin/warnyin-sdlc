// Canonical lens list — the single source of truth for which expert lenses a change may
// record. `payload/playbook/lenses.md` describes each one under `## Lens: <name>`, and
// tests/lenses.test.mjs fails the build if the two drift.
//
// A change records lenses in frontmatter as `<lens>@builtin`, `<lens>@project:<skill>` or
// `<lens>@user:<skill>`; the skill name uses the inventory's own name rule, so whatever
// `warnyin-sdlc skills` lists is exactly what a change can record.

// Names are only ever added: removing or renaming one turns open changes that recorded it
// into validation errors, so that needs a migration, not an edit here.
//
// SKILL_NAME_RE is owned here (not by the inventory) so the validator, which hooks load on
// every write, does not pull in filesystem scanning. `.` and `..` are refused so a recorded
// name can never be a path hop.
export const SKILL_NAME_RE = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,64}$/;

export const LENSES = Object.freeze(['ux-ui', 'api', 'data']);

const ENTRY_RE = /^([^@\s]+)@(builtin|project:(.*)|user:(.*))$/;

// Returns error strings, each naming the offending entry. An absent or empty list is valid:
// no lens means no stage loads one.
export function lensErrors(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [`lenses must be a list, got "${value}"`];
  const errors = [];
  const seen = new Set();
  for (const raw of value) {
    const entry = String(raw);
    const m = entry.match(ENTRY_RE);
    if (!m) {
      errors.push(`lens entry "${entry}" must be <lens>@builtin, <lens>@project:<skill> or <lens>@user:<skill>`);
      continue;
    }
    const [, lens, , projectSkill, userSkill] = m;
    const skill = projectSkill ?? userSkill;
    if (!LENSES.includes(lens)) {
      errors.push(`lens entry "${entry}" names unknown lens "${lens}" (catalog: ${LENSES.join('|')})`);
    } else if (seen.has(lens)) {
      errors.push(`lens "${lens}" is recorded more than once — keep one source per lens`);
    }
    if (skill !== undefined && !SKILL_NAME_RE.test(skill)) {
      errors.push(`lens entry "${entry}" has an invalid skill name (allowed: ${SKILL_NAME_RE.source})`);
    }
    seen.add(lens);
  }
  return errors;
}

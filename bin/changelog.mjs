// What a version brings in, read from the CHANGELOG.md inside the package that was invoked —
// `npx` has already downloaded it, so this costs no request and no dependency.
//
// CLI-only presentation, like detect/ui/multiselect: it must NOT move into `lib/`, which is
// copied into user projects where the installed hooks import it without a node_modules/.
import { parseVersion, compareVersions } from '../lib/version.mjs';

export const NO_CHANGELOG = 'no changelog ships with this package — nothing to show.';

// The preview is read by an agent, so it lands in a session's context. A project several
// releases behind would otherwise paste the whole file there; docs/design.md's ledger row is
// what this bound makes true. Older entries are counted, not silently dropped.
export const MAX_ENTRIES = 3;

// Where the rest can actually be read. The CHANGELOG.md this module reads sits inside the npx
// cache, so pointing a person at "CHANGELOG.md" sends them to a file they cannot find.
export const FULL_CHANGELOG_URL = 'https://github.com/warnyin/warnyin-sdlc/blob/main/CHANGELOG.md';

// `## X.Y.Z` starts an entry and runs until the next `## ` heading. A heading that is not a
// plain version (`## Unreleased`) still ends the entry before it, but is never itself an entry:
// it would have no place in a version-ordered slice.
export function parseChangelog(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const entries = [];
  let current = null;
  for (const line of lines) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      if (current) entries.push(current);
      // Anchored end, not `\b`: `0.10.0-beta` has a word boundary after `0.10.0`, so a
      // pre-release would otherwise be filed under its release version and printed as if it
      // were the release itself.
      const version = /^(\d+\.\d+\.\d+)\s*(?:\(|$)/.exec(heading[1])?.[1];
      current = parseVersion(version) ? { version, lines: [line] } : null;
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) entries.push(current);
  return entries;
}

// `since` undefined means "we do not know where this project stands" — then the only honest
// answer is the invoked version's own entry, not a guess at a range.
export function sliceChangelog(text, { since, upTo } = {}) {
  if (text === null || text === undefined || String(text).trim() === '') return NO_CHANGELOG;
  const entries = parseChangelog(text);
  const ceiling = parseVersion(upTo) ? upTo : null;

  if (!parseVersion(since)) {
    const own = ceiling && entries.find((e) => compareVersions(e.version, ceiling) === 0);
    return own ? own.lines.join('\n').trim() : NO_CHANGELOG;
  }
  if (ceiling && compareVersions(since, ceiling) >= 0) {
    return `already at ${ceiling} or newer — this project is not behind.`;
  }

  const above = entries
    .filter((e) => compareVersions(e.version, since) > 0)
    .filter((e) => !ceiling || compareVersions(e.version, ceiling) <= 0)
    // Newest first, by parsed version — a changelog whose sections drifted out of order
    // must not decide what a person is told they are about to install.
    .sort((a, b) => compareVersions(b.version, a.version));

  if (!above.length) return `nothing published above ${since}.`;

  const shown = above.slice(0, MAX_ENTRIES);
  const out = shown.map((e) => e.lines.join('\n').trim());
  const omitted = above.length - shown.length;
  if (omitted) out.push(`(${omitted} older entries not shown — the rest: ${FULL_CHANGELOG_URL})`);
  // A `since` the changelog never names: say so rather than let the list imply completeness.
  if (!entries.some((e) => compareVersions(e.version, since) === 0)) {
    out.push(`(no entry for ${since} in this changelog — what is shown is above it.)`);
  }
  return out.join('\n\n');
}

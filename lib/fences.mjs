// Which lines of a markdown body sit inside a fenced code block.
//
// `node:*` only: copied into user projects as `sdlc/.hooks/lib/`.

// Marks each body line with whether it sits inside a fenced code block. A fence opens on
// three or more backticks or tildes (an info string may follow) and closes only on a line of
// the same character, at least as long, with nothing else on it (CommonMark) — so a ~~~ line
// quoted inside a ``` block never closes it. A heading inside a fence must not count.
const FENCE_OPEN_RE = /^(`{3,}|~{3,})/;
export function linesOutsideFences(body) {
  let open = null;
  return body.split(/\r?\n/).map((line) => {
    const t = line.trim();
    if (open === null) {
      const m = t.match(FENCE_OPEN_RE);
      if (!m) return { line, fenced: false };
      open = m[1];
      return { line, fenced: true };
    }
    if (t.length >= open.length && t === open[0].repeat(t.length)) open = null;
    return { line, fenced: true };
  });
}

// A level-2 heading (`## `, up to 3 leading spaces). Only an unfenced one opens or ends a section.
export const SECTION_HEADING_RE = /^ {0,3}##\s+/;

// The index just past a section's body: the next unfenced `## ` heading after `start` in the
// output of `linesOutsideFences`, or the end of the body. One rule for every section reader.
export function sectionEndIndex(entries, start) {
  for (let i = start + 1; i < entries.length; i++) {
    const { line, fenced } = entries[i];
    if (!fenced && SECTION_HEADING_RE.test(line)) return i;
  }
  return entries.length;
}

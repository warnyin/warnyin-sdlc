// How far along a change is, as one figure: ticked tasks and an overall percent.
//
// The weights are the stage a change is in, with the build stage spread over its tasks. Verify
// and review happen while status is still `building`, so all tasks ticked reads 75%, not done.
// Verify appends fix tasks there too, so the figure can fall — that is the remaining work.
//
// `node:*` only: copied into user projects as `sdlc/.hooks/lib/`.

import { parseFrontmatter } from './frontmatter.mjs';
import { linesOutsideFences, SECTION_HEADING_RE } from './fences.mjs';

const STAGE_PERCENT = Object.freeze({ new: 10, contracted: 25, verified: 90, shipped: 100 });
const TASKS_HEADING_RE = /^ {0,3}##\s+Tasks\b/;
const CHECKBOX_RE = /^\s*[-*]\s+\[([ xX])\]/;

// Ticked and total checkboxes under every unfenced `## Tasks…` heading, summed.
function countTasks(body) {
  let done = 0;
  let total = 0;
  let inTasks = false;
  for (const { line, fenced } of linesOutsideFences(body)) {
    if (!fenced && SECTION_HEADING_RE.test(line)) {
      inTasks = TASKS_HEADING_RE.test(line);
      continue;
    }
    if (!inTasks || fenced) continue;
    const m = CHECKBOX_RE.exec(line);
    if (!m) continue;
    total += 1;
    if (m[1] !== ' ') done += 1;
  }
  return { done, total };
}

// { done, total, percent } for a change.md's text; percent is null for a status outside the five.
export function progressOf(text) {
  const { data, body } = parseFrontmatter(text ?? '');
  const { done, total } = countTasks(body);
  let percent = null;
  if (data.status === 'building') percent = Math.round(25 + (total ? (50 * done) / total : 0));
  else if (Object.hasOwn(STAGE_PERCENT, data.status)) percent = STAGE_PERCENT[data.status];
  return { done, total, percent };
}

// The status-line suffix: ` · tasks d/t · p%`, ` · p%` with no tasks, '' with no figure.
export function progressSuffix({ done, total, percent }) {
  if (percent === null) return '';
  return total ? ` · tasks ${done}/${total} · ${percent}%` : ` · ${percent}%`;
}

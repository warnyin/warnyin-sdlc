// Which agent tools a project already uses, and where each adapter lands.
// CLI-only: this must NOT move into lib/, which is copied verbatim into every
// installed project as sdlc/.hooks/lib/.

import fs from 'node:fs';
import path from 'node:path';

// The one user-visible path per tool — detection and the post-install summary
// both name the same file, so nobody has to guess what `init` touched.
export const ADAPTER_PATHS = Object.freeze({
  claude: '.claude/',
  cursor: '.cursor/rules/sdlc.mdc',
  windsurf: '.windsurf/rules/sdlc.md',
  copilot: '.github/copilot-instructions.md',
  cline: '.clinerules',
  gemini: 'GEMINI.md',
  'agents-md': 'AGENTS.md',
});

export const TOOL_NAMES = Object.freeze({
  claude: 'Claude Code',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
  copilot: 'GitHub Copilot',
  cline: 'Cline',
  gemini: 'Gemini CLI',
  'agents-md': 'AGENTS.md',
});

// A tool counts as present when the project already carries its home directory
// or instruction file. Detection only pre-selects a checkbox — it never
// installs anything on its own.
const MARKERS = Object.freeze({
  claude: ['.claude'],
  cursor: ['.cursor'],
  windsurf: ['.windsurf'],
  copilot: ['.github/copilot-instructions.md'],
  cline: ['.clinerules'],
  gemini: ['GEMINI.md', '.gemini'],
  'agents-md': ['AGENTS.md'],
});

export function detectTools(projectRoot) {
  return Object.entries(MARKERS)
    .filter(([, markers]) => markers.some((m) => fs.existsSync(path.join(projectRoot, ...m.split('/')))))
    .map(([tool]) => tool);
}

export function toolName(tool) {
  return TOOL_NAMES[tool] ?? tool;
}

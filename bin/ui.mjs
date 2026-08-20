// Terminal presentation for the installer: colour gating, glyphs, and the
// post-install summary. Zero dependencies — the ANSI we need is a dozen codes.
// CLI-only: this must NOT move into lib/, which is copied verbatim into every
// installed project as sdlc/.hooks/lib/.

import { ADAPTER_PATHS, toolName } from './detect.mjs';

export const ESC = String.fromCharCode(27);

const CODES = Object.freeze({
  bold: '1', dim: '2', red: '31', green: '32', yellow: '33', cyan: '36',
});

// NO_COLOR wins over FORCE_COLOR: opting out of colour is never overridden by
// something else in the environment (no-color.org).
export function colorEnabled(env = process.env, isTty = Boolean(process.stdout.isTTY)) {
  if (env.NO_COLOR) return false;
  if (env.FORCE_COLOR) return true;
  return Boolean(isTty);
}

export function createStyle(enabled) {
  const wrap = (code) => (text) => (enabled ? `${ESC}[${code}m${text}${ESC}[0m` : String(text));
  return Object.freeze(Object.fromEntries(Object.entries(CODES).map(([name, code]) => [name, wrap(code)])));
}

export const SYMBOLS = Object.freeze({
  unicode: Object.freeze({ on: '◉', off: '◯', pointer: '❯', tick: '✔', warn: '!' }),
  ascii: Object.freeze({ on: '[x]', off: '[ ]', pointer: '>', tick: 'v', warn: '!' }),
});

// Legacy Windows consoles render box-drawing glyphs as mojibake; Windows
// Terminal and every unix terminal set one of these.
export function symbolsFor(env = process.env, platform = process.platform) {
  if (platform !== 'win32') return SYMBOLS.unicode;
  return env.WT_SESSION || env.TERM_PROGRAM || env.ConEmuANSI ? SYMBOLS.unicode : SYMBOLS.ascii;
}

// ---------- post-install summary ----------

const under = (keys, prefix) => keys.filter((k) => k.startsWith(prefix));

export function summarizeInstall(manifestKeys, tools) {
  const keys = [...manifestKeys];
  const hookFiles = under(keys, 'sdlc/.hooks/').filter((k) => !k.startsWith('sdlc/.hooks/lib/'));
  const templates = under(keys, 'sdlc/.playbook/templates/');
  const playbook = under(keys, 'sdlc/.playbook/').filter((k) => !k.startsWith('sdlc/.playbook/templates/'));
  const skillDirs = new Set(under(keys, '.claude/skills/').map((k) => k.split('/')[2]));

  return Object.freeze({
    commands: under(keys, '.claude/commands/').length,
    skills: skillDirs.size,
    agents: under(keys, '.claude/agents/').length,
    hooks: hookFiles.length,
    playbook: playbook.length,
    templates: templates.length,
    adapters: tools.map((tool) => ({ tool, path: ADAPTER_PATHS[tool] })),
  });
}

// What to actually type next, per tool. Tools without a slash-command surface
// get a prose instruction instead of a command that would not resolve.
export function startHints(tools) {
  const hints = [];
  if (tools.includes('claude')) {
    hints.push('Run /sdlc:init in Claude Code — it writes your constitution and harness');
    hints.push('Then start your first change: /sdlc:new "your idea"');
  }
  const rest = tools.filter((t) => t !== 'claude');
  for (const tool of rest) {
    hints.push(`Open ${toolName(tool)} and ask it to follow sdlc/.playbook/init.md, then sdlc/.playbook/new.md`);
  }
  if (!hints.length) {
    hints.push('Read sdlc/.playbook/README.md — the stage doctrine is tool-independent');
    hints.push('Add an agent tool any time: npx @warnyin/sdlc update --tool claude');
  }
  return hints;
}

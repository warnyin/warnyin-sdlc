import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CLI = path.join(PKG_ROOT, 'bin', 'cli.mjs');

// Windows: a detached hook child (update check) may still hold the dir for a moment, and
// Node 24's native rmSync does not retry EPERM — so retry here, for up to ~5 s.
async function removeTempDir(dir) {
  for (let attempt = 0; ; attempt++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch (err) {
      if (attempt >= 50 || !['EPERM', 'EBUSY', 'ENOTEMPTY'].includes(err.code)) throw err;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

export function makeTempProject(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsdlc-'));
  t.after(() => removeTempDir(dir));
  return dir;
}

export function runCli(cwd, args, { env = {} } = {}) {
  const mergedEnv = { ...process.env, NO_COLOR: '1', CLAUDE_CODE_SESSION_ID: undefined, ...env };
  const res = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: mergedEnv,
  });
  if (res.error) throw res.error;
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

export function writeChange(projectRoot, id, { tier = 'standard', status = 'new', body }) {
  const dir = path.join(projectRoot, 'sdlc', 'changes', id);
  fs.mkdirSync(dir, { recursive: true });
  const text = `---\nid: ${id}\ntier: ${tier}\nstatus: ${status}\n---\n${body}`;
  fs.writeFileSync(path.join(dir, 'change.md'), text);
  return dir;
}

export const STANDARD_BODY = `# Change: Add two-factor auth

## Why
Password-only login is weak.

## Delta: auth

### ADDED Requirement: Two-factor login
The system SHALL require a second factor during login.

#### Scenario: OTP required
- WHEN a user with 2FA enabled submits valid credentials
- THEN the system prompts for a one-time code

## Tasks
- [ ] T1 implement OTP flow [tier:balanced]
`;

// A minimal Claude Code transcript with real usage, so `session-summary` records a
// `session` event instead of returning early on a missing `transcript_path`.
export function writeTranscript(projectRoot) {
  const p = path.join(projectRoot, 'transcript.jsonl');
  fs.writeFileSync(p, JSON.stringify({
    message: { model: 'claude-sonnet-5', usage: { input_tokens: 100, output_tokens: 50 } },
  }) + '\n');
  return p;
}

export function runHook(projectRoot, script, { args = [], stdin = null, env = {} } = {}) {
  // NO_UPDATE_NOTIFIER: SessionStart would otherwise ask the real npm registry (update-notice).
  const mergedEnv = { ...process.env, CLAUDE_CODE_SESSION_ID: undefined, NO_UPDATE_NOTIFIER: '1', ...env };
  const res = spawnSync(process.execPath, [path.join(projectRoot, 'sdlc/.hooks', script), ...args], {
    cwd: projectRoot,
    input: stdin == null ? '' : JSON.stringify(stdin),
    encoding: 'utf8',
    env: mergedEnv,
  });
  if (res.error) throw res.error;
  return res;
}

export function writeContractTests(changeDir) {
  const dir = path.join(changeDir, 'contract');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'tests.md'), [
    '# Test contract — x',
    '| # | Given / When / Then | Kind | Maps to requirement |',
    '|---|---|---|---|',
    '| 1 | given/when/then | unit | Two-factor login |',
    '',
    '## Out of scope',
    '- none',
    '',
  ].join('\n'));
}

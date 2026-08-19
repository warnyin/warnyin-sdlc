import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CLI = path.join(PKG_ROOT, 'bin', 'cli.mjs');

export function makeTempProject(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsdlc-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

export function runCli(cwd, args) {
  const res = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
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

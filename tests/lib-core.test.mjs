import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter } from '../lib/frontmatter.mjs';
import { CAPS, countEffectiveLines, capForChange } from '../lib/caps.mjs';
import { parseDelta, parseSpec, mergeDelta, renderSpec } from '../lib/delta.mjs';

// ---------- frontmatter ----------

test('parseFrontmatter: strings, numbers, booleans, inline arrays', () => {
  const { data, body } = parseFrontmatter([
    '---',
    'id: add-2fa',
    'tier: standard',
    'auto: true',
    'retries: 3',
    'pathMatch: ["src/db/**", "migrations/**"]',
    '---',
    'body line',
  ].join('\n'));
  assert.equal(data.id, 'add-2fa');
  assert.equal(data.tier, 'standard');
  assert.equal(data.auto, true);
  assert.equal(data.retries, 3);
  assert.deepEqual(data.pathMatch, ['src/db/**', 'migrations/**']);
  assert.equal(body, 'body line');
});

test('parseFrontmatter: dash lists and no-frontmatter passthrough', () => {
  const { data } = parseFrontmatter('---\ntools:\n  - a\n  - b\n---\n');
  assert.deepEqual(data.tools, ['a', 'b']);

  const plain = parseFrontmatter('# Just markdown\n');
  assert.deepEqual(plain.data, {});
  assert.equal(plain.body, '# Just markdown\n');
});

test('parseFrontmatter: unterminated fence is treated as body', () => {
  const { data, body } = parseFrontmatter('---\nid: x\nno closing fence');
  assert.deepEqual(data, {});
  assert.match(body, /no closing fence/);
});

// ---------- caps ----------

test('countEffectiveLines: skips frontmatter, blanks, and single-line comments', () => {
  const text = [
    '---',
    'id: x',
    '---',
    '# Title',
    '',
    '<!-- cap:40 · annotation -->',
    'real line',
    '  ',
    'another real line',
  ].join('\n');
  assert.equal(countEffectiveLines(text), 3); // Title + 2 real lines
});

test('capForChange falls back to standard for unknown tier', () => {
  assert.equal(capForChange('vibe'), CAPS.change.vibe);
  assert.equal(capForChange('nonsense'), CAPS.change.standard);
});

// ---------- delta ----------

const CHANGE_MD = `---
id: add-2fa
tier: standard
status: new
---
# Change: Add 2FA

## Why
Logins are password-only.

## Delta: auth
### ADDED Requirement: Two-factor login
The system SHALL require a second factor during login.
#### Scenario: OTP required
- WHEN a user with 2FA enabled submits valid credentials
- THEN the system prompts for a one-time code

### MODIFIED Requirement: Session length
The system SHALL expire sessions after 12 hours.

## Tasks
- [ ] T1 implement
`;

test('parseDelta: extracts capabilities, ops, bodies; stops at next ##', () => {
  const { deltas, errors } = parseDelta(CHANGE_MD);
  assert.deepEqual(errors, []);
  assert.equal(deltas.length, 1);
  assert.equal(deltas[0].capability, 'auth');
  assert.equal(deltas[0].ops.length, 2);
  assert.equal(deltas[0].ops[0].op, 'ADDED');
  assert.equal(deltas[0].ops[0].name, 'Two-factor login');
  assert.match(deltas[0].ops[0].body, /OTP required/);
  assert.equal(deltas[0].ops[1].op, 'MODIFIED');
  assert.ok(!deltas[0].ops[1].body.includes('T1 implement'));
});

test('parseDelta: flags unknown ops, empty bodies, duplicates', () => {
  const bad = [
    '## Delta: auth',
    '### CHANGED Requirement: Foo',
    '### ADDED Requirement: Bar',
    '### ADDED Requirement: Bar',
    'body',
  ].join('\n');
  const { errors } = parseDelta(bad);
  assert.ok(errors.some((e) => e.includes('CHANGED')));
  assert.ok(errors.some((e) => e.includes('empty body')));
  assert.ok(errors.some((e) => e.includes('Duplicate requirement')));
});

const SPEC_MD = `# Spec: auth

## Purpose
Authentication behavior.

## Requirements

### Requirement: Session length
The system SHALL expire sessions after 24 hours.

### Requirement: Password rules
The system SHALL enforce 12+ character passwords.
`;

test('parseSpec/renderSpec round-trip preserves requirements', () => {
  const spec = parseSpec(SPEC_MD);
  assert.equal(spec.requirements.length, 2);
  const rendered = renderSpec(spec);
  const reparsed = parseSpec(rendered);
  assert.deepEqual(
    reparsed.requirements.map((r) => r.name),
    ['Session length', 'Password rules'],
  );
});

test('mergeDelta: ADDED appends, MODIFIED replaces, REMOVED deletes', () => {
  const ops = [
    { op: 'ADDED', name: 'Two-factor login', body: 'The system SHALL require a second factor.' },
    { op: 'MODIFIED', name: 'Session length', body: 'The system SHALL expire sessions after 12 hours.' },
    { op: 'REMOVED', name: 'Password rules', body: '' },
  ];
  const { ok, content, errors } = mergeDelta(SPEC_MD, ops, 'auth');
  assert.deepEqual(errors, []);
  assert.ok(ok);
  assert.match(content, /Two-factor login/);
  assert.match(content, /12 hours/);
  assert.ok(!content.includes('24 hours'));
  assert.ok(!content.includes('Password rules'));
});

test('mergeDelta: missing key on MODIFIED/REMOVED is a hard error; nothing merges', () => {
  const ops = [{ op: 'MODIFIED', name: 'Ghost', body: 'x' }];
  const { ok, content, errors } = mergeDelta(SPEC_MD, ops, 'auth');
  assert.equal(ok, false);
  assert.equal(content, null);
  assert.ok(errors[0].includes('Ghost'));
});

test('mergeDelta: ADDED duplicate is an error', () => {
  const ops = [{ op: 'ADDED', name: 'Session length', body: 'dup' }];
  const { ok, errors } = mergeDelta(SPEC_MD, ops, 'auth');
  assert.equal(ok, false);
  assert.ok(errors[0].includes('already exists'));
});

test('mergeDelta: null spec creates a new spec file with preamble', () => {
  const ops = [{ op: 'ADDED', name: 'First rule', body: 'The system SHALL work.' }];
  const { ok, content } = mergeDelta(null, ops, 'billing');
  assert.ok(ok);
  assert.match(content, /^# Spec: billing/);
  assert.match(content, /## Purpose/);
  assert.match(content, /### Requirement: First rule/);
});

test('mergeDelta: idempotence — re-applying ADDED to merged spec fails cleanly', () => {
  const ops = [{ op: 'ADDED', name: 'X', body: 'The system SHALL x.' }];
  const first = mergeDelta(null, ops, 'cap');
  const second = mergeDelta(first.content, ops, 'cap');
  assert.equal(second.ok, false);
});

#!/usr/bin/env node
// Release gate for .github/workflows/release.yml. Fails unless the pushed tag is a plain
// vX.Y.Z naming package.json's version and npm is new enough for trusted publishing.
// The tag comes from GITHUB_REF_NAME and the npm version from stdin, never from argv or a
// `${{ }}` expression: ref names may carry `$(`, `;` or backticks. Lives outside
// `scripts/` so it never ships in the npm tarball.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const MIN_NPM = '11.5.1';
const PLAIN_VERSION = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;

function fail(message) {
  console.error(`release-check: ${message}`);
  process.exit(1);
}

const parts = (version) => version.match(PLAIN_VERSION)?.slice(1).map(Number) ?? null;

function atLeast(actual, minimum) {
  for (let i = 0; i < 3; i++) {
    if (actual[i] !== minimum[i]) return actual[i] > minimum[i];
  }
  return true;
}

function readPackageVersion() {
  const pkgPath = path.join(process.cwd(), 'package.json');
  let raw;
  try {
    raw = fs.readFileSync(pkgPath, 'utf8');
  } catch {
    fail(`cannot read package.json in ${process.cwd()}`);
  }
  try {
    return JSON.parse(raw).version;
  } catch {
    fail('package.json is not valid JSON');
  }
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

const tag = process.env.GITHUB_REF_NAME;
if (!tag) fail('GITHUB_REF_NAME is empty — run this from a tag push');
if (!tag.startsWith('v') || !parts(tag.slice(1))) {
  fail(`tag ${JSON.stringify(tag)} is not a plain vX.Y.Z release tag`);
}

const version = readPackageVersion();
if (typeof version !== 'string' || version !== tag.slice(1)) {
  fail(`tag ${tag} names ${tag.slice(1)} but package.json version is ${JSON.stringify(version)}`);
}

const npmVersion = readStdin().trim();
const npmParts = parts(npmVersion);
if (!npmParts || !atLeast(npmParts, parts(MIN_NPM))) {
  fail(`npm ${JSON.stringify(npmVersion)} on stdin; trusted publishing needs npm >= ${MIN_NPM}`);
}

console.log(`release-check: tag ${tag} matches package.json ${version}; npm ${npmVersion}`);

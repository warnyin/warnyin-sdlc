// Contract rows for notice-stale-branch: sdlc/changes/notice-stale-branch/contract/tests.md.
// Doctrine rows (3, 4) pin payload/playbook/update.md step 3 as exact sentences. Git rows (5–8)
// take the playbook's own backticked commands out of its text and run them in scratch repos, so
// the rows prove the doctrine's git commands do what the sentences say. No fetch, no network.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeTempProject } from './helpers.mjs';
import { oneLine, nonEmpty, payload, step } from './rule-pins.mjs';

// The ten verbatim sentences. Backticks are literal in the playbook.
const B1 = 'Before offering, check whether this branch is behind its base: a branch behind its base is not an outdated project.';
const B2 = 'The version this checkout has is read from its own `sdlc/.hooks/version.json`, and the default branch may already carry a newer one.';
const B3 = 'Name the default branch with `git symbolic-ref --short refs/remotes/origin/HEAD` and this one with `git branch --show-current`; an empty name, as on a detached HEAD, counts as a failed command.';
const B4 = 'If the two names are equal once the `origin/` prefix is dropped, this checkout is the default branch: offer the choice as below.';
const B5 = 'Otherwise read `git show <default ref>:sdlc/.hooks/version.json`, with the ref exactly as the first command printed it.';
const B6 = 'Compare the two `version` values as plain `X.Y.Z` numbers, part by part; a value that is not a plain `X.Y.Z` counts as a failed command.';
const B7 = "If the default branch's version is newer than this checkout's, do not offer the choice: tell the person that the default branch, as of the last fetch, already carries that version, and recommend syncing this branch with it before any update — an update here would duplicate that branch's update commit and conflict with it.";
const B8 = 'That note is said once per session, like the choice it replaces.';
const B9 = 'If any of these commands fails, or the default branch is not newer, offer the choice as below.';
const B10 = 'Run no `git fetch`: the comparison uses only what is already local.';
const SENTENCES = [B1, B2, B3, B4, B5, B6, B7, B8, B9, B10];

const playbookText = () => payload('playbook', 'update.md');
const stepThree = () => oneLine(nonEmpty(step(playbookText(), 3), 'playbook step 3'));

// The sentence must be present in the playbook's own text; the slice is what the playbook says.
function sentenceIn(text, sentence, what) {
  const want = oneLine(sentence);
  const at = text.indexOf(want);
  assert.notEqual(at, -1, `${what} is not in the playbook: "${sentence}"`);
  return text.slice(at, at + want.length);
}

const commandsIn = (sentence) => [...sentence.matchAll(/`(git [^`]+)`/g)].map((m) => m[1]);

// B3 names the default branch and this checkout's branch, each with one backticked git command.
function namingCommands() {
  const cmds = commandsIn(sentenceIn(stepThree(), B3, 'B3'));
  assert.equal(cmds.length, 2, `B3 must carry two backticked git commands, found ${cmds.length}`);
  return { defaultRefCmd: cmds[0], branchCmd: cmds[1] };
}

// B5's `git show <default ref>:...` command with the placeholder filled from B3's first output.
function showCommand(defaultRef) {
  const cmds = commandsIn(sentenceIn(stepThree(), B5, 'B5'));
  const cmd = cmds.find((c) => c.includes('<default ref>'));
  assert.ok(cmd, 'B5 carries no git show command with <default ref>');
  return cmd.replace('<default ref>', defaultRef);
}

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'sdlc-test',
  GIT_AUTHOR_EMAIL: 'sdlc-test@example.invalid',
  GIT_COMMITTER_NAME: 'sdlc-test',
  GIT_COMMITTER_EMAIL: 'sdlc-test@example.invalid',
};

// Runs one playbook command exactly as written, in the checkout it names.
function runPlaybookCommand(cwd, command) {
  const [bin, ...args] = command.split(' ');
  assert.equal(bin, 'git', `the playbook names a non-git command: ${command}`);
  const res = spawnSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV });
  if (res.error) throw res.error;
  return res;
}

// Fixture setup only: a failing setup step is a broken fixture, not a red test.
function git(cwd, ...args) {
  const res = spawnSync('git', ['-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', ...args], {
    cwd, encoding: 'utf8', env: GIT_ENV,
  });
  if (res.error) throw res.error;
  assert.equal(res.status, 0, `git ${args.join(' ')} failed: ${res.stderr}`);
  return res;
}

function writeVersion(dir, version) {
  const file = path.join(dir, 'sdlc', '.hooks', 'version.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ version }));
}

function commitAll(dir, message) {
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', message);
}

// An origin whose main is at 0.31.0, and whose feat branch was cut before that update, at 0.24.0.
function originWithFeat(t) {
  const origin = makeTempProject(t);
  git(origin, 'init', '-q', '-b', 'main');
  writeVersion(origin, '0.24.0');
  commitAll(origin, 'base');
  git(origin, 'branch', 'feat');
  writeVersion(origin, '0.31.0');
  commitAll(origin, 'update to 0.31.0');
  return origin;
}

function cloneOf(t, origin) {
  const parent = makeTempProject(t);
  git(parent, 'clone', '-q', origin, 'checkout');
  return path.join(parent, 'checkout');
}

const defaultRefOf = (clone, cmd) => {
  const res = runPlaybookCommand(clone, cmd);
  assert.equal(res.status, 0, `${cmd} exited ${res.status}: ${res.stderr}`);
  return res.stdout.trim();
};

describe('notice-stale-branch', () => {
  it('row 3: step 3 of the playbook states B1 to B10, each exactly once, in that order', () => {
    const s3 = stepThree();
    let prev = -1;
    SENTENCES.forEach((sentence, k) => {
      const want = oneLine(sentence);
      const first = s3.indexOf(want);
      assert.notEqual(first, -1, `B${k + 1} is not in step 3: "${sentence}"`);
      assert.equal(s3.lastIndexOf(want), first, `B${k + 1} appears more than once in step 3`);
      assert.ok(first > prev, `B${k + 1} is out of order in step 3`);
      prev = first;
    });
  });

  it('row 4: the check precedes the options in step 3 and is not confined to the notice step', () => {
    const s3 = stepThree();
    const b1 = s3.indexOf(oneLine(B1));
    const apply = s3.indexOf('**apply now**');
    assert.notEqual(b1, -1, `B1 is missing from step 3: "${B1}"`);
    assert.notEqual(apply, -1, 'the "**apply now**" option is missing from step 3');
    assert.ok(b1 < apply, 'B1 comes after the apply now option, so the choice would be offered first');
    const s1 = oneLine(nonEmpty(step(playbookText(), 1), 'playbook step 1'));
    assert.equal(s1.indexOf(oneLine(B1)), -1,
      'B1 sits in step 1, which only runs with a notice: a manual /sdlc:update would skip it');
  });

  it('row 5: in a clone on feat, the playbook commands name origin/main and feat, and origin/main is at 0.31.0', (t) => {
    const { defaultRefCmd, branchCmd } = namingCommands();
    const clone = cloneOf(t, originWithFeat(t));
    git(clone, 'checkout', '-q', 'feat');

    const defaultRef = defaultRefOf(clone, defaultRefCmd);
    assert.equal(defaultRef, 'origin/main', `${defaultRefCmd} printed "${defaultRef}"`);

    const current = runPlaybookCommand(clone, branchCmd);
    assert.equal(current.status, 0, `${branchCmd} exited ${current.status}: ${current.stderr}`);
    assert.equal(current.stdout.trim(), 'feat', `${branchCmd} printed "${current.stdout.trim()}"`);

    const show = runPlaybookCommand(clone, showCommand(defaultRef));
    assert.equal(show.status, 0, `the B5 command exited ${show.status}: ${show.stderr}`);
    assert.equal(JSON.parse(show.stdout).version, '0.31.0', 'the default branch blob is not version 0.31.0');

    const own = JSON.parse(fs.readFileSync(path.join(clone, 'sdlc', '.hooks', 'version.json'), 'utf8'));
    assert.equal(own.version, '0.24.0', "the checkout's own version.json is not 0.24.0");
  });

  it('row 6: no origin, an origin with no HEAD, or a detached HEAD each reach the failed-command path', (t) => {
    const { defaultRefCmd, branchCmd } = namingCommands();

    const bare = makeTempProject(t);
    git(bare, 'init', '-q', '-b', 'main');
    writeVersion(bare, '0.24.0');
    commitAll(bare, 'base');
    const noOrigin = runPlaybookCommand(bare, defaultRefCmd);
    assert.notEqual(noOrigin.status, 0,
      `${defaultRefCmd} succeeded in a repo with no origin: "${noOrigin.stdout.trim()}"`);

    // An origin with no origin/HEAD. Git before 2.48 never records it on fetch; 2.48+ does unless
    // `followRemoteHEAD=never`, so the fixture says so and means the same thing on every git.
    const added = makeTempProject(t);
    git(added, 'init', '-q', '-b', 'feat');
    git(added, 'remote', 'add', 'origin', originWithFeat(t));
    git(added, '-c', 'remote.origin.followRemoteHEAD=never', 'fetch', '-q', 'origin');
    const noHead = runPlaybookCommand(added, defaultRefCmd);
    assert.notEqual(noHead.status, 0,
      `${defaultRefCmd} succeeded with no origin/HEAD: "${noHead.stdout.trim()}"`);

    const detached = cloneOf(t, originWithFeat(t));
    git(detached, 'checkout', '-q', '--detach');
    const name = runPlaybookCommand(detached, branchCmd);
    assert.equal(name.status, 0, `${branchCmd} exited ${name.status} on detached HEAD: ${name.stderr}`);
    assert.equal(name.stdout.trim(), '', `${branchCmd} printed a name on detached HEAD: "${name.stdout.trim()}"`);
  });

  it('row 7: on the default branch the names are equal; a base without version.json fails the show', (t) => {
    const { defaultRefCmd, branchCmd } = namingCommands();

    const onMain = cloneOf(t, originWithFeat(t));
    const defaultRef = defaultRefOf(onMain, defaultRefCmd);
    const current = runPlaybookCommand(onMain, branchCmd).stdout.trim();
    assert.equal(defaultRef.replace(/^origin\//, ''), current,
      `on the default branch the names differ: "${defaultRef}" vs "${current}"`);

    const origin = makeTempProject(t);
    git(origin, 'init', '-q', '-b', 'main');
    fs.writeFileSync(path.join(origin, 'README.md'), 'no sdlc here\n');
    commitAll(origin, 'base');
    git(origin, 'branch', 'feat');
    const clone = cloneOf(t, origin);
    git(clone, 'checkout', '-q', 'feat');
    const show = runPlaybookCommand(clone, showCommand(defaultRefOf(clone, defaultRefCmd)));
    assert.notEqual(show.status, 0, `the B5 command succeeded with no version.json on the base: ${show.stdout}`);
  });

  it('row 8: the comparison needs only what is local — the origin can be gone', (t) => {
    const { defaultRefCmd } = namingCommands();
    const origin = originWithFeat(t);
    const clone = cloneOf(t, origin);
    git(clone, 'checkout', '-q', 'feat');
    fs.rmSync(origin, { recursive: true, force: true });

    const defaultRef = defaultRefOf(clone, defaultRefCmd);
    assert.equal(defaultRef, 'origin/main');
    const show = runPlaybookCommand(clone, showCommand(defaultRef));
    assert.equal(show.status, 0, `the B5 command needed the origin: ${show.stderr}`);
    assert.equal(JSON.parse(show.stdout).version, '0.31.0');
  });
});

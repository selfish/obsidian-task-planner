const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const readWorkflow = () => readFileSync(join(__dirname, '../.github/workflows/codeql.yml'), 'utf8');

test('CodeQL covers plugin/tooling and release workflows without executing repository code', () => {
  const workflow = readWorkflow();
  assert.match(workflow, /language: \[javascript-typescript, actions\]/);
  assert.match(workflow, /build-mode: none/);
  assert.match(workflow, /queries: security-extended/);
  assert.doesNotMatch(workflow, /npm (?:ci|install|run)|autobuild|paths-ignore:|disable-default-queries:/);
});

test('scanning uses unprivileged PR events, bounded jobs and no additional schedule', () => {
  const workflow = readWorkflow();
  assert.match(workflow, /pull_request:\n    branches: \[main\]/);
  assert.match(workflow, /push:\n    branches: \[main\]/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /timeout-minutes: 15/);
  assert.match(workflow, /cancel-in-progress: true/);
  assert.doesNotMatch(workflow, /pull_request_target|schedule:|secrets\.|continue-on-error:|self-hosted/);
  const job = workflow.split('  analyze:')[1];
  assert.match(workflow.split('jobs:')[0], /permissions:\n  contents: read/);
  assert.match(job, /permissions:\n      contents: read\n      security-events: write/);
  assert.doesNotMatch(workflow, /contents: write|actions: write|id-token: write|write-all/);
  assert.match(workflow, /persist-credentials: false/);
});

test('every scanning action is SHA-pinned and CodeQL init/analyze use the same verified release', () => {
  const workflow = readWorkflow();
  const uses = [...workflow.matchAll(/uses: ([^\s]+)/g)].map(match => match[1]);
  assert.equal(uses.length, 4);
  for (const action of uses) assert.match(action, /^[\w-]+\/[\w/-]+@[a-f0-9]{40}$/);
  const codeql = uses.filter(action => action.startsWith('github/codeql-action/'));
  assert.equal(codeql.length, 2);
  assert.equal(codeql[0].split('@')[1], codeql[1].split('@')[1]);
  const releases = [...workflow.matchAll(/uses: github\/codeql-action\/\w+@[a-f0-9]{40} # (v\d+\.\d+\.\d+)/g)];
  assert.equal(releases.length, 2);
  assert.equal(releases[0][1], releases[1][1]);
});

test('scan checkout, upload and SARIF evidence identify the reviewed revision', () => {
  const workflow = readWorkflow();
  assert.match(workflow, /REVIEWED_SHA: \$\{\{ github.event.pull_request.head.sha \|\| github.sha \}\}/);
  assert.match(workflow, /ref: \$\{\{ env.REVIEWED_SHA \}\}/);
  assert.match(workflow, /sha: \$\{\{ env.REVIEWED_SHA \}\}/);
  assert.match(workflow, /format\('refs\/pull\/\{0\}\/head', github.event.number\)/);
  assert.match(workflow, /test "\$\(git rev-parse HEAD\)" = "\$REVIEWED_SHA"/);
  assert.match(workflow, /name: codeql-\$\{\{ matrix.language \}\}-\$\{\{ env.REVIEWED_SHA \}\}/);
  assert.match(workflow, /output: sarif/);
  assert.match(workflow, /sarif\/revision.txt/);
  assert.match(workflow, /if-no-files-found: error/);
  assert.match(workflow, /wait-for-processing: true/);
});

test('required CI executes the scanning configuration regressions', () => {
  const workflow = readFileSync(join(__dirname, '../.github/workflows/ci.yml'), 'utf8');
  assert.match(workflow, /run: node --test scripts\/code-scanning-config.test.cjs/);
});

const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { packages } = require('../package-lock.json');

const lockedVersions = (name) =>
  Object.entries(packages).filter(([path]) => path.endsWith(`/node_modules/${name}`) || path === `node_modules/${name}`);

test('no locked glob or minimatch falls in the #295 advisory ranges', () => {
  const affected = [];
  for (const [name, inRange] of [
    // GHSA-3g3m-2fjr-6pw4: >=9.0.0 <=14.0.1
    ['glob', (major, minor, patch) => (major >= 9 && major < 14) || (major === 14 && minor === 0 && patch <= 1)],
    // GHSA-g3hv-75wg-m249: >=7.0.0 <11.0.1
    ['minimatch', (major, minor, patch) => (major >= 7 && major < 11) || (major === 11 && minor === 0 && patch === 0)],
  ]) {
    for (const [path, { version }] of lockedVersions(name)) {
      if (inRange(...version.split('.').map((part) => parseInt(part, 10)))) affected.push(`${path}@${version}`);
    }
  }
  assert.deepEqual(affected, []);
});

test('Istanbul coverage file selection agrees in sync and async globbing', async (t) => {
  const fromJest = createRequire(require.resolve('@jest/transform', { paths: [require.resolve('jest')] }));
  const fromIstanbul = createRequire(fromJest.resolve('babel-plugin-istanbul'));
  const TestExclude = fromIstanbul('test-exclude');
  const cwd = mkdtempSync(join(tmpdir(), 'task-planner-coverage-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, 'src', 'nested'), { recursive: true });
  for (const file of ['src/task.ts', 'src/nested/card.tsx', 'src/nested/card.test.tsx', 'src/nested/task.js']) {
    writeFileSync(join(cwd, file), '');
  }
  const files = new TestExclude({
    cwd,
    extension: ['.ts', '.tsx'],
    include: ['src/**/*.{ts,tsx}'],
    exclude: ['**/*.test.{ts,tsx}'],
  });
  const expected = ['src/nested/card.tsx', 'src/task.ts'];
  assert.deepEqual(files.globSync().sort(), expected);
  assert.deepEqual((await files.glob()).sort(), expected);
});

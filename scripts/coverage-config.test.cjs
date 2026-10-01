const assert = require('node:assert/strict');
const { test } = require('node:test');
const focused = require('../jest.config.js');

test('whole-source coverage includes UI, views, entrypoint and integration code', () => {
  const whole = require('../jest.whole-source.config.js');
  assert.deepEqual(whole.collectCoverageFrom, ['src/**/*.{ts,tsx}', '!src/**/*.d.ts']);
  assert.equal(whole.coverageDirectory, 'coverage/whole-source');
  for (const key of ['preset', 'testEnvironment', 'roots', 'testMatch', 'transform', 'moduleNameMapper', 'setupFilesAfterEnv']) {
    assert.deepEqual(whole[key], focused[key], `Both surfaces must run the same tests: ${key}`);
  }
  assert.ok(whole.coverageReporters.includes('json-summary'));
  assert.deepEqual(whole.coverageThreshold.global, {
    branches: 75,
    functions: 73,
    lines: 78,
    statements: 78,
  });
});

test('focused-core coverage retains its original surface and threshold gate', () => {
  assert.deepEqual(focused.collectCoverageFrom, [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.ts',
    '!src/**/index.ts',
    '!src/views/**/*.ts',
    '!src/settings/settings-store.ts',
    '!src/lib/file-adapter.ts',
    '!src/commands/open-planning.ts',
    '!src/commands/open-report.ts',
    '!src/editor/auto-convert-extension.ts',
    '!src/ui/**/*.tsx',
    '!src/ui/wikilink-suggest.ts',
  ]);
  assert.equal(focused.coverageDirectory, 'coverage/focused-core');
  assert.ok(focused.coverageReporters.includes('json-summary'));
  assert.deepEqual(focused.coverageThreshold.global, {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  });
});

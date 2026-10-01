const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pathToFileURL } = require('node:url');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const encode = map => `const value = 1;\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(JSON.stringify(map)).toString('base64')}`;
const decode = result => JSON.parse(Buffer.from(result.code.split('base64,').at(-1), 'base64'));

test('ts-jest file URLs become real filesystem source paths for Istanbul', () => {
  const { normalizeSourceMap } = require('./jest-transformer.cjs');
  const sourcePath = join(tmpdir(), 'fixture with space', 'task.ts');
  const original = {
    version: 3,
    sources: [pathToFileURL(sourcePath).href, '../unchanged.ts'],
    sourcesContent: ['const value: number = 1;', ''],
    mappings: 'AAAA',
    names: [],
  };
  const result = normalizeSourceMap({ code: encode(original), extra: 'preserved' });
  assert.deepEqual(decode(result), {
    ...original,
    sources: [sourcePath, '../unchanged.ts'],
  });
  assert.equal(result.extra, 'preserved');
  assert.ok(result.code.startsWith('const value = 1;'));
});

test('outputs without file URLs or inline maps remain unchanged', () => {
  const { normalizeSourceMap } = require('./jest-transformer.cjs');
  for (const result of [
    { code: 'const value = 1;' },
    { code: encode({ sources: ['/tmp/task.ts'], mappings: 'AAAA' }) },
  ]) {
    assert.equal(normalizeSourceMap(result), result);
  }
});

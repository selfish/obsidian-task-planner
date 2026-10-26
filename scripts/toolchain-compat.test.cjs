const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const { loadNycConfig } = require('@istanbuljs/load-nyc-config');
const Handlebars = require('handlebars');
const serialize = require('serialize-javascript');
const uri = require('fast-uri');

// These dependencies belong to Mocha and the lint/configuration toolchain, not
// the shipped plugin. Keep the advisory fixtures inert: never evaluate them.
test('Mocha serializer escapes a bare script terminator at the end of function source', () => {
  function fixture() {}
  fixture.toString = () => 'function fixture(){ return 1 }//</script';
  const output = serialize({ nested: { fixture } }, { space: 2 });
  assert.equal(output.toLowerCase().includes('</script'), false);
});

test('Mocha serializer retains trusted function and regular expression values', () => {
  const output = serialize({ fixture: function fixture() { return 1; }, pattern: /fixture/gi });
  assert.match(output, /function fixture\(\)/);
  assert.match(output, /return 1/);
  assert.match(output, /new RegExp\("fixture", "gi"\)/);
});

test('configuration URI parser rejects percent-encoded schemes instead of activating them', () => {
  for (const value of ['%6Aavascript:alert(1)', '%u006Aavascript:alert(1)']) {
    assert.ok(uri.parse(value).error);
    assert.throws(() => uri.resolve('https://a.example/', value), /scheme.*malformed/i);
  }
  assert.equal(uri.equal('%68ttp://a/', 'http://a/'), false);
  assert.equal(uri.resolve('https://a.example/config/', '../schema.json'), 'https://a.example/schema.json');
});

// This is ts-jest's development-only dependency, not a plugin template API.
// Regressions cover the three public advisories fixed in Handlebars 4.7.10.
test('Handlebars precompilation escapes inline script terminators', () => {
  const source = Handlebars.precompile('safe</script><script>fixture</script>');
  assert.equal(source.toLowerCase().includes('</script>'), false);
});

test('Handlebars rejects malformed AST block parameters before code generation', () => {
  const ast = Handlebars.parse('{{#if value}}fixture{{/if}}');
  ast.body[0].program.blockParams = { length: '0' };
  assert.throws(() => Handlebars.precompile(ast));
});

test('Handlebars denies prototype-owned constructors even with prototype methods enabled', () => {
  const template = Handlebars.compile('{{#if (lookup prototype "constructor")}}exposed{{else}}blocked{{/if}}');
  assert.equal(template({ prototype: Function.prototype }, { allowProtoMethodsByDefault: true }), 'blocked');
});

test('Handlebars trusted string templates retain escaping and block behavior', () => {
  const template = Handlebars.compile('{{#each entries}}{{name}}={{#if enabled}}yes{{else}}no{{/if}};{{/each}}');
  assert.equal(template({ entries: [{ name: '<fixture>', enabled: true }, { name: 'plain', enabled: false }] }), '&lt;fixture&gt;=yes;plain=no;');
});

// Only this legacy coverage loader needs the scoped YAML override. Do not change
// plugin dependencies or globally replace parsers used by unrelated tools.
test('coverage loader resolves the patched, sprintf-free YAML dependency', () => {
  const loaderRequire = createRequire(require.resolve('@istanbuljs/load-nyc-config'));
  assert.equal(loaderRequire('js-yaml/package.json').version, '4.3.2');
  assert.equal(require('source-map-js/package.json').version, '1.2.2');
});

test('coverage YAML and JSON inheritance retain typed values and array normalization', async t => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'task-planner-nyc-'));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  await fs.writeFile(path.join(cwd, 'package.json'), JSON.stringify({ name: 'disposable-coverage-fixture', nyc: { extension: '.tsx' } }));
  await fs.writeFile(path.join(cwd, 'base.json'), JSON.stringify({ branches: 75, exclude: ['generated/**'], 'check-coverage': true }));
  await fs.writeFile(path.join(cwd, '.nycrc.yaml'), 'extends: ./base.json\nlines: 80.5\nall: true\ninclude:\n  - "src/**/*.ts"\nreporter: lcov\n');
  const config = await loadNycConfig({ cwd });
  assert.equal(config.cwd, cwd);
  assert.equal(config.lines, 80.5);
  assert.equal(config.branches, 75);
  assert.equal(config.all, true);
  assert.equal(config.checkCoverage, true);
  assert.equal(config.reporter, 'lcov');
  assert.deepEqual(config.include, ['src/**/*.ts']);
  assert.deepEqual(config.exclude, ['generated/**']);
  assert.deepEqual(config.extension, ['.tsx']);
});

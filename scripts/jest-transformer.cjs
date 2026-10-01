const { fileURLToPath } = require('node:url');

// ts-jest 29.4.13 emits file: URLs. Istanbul currently treats them as relative
// paths, breaking LCOV links and HTML source lookup. Normalize only those URLs;
// retain the generated code, mappings, sourcesContent and compiler options.
function normalizeSourceMap(result) {
  const marker = '//# sourceMappingURL=data:application/json;charset=utf-8;base64,';
  const start = result.code.lastIndexOf(marker);
  if (start === -1) return result;
  const encoded = result.code.slice(start + marker.length).trim();
  const map = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  if (!map.sources.some(source => source.startsWith('file:'))) return result;
  map.sources = map.sources.map(source => source.startsWith('file:') ? fileURLToPath(source) : source);
  return {
    ...result,
    code: result.code.slice(0, start + marker.length) + Buffer.from(JSON.stringify(map)).toString('base64'),
  };
}

function createTransformer(options) {
  const transformer = require('ts-jest').default.createTransformer(options);
  const process = transformer.process.bind(transformer);
  const processAsync = transformer.processAsync.bind(transformer);
  transformer.process = (...args) => normalizeSourceMap(process(...args));
  transformer.processAsync = async (...args) => normalizeSourceMap(await processAsync(...args));
  return transformer;
}

module.exports = { createTransformer, normalizeSourceMap };

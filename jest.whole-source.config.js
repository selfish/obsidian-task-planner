/** @type {import('jest').Config} */
module.exports = {
  ...require('./jest.config.js'),
  // Include every runtime source file, even when a unit test never imports it.
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage/whole-source',
  // Initial floors rounded down from main 7ea0700; raise them with stable gains.
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 73,
      lines: 78,
      statements: 78,
    },
  },
};

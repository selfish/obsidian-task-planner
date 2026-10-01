/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.tsx?$': [
      '<rootDir>/scripts/jest-transformer.cjs',
      {
        tsconfig: {
          jsx: 'react',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/__tests__/__mocks__/obsidian.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  // Focused-core surface: historical selection and thresholds, not whole-plugin coverage.
  // jest.whole-source.config.js instruments the complete runtime source separately.
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.ts',
    // Exclude barrel exports (re-exports only, no testable logic)
    '!src/**/index.ts',
    // View lifecycle behavior is also checked by unit and real-host tests.
    '!src/views/**/*.ts',
    // Settings definitions and collection editors are covered by focused UI/logic tests.
    '!src/settings/settings-store.ts',
    // Exclude Obsidian file adapter (Obsidian Vault API)
    '!src/lib/file-adapter.ts',
    // Exclude Obsidian command handlers (thin wrappers)
    '!src/commands/open-planning.ts',
    '!src/commands/open-report.ts',
    // Exclude CodeMirror editor extension (requires full editor mocking)
    '!src/editor/auto-convert-extension.ts',
    // React rendering is tested but instrumented in the whole-source report.
    '!src/ui/**/*.tsx',
    // Exclude WikilinkSuggest (requires browser Selection API not available in jsdom)
    '!src/ui/wikilink-suggest.ts',
  ],
  coverageDirectory: 'coverage/focused-core',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testPathIgnorePatterns: ['/node_modules/', '/__mocks__/'],
  verbose: true,
};

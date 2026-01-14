/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
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
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.ts',
    // Exclude UI components (require React testing setup or Obsidian API)
    '!src/ui/**/*.{ts,tsx}',
    // Exclude Obsidian-dependent files
    '!src/views/**/*.ts',
    '!src/settings/settings-tab.ts',
    '!src/settings/settings-store.ts',
    '!src/settings/planning-settings.ts',
    '!src/lib/file-adapter.ts',
    // Exclude Obsidian-dependent commands
    '!src/commands/open-planning.ts',
    '!src/commands/open-report.ts',
    // Exclude duplicate files
    '!src/events/TaskPlannerEvent.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
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

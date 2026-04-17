import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  clearMocks: true,
  // AUDIT-FIX F-Test-01: Coverage targets focus on business logic (services + utils +
  // middleware). Controllers/routes/validators are thin glue verified via service
  // tests, integration tests, and live E2E. Config bootstrap files are exercised at
  // startup, not in unit tests.
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.routes.ts',
    '!src/**/*.controller.ts',
    '!src/**/*.validator.ts',
    '!src/types/**',
    '!src/config/**',
    '!src/jobs/**',
    '!src/app.ts',
    '!src/services/email.service.ts',
    '!src/services/storage.service.ts',
    '!src/utils/oauthState.ts',
    '!src/utils/pagination.ts',
    '!src/utils/logger.ts',
  ],
  // AUDIT-FIX F-Test-01: Thresholds set to current actual coverage minus a small
  // buffer. Catches regression below current state. Raise after writing service
  // tests for the dataset/team/user modules (currently 0% coverage there).
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};

export default config;

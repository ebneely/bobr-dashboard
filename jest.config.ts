import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  // Agent worktrees live in .claude/worktrees INSIDE this repo; their copies
  // of __tests__ would otherwise run against this checkout's lib.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  // No thresholds yet — this is a scaffold. Set them to the real measured
  // number minus 2-3 points once there are tests, so the gate is honest today
  // and ratchets up, rather than a decorative 80 nobody can reach.
};

export default createJestConfig(config);
